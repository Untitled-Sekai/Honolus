import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from './db';
import type { ImportSonolusPackOptions, SonolusPackImportResult } from './pack/type';
import { importSonolusPack } from './pack/importer';

export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead' | 'cancelled';
export type JobRecord<T = unknown, R = unknown> = { id: string; name: string; payload: T; state: JobState; result?: R; error?: string; attempt: number; maxAttempts: number; createdAt: number; updatedAt: number; runAt?: number };
export type JobHandler<T = unknown, R = unknown> = (payload: T, context: { id: string; attempt: number }) => Promise<R>;
export type EnqueueOptions = { idempotencyKey?: string; maxAttempts?: number; delayMs?: number };
export interface JobQueue { enqueue<T>(name: string, payload: T, options?: EnqueueOptions): Promise<{ id: string }>; get<T = unknown, R = unknown>(id: string): Promise<JobRecord<T, R> | undefined>; cancel(id: string): Promise<boolean>; ready?(): Promise<void>; close(): Promise<void> }

export class MemoryJobQueue implements JobQueue {
    private readonly jobs = new Map<string, JobRecord>(); private readonly idempotency = new Map<string, string>(); private readonly handlers = new Map<string, JobHandler>();
    private readonly timers = new Set<ReturnType<typeof setTimeout>>(); private readonly running = new Set<Promise<void>>(); private closed = false;
    public async enqueue<T>(name: string, payload: T, options: EnqueueOptions = {}): Promise<{ id: string }> {
        if (this.closed) throw new Error('Job queue is closed'); const existing = options.idempotencyKey && this.idempotency.get(options.idempotencyKey); if (existing) return { id: existing };
        validateAttempts(options.maxAttempts); const now = Date.now(); const job: JobRecord<T> = { id: randomUUID(), name, payload, state: 'queued', attempt: 0, maxAttempts: options.maxAttempts ?? 3, createdAt: now, updatedAt: now, runAt: now + (options.delayMs ?? 0) };
        this.jobs.set(job.id, job); if (options.idempotencyKey) this.idempotency.set(options.idempotencyKey, job.id); this.schedule(job, options.delayMs ?? 0); return { id: job.id };
    }
    public register<T, R>(name: string, handler: JobHandler<T, R>): void { this.handlers.set(name, handler as JobHandler); }
    public async get<T = unknown, R = unknown>(id: string) { return this.jobs.get(id) as JobRecord<T, R> | undefined; }
    public async cancel(id: string): Promise<boolean> { const job = this.jobs.get(id); if (!job || job.state !== 'queued') return false; job.state = 'cancelled'; job.updatedAt = Date.now(); return true; }
    public async close(): Promise<void> { this.closed = true; for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); await Promise.allSettled(this.running); }
    private schedule(job: JobRecord, delayMs: number): void { const timer = setTimeout(() => { this.timers.delete(timer); const promise = this.run(job).finally(() => this.running.delete(promise)); this.running.add(promise); }, delayMs); this.timers.add(timer); }
    private async run(job: JobRecord): Promise<void> { const handler = this.handlers.get(job.name); if (!handler || job.state !== 'queued' || this.closed) return; job.state = 'running'; job.attempt++; job.updatedAt = Date.now(); try { job.result = await handler(job.payload, { id: job.id, attempt: job.attempt }); job.state = 'succeeded'; } catch (error) { job.error = error instanceof Error ? error.message : String(error); if (job.attempt < job.maxAttempts && !this.closed) { job.state = 'queued'; const delay = retryDelay(job.attempt); job.runAt = Date.now() + delay; this.schedule(job, delay); } else job.state = 'dead'; } job.updatedAt = Date.now(); }
}

export type PostgresJobQueueOptions = { executor: SqlExecutor; tableName?: string; pollIntervalMs?: number; leaseMs?: number };
export class PostgresJobQueue implements JobQueue {
    private readonly table: string; private readonly handlers = new Map<string, JobHandler>(); private readonly initialized: Promise<void>; private timer?: ReturnType<typeof setTimeout>; private closed = false; private polling = false;
    public constructor(private readonly options: PostgresJobQueueOptions) { this.table = options.tableName ?? 'honolus_jobs'; if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(this.table)) throw new Error('Invalid job table name'); this.initialized = this.migrate().then(() => this.schedule()); }
    public ready(): Promise<void> { return this.initialized; } public register<T, R>(name: string, handler: JobHandler<T, R>): void { this.handlers.set(name, handler as JobHandler); }
    public async enqueue<T>(name: string, payload: T, options: EnqueueOptions = {}): Promise<{ id: string }> { await this.initialized; validateAttempts(options.maxAttempts); const id = randomUUID(); const result = await this.options.executor.query<{ id: string }>(`INSERT INTO ${this.table} (id,name,payload,state,max_attempts,idempotency_key,run_at) VALUES ($1,$2,$3,'queued',$4,$5,CURRENT_TIMESTAMP + ($6 * INTERVAL '1 millisecond')) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id`, [id, name, JSON.stringify(payload), options.maxAttempts ?? 3, options.idempotencyKey ?? null, options.delayMs ?? 0]); return { id: result.rows[0].id }; }
    public async get<T = unknown, R = unknown>(id: string): Promise<JobRecord<T, R> | undefined> { await this.initialized; const result = await this.options.executor.query<JobRow>(`SELECT * FROM ${this.table} WHERE id=$1`, [id]); return result.rows[0] ? rowToJob(result.rows[0]) as JobRecord<T, R> : undefined; }
    public async cancel(id: string): Promise<boolean> { await this.initialized; const result = await this.options.executor.query<{ id: string }>(`UPDATE ${this.table} SET state='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND state='queued' RETURNING id`, [id]); return result.rows.length > 0; }
    public async close(): Promise<void> { this.closed = true; if (this.timer) clearTimeout(this.timer); while (this.polling) await new Promise((resolve) => setTimeout(resolve, 5)); }
    private async migrate(): Promise<void> { await this.options.executor.query(`CREATE TABLE IF NOT EXISTS ${this.table} (id UUID PRIMARY KEY,name TEXT NOT NULL,payload JSONB NOT NULL,state TEXT NOT NULL,result JSONB,error TEXT,attempt INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 3,idempotency_key TEXT,run_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,lease_until TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`); await this.options.executor.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${this.table}_idempotency_idx ON ${this.table} (idempotency_key) WHERE idempotency_key IS NOT NULL`); await this.options.executor.query(`CREATE INDEX IF NOT EXISTS ${this.table}_claim_idx ON ${this.table} (state,run_at)`); }
    private schedule(): void { if (!this.closed) this.timer = setTimeout(() => void this.poll(), this.options.pollIntervalMs ?? 250); }
    private async poll(): Promise<void> { if (this.closed || this.polling) return; this.polling = true; try { const claimed = await this.claim(); if (claimed) await this.execute(claimed); } catch { /* retry on the next poll; readiness exposes startup failures */ } finally { this.polling = false; this.schedule(); } }
    private async claim(): Promise<JobRow | undefined> { if (!this.options.executor.transaction) throw new Error('PostgresJobQueue requires transaction support'); return this.options.executor.transaction(async (tx) => { const found = await tx.query<JobRow>(`SELECT * FROM ${this.table} WHERE ((state='queued' AND run_at<=CURRENT_TIMESTAMP) OR (state='running' AND lease_until<CURRENT_TIMESTAMP)) ORDER BY run_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1`); const row = found.rows[0]; if (!row) return undefined; const updated = await tx.query<JobRow>(`UPDATE ${this.table} SET state='running',attempt=attempt+1,lease_until=CURRENT_TIMESTAMP + ($2 * INTERVAL '1 millisecond'),updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [row.id, this.options.leaseMs ?? 30_000]); return updated.rows[0]; }); }
    private async execute(row: JobRow): Promise<void> {
        const handler = this.handlers.get(row.name);
        if (!handler) { await this.fail(row, `No handler registered for ${row.name}`); return; }
        const heartbeatMs = Math.max(100, Math.floor((this.options.leaseMs ?? 30_000) / 3));
        const heartbeat = setInterval(() => void this.options.executor.query(`UPDATE ${this.table} SET lease_until=CURRENT_TIMESTAMP + ($2 * INTERVAL '1 millisecond') WHERE id=$1 AND state='running'`, [row.id, this.options.leaseMs ?? 30_000]).catch(() => undefined), heartbeatMs);
        try { const result = await handler(row.payload, { id: row.id, attempt: row.attempt }); await this.options.executor.query(`UPDATE ${this.table} SET state='succeeded',result=$2,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [row.id, JSON.stringify(result ?? null)]); }
        catch (error) { await this.fail(row, error instanceof Error ? error.message : String(error)); }
        finally { clearInterval(heartbeat); }
    }
    private async fail(row: JobRow, message: string): Promise<void> { const dead = row.attempt >= row.max_attempts; await this.options.executor.query(`UPDATE ${this.table} SET state=$2,error=$3,run_at=CURRENT_TIMESTAMP + ($4 * INTERVAL '1 millisecond'),lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [row.id, dead ? 'dead' : 'queued', message, retryDelay(row.attempt)]); }
}
type JobRow = { id: string; name: string; payload: unknown; state: JobState; result?: unknown; error?: string; attempt: number; max_attempts: number; run_at: string | Date; created_at: string | Date; updated_at: string | Date };
function rowToJob(row: JobRow): JobRecord { return { id: row.id, name: row.name, payload: row.payload, state: row.state, result: row.result, error: row.error, attempt: row.attempt, maxAttempts: row.max_attempts, runAt: +new Date(row.run_at), createdAt: +new Date(row.created_at), updatedAt: +new Date(row.updated_at) }; }
function retryDelay(attempt: number): number { return Math.min(60_000, 250 * (2 ** Math.max(0, attempt - 1))); } function validateAttempts(value?: number): void { if (value !== undefined && (!Number.isInteger(value) || value < 1)) throw new RangeError('maxAttempts must be a positive integer'); }
export const PACK_IMPORT_JOB = 'sonolus.pack.import';
export function registerPackImportWorker(queue: MemoryJobQueue | PostgresJobQueue): void { queue.register<ImportSonolusPackOptions, SonolusPackImportResult>(PACK_IMPORT_JOB, (payload) => importSonolusPack(payload)); }
export async function enqueuePackImport(queue: JobQueue, options: ImportSonolusPackOptions, idempotencyKey = `pack:${options.source.type}:${'path' in options.source ? options.source.path : options.source.packageName}`): Promise<{ id: string }> { return queue.enqueue(PACK_IMPORT_JOB, options, { idempotencyKey }); }

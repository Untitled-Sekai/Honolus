import { randomUUID } from 'node:crypto';
import { SqlSonolusDatabase } from './db/sql';
import type { SqlDatabaseOptions, SqlExecutor } from './db/sql';
import type { SonolusDatabase } from './db';
import type { JobQueue } from './jobs';

export type OutboxEvent<T = unknown> = { id: string; name: string; payload: T; createdAt: number };
export interface OutboxWriter { append<T>(name: string, payload: T, options?: { idempotencyKey?: string }): Promise<{ id: string }> }
export type TransactionalOutboxOptions = { executor: SqlExecutor; itemDatabase?: Omit<SqlDatabaseOptions, 'driver' | 'executor'>; tableName?: string };

export class TransactionalOutbox {
    private readonly table: string; private readonly initialized: Promise<void>;
    public constructor(private readonly options: TransactionalOutboxOptions) { this.table = options.tableName ?? 'honolus_outbox'; if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(this.table)) throw new Error('Invalid outbox table name'); this.initialized = this.migrate(); }
    public ready(): Promise<void> { return this.initialized; }
    public async transaction<T>(callback: (database: SonolusDatabase, outbox: OutboxWriter) => Promise<T>): Promise<T> {
        await this.initialized; if (!this.options.executor.transaction) throw new Error('TransactionalOutbox requires transaction support');
        return this.options.executor.transaction(async (executor) => callback(new SqlSonolusDatabase({ driver: 'sql', executor, autoMigrate: false, ...this.options.itemDatabase }), new SqlOutboxWriter(executor, this.table)));
    }
    private async migrate(): Promise<void> { await this.options.executor.query(`CREATE TABLE IF NOT EXISTS ${this.table} (id UUID PRIMARY KEY,name TEXT NOT NULL,payload JSONB NOT NULL,idempotency_key TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,published_at TIMESTAMPTZ,lease_until TIMESTAMPTZ,error TEXT)`); await this.options.executor.query(`ALTER TABLE ${this.table} ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ`); await this.options.executor.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${this.table}_idempotency_idx ON ${this.table} (idempotency_key) WHERE idempotency_key IS NOT NULL`); await this.options.executor.query(`CREATE INDEX IF NOT EXISTS ${this.table}_pending_idx ON ${this.table} (created_at) WHERE published_at IS NULL`); }
}

class SqlOutboxWriter implements OutboxWriter {
    public constructor(private readonly executor: SqlExecutor, private readonly table: string) {}
    public async append<T>(name: string, payload: T, options: { idempotencyKey?: string } = {}): Promise<{ id: string }> { const id = randomUUID(); const result = await this.executor.query<{ id: string }>(`INSERT INTO ${this.table} (id,name,payload,idempotency_key) VALUES ($1,$2,$3,$4) ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id`, [id, name, JSON.stringify(payload), options.idempotencyKey ?? null]); return { id: result.rows[0].id }; }
}

export type OutboxDispatcherOptions = { executor: SqlExecutor; queue: JobQueue; tableName?: string; pollIntervalMs?: number };
export class OutboxDispatcher {
    private readonly table: string; private timer?: ReturnType<typeof setTimeout>; private running = false; private closed = false;
    public constructor(private readonly options: OutboxDispatcherOptions) { this.table = options.tableName ?? 'honolus_outbox'; if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(this.table)) throw new Error('Invalid outbox table name'); }
    public start(): void { if (!this.timer && !this.closed) this.schedule(0); }
    public async close(): Promise<void> { this.closed = true; if (this.timer) clearTimeout(this.timer); while (this.running) await new Promise((resolve) => setTimeout(resolve, 5)); }
    private schedule(delay = this.options.pollIntervalMs ?? 250): void { if (!this.closed) this.timer = setTimeout(() => void this.poll(), delay); }
    private async poll(): Promise<void> { if (this.closed || this.running) return; this.running = true; try { const event = await this.claim(); if (event) { try { await this.options.queue.enqueue(event.name, event.payload, { idempotencyKey: `outbox:${event.id}` }); await this.options.executor.query(`UPDATE ${this.table} SET published_at=CURRENT_TIMESTAMP,lease_until=NULL,error=NULL WHERE id=$1`, [event.id]); } catch (error) { await this.options.executor.query(`UPDATE ${this.table} SET lease_until=NULL,error=$2 WHERE id=$1`, [event.id, error instanceof Error ? error.message : String(error)]); } } } catch { /* transient DB errors are retried */ } finally { this.running = false; this.schedule(); } }
    private async claim(): Promise<OutboxEvent | undefined> { if (!this.options.executor.transaction) throw new Error('OutboxDispatcher requires transaction support'); return this.options.executor.transaction(async (tx) => { const result = await tx.query<{ id: string; name: string; payload: unknown; created_at: string | Date }>(`SELECT id,name,payload,created_at FROM ${this.table} WHERE published_at IS NULL AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`); const row = result.rows[0]; if (!row) return undefined; await tx.query(`UPDATE ${this.table} SET lease_until=CURRENT_TIMESTAMP + INTERVAL '30 seconds' WHERE id=$1`, [row.id]); return { id: row.id, name: row.name, payload: row.payload, createdAt: +new Date(row.created_at) }; }); }
}

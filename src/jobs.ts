import { randomUUID } from 'node:crypto';
import type { ImportSonolusPackOptions, SonolusPackImportResult } from './pack/type';
import { importSonolusPack } from './pack/importer';

export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type JobRecord<T = unknown, R = unknown> = { id: string; name: string; payload: T; state: JobState; result?: R; error?: string; createdAt: number; updatedAt: number };
export type JobHandler<T = unknown, R = unknown> = (payload: T, context: { id: string }) => Promise<R>;

export interface JobQueue {
    enqueue<T>(name: string, payload: T, options?: { idempotencyKey?: string }): Promise<{ id: string }>;
    get<T = unknown, R = unknown>(id: string): Promise<JobRecord<T, R> | undefined>;
    cancel(id: string): Promise<boolean>;
    close(): Promise<void>;
}

export class MemoryJobQueue implements JobQueue {
    private readonly jobs = new Map<string, JobRecord>();
    private readonly idempotency = new Map<string, string>();
    private readonly handlers = new Map<string, JobHandler>();
    private closed = false;

    public async enqueue<T>(name: string, payload: T, options: { idempotencyKey?: string } = {}): Promise<{ id: string }> {
        if (this.closed) throw new Error('Job queue is closed');
        if (options.idempotencyKey) {
            const existing = this.idempotency.get(options.idempotencyKey);
            if (existing) return { id: existing };
        }
        const now = Date.now();
        const job: JobRecord<T> = { id: randomUUID(), name, payload, state: 'queued', createdAt: now, updatedAt: now };
        this.jobs.set(job.id, job);
        if (options.idempotencyKey) this.idempotency.set(options.idempotencyKey, job.id);
        queueMicrotask(() => void this.run(job));
        return { id: job.id };
    }

    public register<T, R>(name: string, handler: JobHandler<T, R>): void { this.handlers.set(name, handler as JobHandler); }
    public async get<T = unknown, R = unknown>(id: string): Promise<JobRecord<T, R> | undefined> { return this.jobs.get(id) as JobRecord<T, R> | undefined; }
    public async cancel(id: string): Promise<boolean> { const job = this.jobs.get(id); if (!job || job.state !== 'queued') return false; job.state = 'cancelled'; job.updatedAt = Date.now(); return true; }
    public async close(): Promise<void> { this.closed = true; }

    private async run(job: JobRecord): Promise<void> {
        const handler = this.handlers.get(job.name);
        if (!handler || job.state !== 'queued') return;
        job.state = 'running'; job.updatedAt = Date.now();
        try { job.result = await handler(job.payload, { id: job.id }); job.state = 'succeeded'; }
        catch (error) { job.error = error instanceof Error ? error.message : String(error); job.state = 'failed'; }
        job.updatedAt = Date.now();
    }
}

export const PACK_IMPORT_JOB = 'sonolus.pack.import';
export function registerPackImportWorker(queue: MemoryJobQueue): void {
    queue.register<ImportSonolusPackOptions, SonolusPackImportResult>(PACK_IMPORT_JOB, (payload) => importSonolusPack(payload));
}

export async function enqueuePackImport(queue: JobQueue, options: ImportSonolusPackOptions, idempotencyKey = `pack:${options.source.type}:${'path' in options.source ? options.source.path : options.source.packageName}`): Promise<{ id: string }> {
    return queue.enqueue(PACK_IMPORT_JOB, options, { idempotencyKey });
}

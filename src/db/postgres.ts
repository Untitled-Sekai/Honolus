import type { Metrics } from '../runtime';
import type { SqlExecutor } from './sql';

export interface PostgresPoolClientLike {
    query<T extends object = Record<string, unknown>>(sql: string, parameters?: readonly unknown[]): Promise<{ rows: T[] }>;
    release(): void;
}

export interface PostgresPoolLike {
    query<T extends object = Record<string, unknown>>(sql: string, parameters?: readonly unknown[]): Promise<{ rows: T[] }>;
    connect(): Promise<PostgresPoolClientLike>;
    end(): Promise<void>;
}

export type PostgresExecutorOptions = {
    pool: PostgresPoolLike;
    statementTimeoutMs?: number;
    lockTimeoutMs?: number;
    metrics?: Metrics;
};

/** Production executor for pg-compatible pools without forcing a pg version on applications. */
export class PostgresExecutor implements SqlExecutor {
    public constructor(private readonly options: PostgresExecutorOptions) {
        validateTimeout(options.statementTimeoutMs, 'statementTimeoutMs');
        validateTimeout(options.lockTimeoutMs, 'lockTimeoutMs');
    }

    public async query<T extends object = Record<string, unknown>>(sql: string, parameters?: readonly unknown[]): Promise<{ rows: T[] }> {
        const started = performance.now();
        try {
            const result = await this.options.pool.query<T>(sql, parameters);
            this.observe('ok', started);
            return result;
        } catch (error) {
            this.observe('error', started);
            throw error;
        }
    }

    public async transaction<T>(callback: (executor: SqlExecutor) => Promise<T>): Promise<T> {
        const client = await this.options.pool.connect();
        try {
            await client.query('BEGIN');
            if (this.options.statementTimeoutMs !== undefined) await client.query(`SET LOCAL statement_timeout = ${this.options.statementTimeoutMs}`);
            if (this.options.lockTimeoutMs !== undefined) await client.query(`SET LOCAL lock_timeout = ${this.options.lockTimeoutMs}`);
            const result = await callback(new PostgresClientExecutor(client, this.options.metrics));
            await client.query('COMMIT');
            return result;
        } catch (error) {
            try { await client.query('ROLLBACK'); } catch { /* preserve the original error */ }
            throw error;
        } finally {
            client.release();
        }
    }

    public close(): Promise<void> { return this.options.pool.end(); }

    private observe(status: string, started: number): void {
        this.options.metrics?.increment('db.queries.total', 1, { driver: 'postgres', status });
        this.options.metrics?.observe('db.query.duration_ms', performance.now() - started, { driver: 'postgres', status });
    }
}

class PostgresClientExecutor implements SqlExecutor {
    public constructor(private readonly client: PostgresPoolClientLike, private readonly metrics?: Metrics) {}
    public async query<T extends object = Record<string, unknown>>(sql: string, parameters?: readonly unknown[]) {
        const started = performance.now();
        try {
            const result = await this.client.query<T>(sql, parameters);
            this.metrics?.increment('db.queries.total', 1, { driver: 'postgres', status: 'ok' });
            this.metrics?.observe('db.query.duration_ms', performance.now() - started, { driver: 'postgres', status: 'ok' });
            return result;
        } catch (error) {
            this.metrics?.increment('db.queries.total', 1, { driver: 'postgres', status: 'error' });
            throw error;
        }
    }
}

function validateTimeout(value: number | undefined, name: string): void {
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) throw new RangeError(`${name} must be a positive integer`);
}

export type CacheValue = string | Uint8Array | Record<string, unknown>;

export interface CacheStore {
    get<T extends CacheValue = CacheValue>(key: string): Promise<T | undefined>;
    set(key: string, value: CacheValue, options?: { ttlMs?: number }): Promise<void>;
    delete(key: string): Promise<void>;
}

export interface SessionStore<T = Record<string, unknown>> {
    get(id: string): Promise<T | undefined>;
    set(id: string, value: T, options?: { ttlMs?: number }): Promise<void>;
    revoke(id: string): Promise<void>;
}

export interface LockStore {
    acquire(key: string, options?: { ttlMs?: number }): Promise<string | undefined>;
    release(key: string, token: string): Promise<void>;
}

type Entry = { value: CacheValue; expiresAt?: number };

export class MemoryCacheStore implements CacheStore, SessionStore {
    private readonly values = new Map<string, Entry>();

    public async get<T extends CacheValue = CacheValue>(key: string): Promise<T | undefined> {
        const entry = this.values.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
            this.values.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    public async set(key: string, value: CacheValue, options: { ttlMs?: number } = {}): Promise<void> {
        this.values.set(key, { value, ...(options.ttlMs !== undefined ? { expiresAt: Date.now() + options.ttlMs } : {}) });
    }

    public async delete(key: string): Promise<void> { this.values.delete(key); }
    public async revoke(key: string): Promise<void> { await this.delete(key); }
}

import { randomUUID } from 'node:crypto';

export class MemoryLockStore implements LockStore {
    private readonly locks = new Map<string, { token: string; expiresAt: number }>();

    public async acquire(key: string, options: { ttlMs?: number } = {}): Promise<string | undefined> {
        const current = this.locks.get(key);
        if (current && current.expiresAt > Date.now()) return undefined;
        const token = randomUUID();
        this.locks.set(key, { token, expiresAt: Date.now() + (options.ttlMs ?? 30_000) });
        return token;
    }

    public async release(key: string, token: string): Promise<void> {
        if (this.locks.get(key)?.token === token) this.locks.delete(key);
    }
}

export interface RateLimitStore {
    increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

export class MemoryRateLimitStore implements RateLimitStore {
    private readonly windows = new Map<string, { count: number; resetAt: number }>();

    public async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
        const now = Date.now();
        const current = this.windows.get(key);
        if (!current || current.resetAt <= now) {
            const next = { count: 1, resetAt: now + windowMs };
            this.windows.set(key, next);
            return next;
        }
        current.count += 1;
        return current;
    }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
    log(level: LogLevel, event: string, fields?: LogFields): void;
}

export class JsonConsoleLogger implements Logger {
    public log(level: LogLevel, event: string, fields: LogFields = {}): void {
        const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
        if (level === 'error') console.error(line);
        else if (level === 'warn') console.warn(line);
        else console.log(line);
    }
}

export interface Metrics {
    increment(name: string, value?: number, labels?: Record<string, string>): void;
    observe(name: string, value: number, labels?: Record<string, string>): void;
}

export class MemoryMetrics implements Metrics {
    public readonly counters = new Map<string, number>();
    public readonly observations = new Map<string, number[]>();
    public increment(name: string, value = 1, labels?: Record<string, string>): void { this.counters.set(metricKey(name, labels), (this.counters.get(metricKey(name, labels)) ?? 0) + value); }
    public observe(name: string, value: number, labels?: Record<string, string>): void { const key = metricKey(name, labels); this.observations.set(key, [...(this.observations.get(key) ?? []), value]); }
}

export interface Span {
    end(): void;
    setAttribute(name: string, value: string | number | boolean): void;
}

export interface Tracer {
    startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span;
}

export class NoopTracer implements Tracer {
    public startSpan(): Span { return { end() {}, setAttribute() {} }; }
}

function metricKey(name: string, labels?: Record<string, string>): string {
    return `${name}${labels ? JSON.stringify(labels) : ''}`;
}

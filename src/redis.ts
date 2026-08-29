import type { CacheStore, CacheValue, LockStore, RateLimitStore, SessionStore } from './runtime';

export interface RedisClientLike { sendCommand(arguments_: readonly string[]): Promise<unknown> }
export type RedisStoreOptions = { client: RedisClientLike; namespace?: string };

abstract class RedisStoreBase {
    protected readonly namespace: string;
    public constructor(protected readonly options: RedisStoreOptions) { this.namespace = options.namespace ?? 'honolus'; }
    protected key(kind: string, key: string): string { return `${this.namespace}:${kind}:${key}`; }
}

export class RedisCacheStore extends RedisStoreBase implements CacheStore {
    public async get<T extends CacheValue = CacheValue>(key: string): Promise<T | undefined> {
        const value = await this.options.client.sendCommand(['GET', this.key('cache', key)]);
        return value === null || value === undefined ? undefined : decode(String(value)) as T;
    }
    public async set(key: string, value: CacheValue, options: { ttlMs?: number } = {}): Promise<void> {
        const command = ['SET', this.key('cache', key), encode(value)];
        if (options.ttlMs !== undefined) command.push('PX', ttl(options.ttlMs));
        await this.options.client.sendCommand(command);
    }
    public async delete(key: string): Promise<void> { await this.options.client.sendCommand(['DEL', this.key('cache', key)]); }
}

export class RedisSessionStore<T = Record<string, unknown>> extends RedisStoreBase implements SessionStore<T> {
    public async get(id: string): Promise<T | undefined> { const value = await this.options.client.sendCommand(['GET', this.key('session', id)]); return value === null || value === undefined ? undefined : JSON.parse(String(value)) as T; }
    public async set(id: string, value: T, options: { ttlMs?: number } = {}): Promise<void> { const command = ['SET', this.key('session', id), JSON.stringify(value)]; if (options.ttlMs !== undefined) command.push('PX', ttl(options.ttlMs)); await this.options.client.sendCommand(command); }
    public async revoke(id: string): Promise<void> { await this.options.client.sendCommand(['DEL', this.key('session', id)]); }
}

export class RedisRateLimitStore extends RedisStoreBase implements RateLimitStore {
    public async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
        const result = await this.options.client.sendCommand(['EVAL', RATE_LIMIT_SCRIPT, '1', this.key('rate', key), ttl(windowMs)]);
        if (!Array.isArray(result) || result.length !== 2) throw new Error('Invalid Redis rate limit response');
        return { count: Number(result[0]), resetAt: Date.now() + Number(result[1]) };
    }
}

export class RedisLockStore extends RedisStoreBase implements LockStore {
    public async acquire(key: string, options: { ttlMs?: number } = {}): Promise<string | undefined> {
        const token = crypto.randomUUID();
        const result = await this.options.client.sendCommand(['SET', this.key('lock', key), token, 'NX', 'PX', ttl(options.ttlMs ?? 30_000)]);
        return result === null || result === undefined ? undefined : token;
    }
    public async release(key: string, token: string): Promise<void> { await this.options.client.sendCommand(['EVAL', RELEASE_SCRIPT, '1', this.key('lock', key), token]); }
}

const RATE_LIMIT_SCRIPT = `local count=redis.call('INCR',KEYS[1]);if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end;local remaining=redis.call('PTTL',KEYS[1]);return {count,remaining}`;
const RELEASE_SCRIPT = `if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end`;
function ttl(value: number): string { if (!Number.isInteger(value) || value < 1) throw new RangeError('ttlMs must be a positive integer'); return String(value); }
function encode(value: CacheValue): string { if (value instanceof Uint8Array) return `b:${Buffer.from(value).toString('base64')}`; return `j:${JSON.stringify(value)}`; }
function decode(value: string): CacheValue { if (value.startsWith('b:')) return new Uint8Array(Buffer.from(value.slice(2), 'base64')); if (value.startsWith('j:')) return JSON.parse(value.slice(2)) as CacheValue; throw new Error('Invalid Redis cache value'); }

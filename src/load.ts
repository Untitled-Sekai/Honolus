import type { SqlExecutor } from './db';
import type { DatabaseSeed, SonolusItemMap, SonolusRepository } from './db';

export function generateLoadSeed(count: number, seed = 1): DatabaseSeed {
    if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a non-negative integer');
    const random = mulberry32(seed); const levels: SonolusItemMap['level'][] = [];
    for (let index = 0; index < count; index++) { const name = `load-${String(index).padStart(8, '0')}`; const resource = { hash: null, url: null }; levels.push({ name, version: 1, rating: Math.floor(random() * 50) + 1, title: { en: `Load Level ${index}` }, artists: { en: `Artist ${Math.floor(random() * 100)}` }, author: { en: `Author ${Math.floor(random() * 1000)}` }, tags: [{ title: { en: `tag-${index % 20}` } }], engine: 'engine', useSkin: { useDefault: true }, useBackground: { useDefault: true }, useEffect: { useDefault: true }, useParticle: { useDefault: true }, cover: resource, bgm: resource, data: resource }); }
    return { level: levels };
}

export async function benchmarkRepository<T extends keyof import('./db').SonolusItemMap>(repository: SonolusRepository<T>, options: { iterations?: number; pageSize?: number } = {}): Promise<{ samplesMs: number[]; p50Ms: number; p95Ms: number; p99Ms: number }> {
    const samples = []; const iterations = options.iterations ?? 100;
    for (let index = 0; index < iterations; index++) { const started = performance.now(); await repository.list({ page: { limit: options.pageSize ?? 20 }, includeTotalCount: false }); samples.push(performance.now() - started); }
    samples.sort((a, b) => a - b); return { samplesMs: samples, p50Ms: percentile(samples, .5), p95Ms: percentile(samples, .95), p99Ms: percentile(samples, .99) };
}

export class FaultInjectingSqlExecutor implements SqlExecutor {
    private calls = 0;
    public constructor(private readonly executor: SqlExecutor, private readonly options: { failEvery?: number; delayMs?: number } = {}) {}
    public async query<T extends object = Record<string, unknown>>(sql: string, parameters?: readonly unknown[]): Promise<{ rows: T[] }> { this.calls++; if (this.options.delayMs) await new Promise((resolve) => setTimeout(resolve, this.options.delayMs)); if (this.options.failEvery && this.calls % this.options.failEvery === 0) throw new Error('Injected SQL failure'); return this.executor.query<T>(sql, parameters); }
    public transaction<T>(callback: (executor: SqlExecutor) => Promise<T>): Promise<T> { if (!this.executor.transaction) return callback(this); return this.executor.transaction((executor) => callback(new FaultInjectingSqlExecutor(executor, this.options))); }
    public close(): Promise<void> { return this.executor.close?.() ?? Promise.resolve(); }
}

function percentile(values: number[], value: number): number { return values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * value) - 1)] : 0; }
function mulberry32(seed: number): () => number { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }

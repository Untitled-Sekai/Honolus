import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { MemorySonolusDatabase } from './memory';
import type { JsonDatabaseOptions, PageResult, SonolusDatabase, SonolusItem, SonolusItemType, SonolusQuery, SonolusRepository } from './type';

type JsonDocument = {
    version: 1;
    items: Partial<Record<SonolusItemType, SonolusItem[]>>;
};

export class JsonSonolusDatabase implements SonolusDatabase {
    private readonly memory: MemorySonolusDatabase;
    private readonly mode: 'readonly' | 'readwrite';
    private initialized: Promise<void>;

    public constructor(private readonly options: JsonDatabaseOptions) {
        this.memory = new MemorySonolusDatabase();
        this.mode = options.mode ?? 'readwrite';
        this.initialized = this.load(options.seed);
    }

    public repository<T extends SonolusItemType>(type: T): SonolusRepository<T> {
        return new JsonSonolusRepository(this, type);
    }

    public async close(): Promise<void> {
        await this.initialized;
    }

    public async get<T extends SonolusItemType>(type: T, name: string) {
        await this.initialized;
        return this.memory.repository(type).get(name);
    }

    public async list<T extends SonolusItemType>(type: T, query?: SonolusQuery<T>): Promise<PageResult<SonolusItemMapFor<T>>> {
        await this.initialized;
        return this.memory.repository(type).list(query) as Promise<PageResult<SonolusItemMapFor<T>>>;
    }

    public async put<T extends SonolusItemType>(type: T, item: SonolusItemMapFor<T>): Promise<void> {
        await this.initialized;
        if (this.mode === 'readonly') throw new Error('Cannot write to a readonly JSON database');
        await this.memory.repository(type).put(item);
        await this.save();
    }

    public async delete<T extends SonolusItemType>(type: T, name: string): Promise<boolean> {
        await this.initialized;
        if (this.mode === 'readonly') throw new Error('Cannot write to a readonly JSON database');
        const deleted = await this.memory.repository(type).delete(name);
        if (deleted) await this.save();
        return deleted;
    }

    private async load(seed: JsonDatabaseOptions['seed']): Promise<void> {
        try {
            const document = JSON.parse(await readFile(this.options.path, 'utf8')) as JsonDocument;
            if (document.version !== 1 || typeof document.items !== 'object' || document.items === null) throw new Error('Invalid JSON database document');
            for (const [type, items] of Object.entries(document.items)) {
                if (items === undefined) continue;
                if (!isItemType(type)) throw new Error(`Invalid item type in JSON database: ${type}`);
                if (!Array.isArray(items)) throw new Error(`Items for ${type} must be an array`);
                for (const item of items) this.memory.putUnknown(item);
            }
        } catch (error) {
            if (!isNotFound(error) || this.mode === 'readonly') throw error;
            if (seed) this.addSeed(seed);
            await this.save();
            return;
        }
        if (seed) throw new Error('JSON database already exists; seed is only allowed for a new file');
    }

    private addSeed(seed: NonNullable<JsonDatabaseOptions['seed']>): void {
        if (Array.isArray(seed)) {
            for (const item of seed) this.memory.putUnknown(item);
            return;
        }
        for (const items of Object.values(seed)) {
            for (const item of items ?? []) this.memory.putUnknown(item);
        }
    }

    private async save(): Promise<void> {
        const document: JsonDocument = { version: 1, items: {} };
        for (const type of itemTypes) document.items[type] = this.memory.values(type);
        await mkdir(dirname(this.options.path), { recursive: true });
        const temporaryPath = `${this.options.path}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
        await rename(temporaryPath, this.options.path);
    }
}

class JsonSonolusRepository<T extends SonolusItemType> implements SonolusRepository<T> {
    public constructor(private readonly database: JsonSonolusDatabase, private readonly type: T) {}
    public get(name: string) { return this.database.get(this.type, name); }
    public list(query?: SonolusQuery<T>) { return this.database.list(this.type, query); }
    public put(item: SonolusItemMapFor<T>) { return this.database.put(this.type, item); }
    public delete(name: string) { return this.database.delete(this.type, name); }
    public async count(query?: Omit<SonolusQuery<T>, 'page' | 'orderBy'>) { return (await this.list(query)).totalCount; }
}

import type { SonolusItemMap } from './type';
type SonolusItemMapFor<T extends SonolusItemType> = SonolusItemMap[T];
const itemTypes: SonolusItemType[] = ['post', 'playlist', 'level', 'skin', 'background', 'effect', 'particle', 'engine', 'replay'];
function isItemType(value: string): value is SonolusItemType { return itemTypes.includes(value as SonolusItemType); }
function isNotFound(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'; }

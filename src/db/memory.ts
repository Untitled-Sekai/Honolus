import { itemSchemas, validateItem } from './schema';
import type { DatabaseSeed, PageResult, SonolusDatabase, SonolusItem, SonolusItemMap, SonolusItemType, SonolusQuery, SonolusRepository } from './type';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class MemorySonolusDatabase implements SonolusDatabase {
    private readonly stores = new Map<SonolusItemType, Map<string, SonolusItem>>();

    public constructor(seed?: DatabaseSeed | SonolusItem[]) {
        for (const type of itemTypes) this.stores.set(type, new Map());
        if (Array.isArray(seed)) {
            for (const item of seed) this.putUnknown(item);
        } else if (seed) {
            for (const type of itemTypes) {
                for (const item of seed[type] ?? []) this.putUnknown(item);
            }
        }
    }

    public repository<T extends SonolusItemType>(type: T): SonolusRepository<T> {
        return new MemorySonolusRepository(this, type);
    }

    public close(): Promise<void> {
        return Promise.resolve();
    }

    public getUnknown(type: SonolusItemType, name: string): SonolusItem | undefined {
        return this.stores.get(type)?.get(name);
    }

    public values<T extends SonolusItemType>(type: T): SonolusItemMap[T][] {
        return [...(this.stores.get(type)?.values() ?? [])] as SonolusItemMap[T][];
    }

    public putUnknown(item: SonolusItem): void {
        const type = findItemType(item);
        validateItem(type, item);
        this.stores.get(type)!.set(item.name, item);
    }

    public deleteUnknown(type: SonolusItemType, name: string): boolean {
        return this.stores.get(type)!.delete(name);
    }
}

class MemorySonolusRepository<T extends SonolusItemType> implements SonolusRepository<T> {
    public constructor(private readonly database: MemorySonolusDatabase, private readonly type: T) {}

    public async get(name: string): Promise<SonolusItemMap[T] | undefined> {
        return this.database.getUnknown(this.type, name) as SonolusItemMap[T] | undefined;
    }

    public async list(query: SonolusQuery<T> = {}): Promise<PageResult<SonolusItemMap[T]>> {
        const filtered = this.database.values(this.type).filter((item) => matches(item, query));
        sortItems(filtered, query);
        const offset = decodeCursor(query.page?.cursor);
        const limit = normalizeLimit(query.page?.limit);
        const items = filtered.slice(offset, offset + limit);
        const nextOffset = offset + items.length;
        return {
            items,
            totalCount: filtered.length,
            ...(nextOffset < filtered.length ? { nextCursor: encodeCursor(nextOffset) } : {}),
        };
    }

    public async put(item: SonolusItemMap[T]): Promise<void> {
        validateItem(this.type, item);
        this.database.putUnknown(item);
    }

    public async delete(name: string): Promise<boolean> {
        return this.database.deleteUnknown(this.type, name);
    }

    public async count(query: Omit<SonolusQuery<T>, 'page' | 'orderBy'> = {}): Promise<number> {
        return (await this.list(query)).totalCount;
    }
}

const itemTypes: SonolusItemType[] = ['post', 'playlist', 'level', 'skin', 'background', 'effect', 'particle', 'engine', 'replay'];

function findItemType(item: SonolusItem): SonolusItemType {
    for (const type of itemTypes) {
        if (itemSchemas[type].safeParse(item).success) return type;
    }
    throw new Error(`Unable to determine item type for ${item.name}`);
}

function matches<T extends SonolusItemType>(item: SonolusItemMap[T], query: SonolusQuery<T>): boolean {
    const where = query.where;
    if (where?.name) {
        const condition = where.name;
        if (condition.equals !== undefined && item.name !== condition.equals) return false;
        if (condition.startsWith !== undefined && !item.name.startsWith(condition.startsWith)) return false;
        if (condition.in !== undefined && !condition.in.includes(item.name)) return false;
    }
    if (where?.title?.contains && !textOf(item.title).toLocaleLowerCase().includes(where.title.contains.toLocaleLowerCase())) return false;
    if (where?.author?.contains && !textOf(item.author).toLocaleLowerCase().includes(where.author.contains.toLocaleLowerCase())) return false;
    if (where?.rating && ('rating' in item)) {
        if (where.rating.min !== undefined && item.rating < where.rating.min) return false;
        if (where.rating.max !== undefined && item.rating > where.rating.max) return false;
    }
    const haystack = textOf(item).toLocaleLowerCase();
    if (query.search && !haystack.includes(query.search.toLocaleLowerCase())) return false;
    if (query.tags?.some((tag) => !textOf(item.tags).toLocaleLowerCase().includes(tag.toLocaleLowerCase()))) return false;
    return true;
}

function sortItems<T extends SonolusItemType>(items: SonolusItemMap[T][], query: SonolusQuery<T>): void {
    const order = [...(query.orderBy ?? []), { field: 'name' as const, direction: 'asc' as const }];
    items.sort((left, right) => {
        for (const criterion of order) {
            const a = sortableValue(left, criterion.field);
            const b = sortableValue(right, criterion.field);
            if (a === b) continue;
            const result = a < b ? -1 : 1;
            return criterion.direction === 'desc' ? -result : result;
        }
        return 0;
    });
}

function sortableValue(item: SonolusItem, field: string): string | number {
    if (field === 'name') return item.name;
    if (field === 'title') return textOf(item.title).toLocaleLowerCase();
    if (field === 'author') return textOf(item.author).toLocaleLowerCase();
    if (field === 'time' && 'time' in item) return item.time;
    if (field === 'rating' && 'rating' in item) return item.rating;
    return '';
}

function textOf(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value !== 'object' || value === null) return '';
    return Object.values(value).map(textOf).join(' ');
}

function normalizeLimit(limit = DEFAULT_LIMIT): number {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new RangeError(`page.limit must be an integer between 1 and ${MAX_LIMIT}`);
    return limit;
}

function encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): number {
    if (!cursor) return 0;
    try {
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: unknown };
        if (typeof value.offset !== 'number' || !Number.isInteger(value.offset) || value.offset < 0) throw new Error();
        return value.offset;
    } catch {
        throw new Error('Invalid pagination cursor');
    }
}

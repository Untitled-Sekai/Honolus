import { itemSchemas, validateItem } from './schema';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PageResult, SonolusDatabase, SonolusItemMap, SonolusItemType, SonolusQuery, SonolusRepository } from './type';

export type SqlRow = { type: SonolusItemType; name: string; payload: unknown };

export interface SqlExecutor {
    query<T extends object = Record<string, unknown>>(sql: string, parameters?: readonly unknown[]): Promise<{ rows: T[] }>;
    transaction?<T>(callback: (executor: SqlExecutor) => Promise<T>): Promise<T>;
    close?(): Promise<void>;
}

export type SqlDatabaseOptions = {
    driver: 'sql';
    executor: SqlExecutor;
    /** Name of the table. It must be a trusted identifier, not user input. */
    tableName?: string;
    autoMigrate?: boolean;
    /** HMAC secret for tamper-resistant cursors. Required for production-facing pagination. */
    cursorSecret?: string;
};

export class SqlSonolusDatabase implements SonolusDatabase {
    private readonly tableName: string;
    private initialized: Promise<void>;

    public constructor(private readonly options: SqlDatabaseOptions) {
        this.tableName = options.tableName ?? 'sonolus_items';
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(this.tableName)) throw new Error('Invalid SQL table name');
        this.initialized = options.autoMigrate === false ? Promise.resolve() : this.migrate();
    }

    public repository<T extends SonolusItemType>(type: T): SonolusRepository<T> {
        return new SqlSonolusRepository(this, type);
    }

    public async ready(): Promise<void> {
        await this.initialized;
    }

    public async migrate(): Promise<void> {
        await this.options.executor.query(`CREATE TABLE IF NOT EXISTS ${this.tableName} (type TEXT NOT NULL, name TEXT NOT NULL, title TEXT, author TEXT, rating DOUBLE PRECISION, time BIGINT, tags TEXT[] NOT NULL DEFAULT '{}', payload JSONB NOT NULL, version BIGINT NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (type, name))`);
        for (const column of ['title TEXT', 'author TEXT', 'rating DOUBLE PRECISION', 'time BIGINT', `tags TEXT[] NOT NULL DEFAULT '{}'`, 'version BIGINT NOT NULL DEFAULT 1']) {
            await this.options.executor.query(`ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS ${column}`);
        }
        await this.options.executor.query(`CREATE INDEX IF NOT EXISTS ${this.tableName}_list_idx ON ${this.tableName} (type, name)`);
        await this.options.executor.query(`CREATE INDEX IF NOT EXISTS ${this.tableName}_rating_idx ON ${this.tableName} (type, rating DESC, name)`);
        await this.options.executor.query(`CREATE INDEX IF NOT EXISTS ${this.tableName}_time_idx ON ${this.tableName} (type, time DESC, name)`);
    }

    public async transaction<T>(callback: (database: SonolusDatabase) => Promise<T>): Promise<T> {
        await this.initialized;
        if (!this.options.executor.transaction) return callback(this);
        return this.options.executor.transaction(async (executor) => callback(new SqlSonolusDatabase({ ...this.options, executor, autoMigrate: false })));
    }

    public async close(): Promise<void> {
        await this.initialized;
        await this.options.executor.close?.();
    }

    public async get<T extends SonolusItemType>(type: T, name: string): Promise<SonolusItemMap[T] | undefined> {
        await this.initialized;
        const result = await this.options.executor.query<SqlRow>(`SELECT type, name, payload FROM ${this.tableName} WHERE type = $1 AND name = $2`, [type, name]);
        return result.rows[0] ? parseRow(type, result.rows[0]) : undefined;
    }

    public async list<T extends SonolusItemType>(type: T, query: SonolusQuery<T> = {}): Promise<PageResult<SonolusItemMap[T]>> {
        await this.initialized;
        validateQuery(query);
        const parameters: unknown[] = [type];
        const conditions = ['type = $1'];
        addWhere(conditions, parameters, query);
        const order = [...(query.orderBy ?? []).map((item) => ({ field: item.field, direction: item.direction ?? 'asc' as const })), { field: 'name' as const, direction: 'asc' as const }];
        const limit = normalizeLimit(query.page?.limit);
        const fingerprint = queryFingerprint(type, query);
        const cursor = decodeCursor(query.page?.cursor, this.options.cursorSecret);
        if (cursor) addCursorCondition(conditions, parameters, cursor, order, fingerprint);
        parameters.push(limit + 1);
        const result = await this.options.executor.query<SqlRow>(`SELECT type, name, payload FROM ${this.tableName} WHERE ${conditions.join(' AND ')} ORDER BY ${order.map((item) => orderExpression(item.field, item.direction)).join(', ')} LIMIT $${parameters.length}`, parameters);
        const hasNext = result.rows.length > limit;
        const rows = result.rows.slice(0, limit);
        const items = rows.map((row) => parseRow(type, row));
        return { items, ...(query.includeTotalCount === false ? {} : { totalCount: await this.count(type, query) }), ...(hasNext && rows.length ? { nextCursor: encodeCursor(items[items.length - 1] as unknown as Record<string, unknown>, order, fingerprint, this.options.cursorSecret) } : {}) };
    }

    public async count<T extends SonolusItemType>(type: T, query: Omit<SonolusQuery<T>, 'page' | 'orderBy'> = {}): Promise<number> {
        await this.initialized;
        const parameters: unknown[] = [type];
        const conditions = ['type = $1'];
        addWhere(conditions, parameters, query);
        const result = await this.options.executor.query<{ count: string | number }>(`SELECT COUNT(*) AS count FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`, parameters);
        return Number(result.rows[0]?.count ?? 0);
    }

    public async put<T extends SonolusItemType>(type: T, item: SonolusItemMap[T]): Promise<void> {
        await this.initialized;
        validateItem(type, item);
        const indexed = indexedValues(item as unknown as Record<string, unknown>);
        await this.options.executor.query(`INSERT INTO ${this.tableName} (type, name, title, author, rating, time, tags, payload, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP) ON CONFLICT (type, name) DO UPDATE SET title = EXCLUDED.title, author = EXCLUDED.author, rating = EXCLUDED.rating, time = EXCLUDED.time, tags = EXCLUDED.tags, payload = EXCLUDED.payload, version = ${this.tableName}.version + 1, updated_at = CURRENT_TIMESTAMP`, [type, item.name, indexed.title, indexed.author, indexed.rating, indexed.time, indexed.tags, JSON.stringify(item)]);
    }

    public async delete<T extends SonolusItemType>(type: T, name: string): Promise<boolean> {
        await this.initialized;
        const result = await this.options.executor.query<{ count?: string | number }>(`DELETE FROM ${this.tableName} WHERE type = $1 AND name = $2 RETURNING name`, [type, name]);
        return result.rows.length > 0;
    }
}

class SqlSonolusRepository<T extends SonolusItemType> implements SonolusRepository<T> {
    public constructor(private readonly database: SqlSonolusDatabase, private readonly type: T) {}
    public get(name: string) { return this.database.get(this.type, name); }
    public list(query?: SonolusQuery<T>) { return this.database.list(this.type, query); }
    public put(item: SonolusItemMap[T]) { return this.database.put(this.type, item); }
    public delete(name: string) { return this.database.delete(this.type, name); }
    public count(query?: Omit<SonolusQuery<T>, 'page' | 'orderBy'>) { return this.database.count(this.type, query); }
}

function parseRow<T extends SonolusItemType>(type: T, row: SqlRow): SonolusItemMap[T] {
    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    validateItem(type, payload);
    return payload as SonolusItemMap[T];
}

function addWhere(conditions: string[], parameters: unknown[], query: SonolusQuery): void {
    if (query.where?.name?.equals !== undefined) {
        parameters.push(query.where.name.equals);
        conditions.push(`name = $${parameters.length}`);
    }
    if (query.where?.name?.startsWith !== undefined) {
        parameters.push(`${query.where.name.startsWith}%`);
        conditions.push(`name LIKE $${parameters.length}`);
    }
    if (query.where?.name?.in?.length) {
        parameters.push(query.where.name.in);
        conditions.push(`name = ANY($${parameters.length})`);
    }
    if (query.search) {
        parameters.push(`%${query.search}%`);
        conditions.push(`(title ILIKE $${parameters.length} OR author ILIKE $${parameters.length} OR payload::text ILIKE $${parameters.length})`);
    }
    if (query.where?.title?.contains !== undefined) {
        parameters.push(`%${query.where.title.contains}%`);
        conditions.push(`title ILIKE $${parameters.length}`);
    }
    if (query.where?.author?.contains !== undefined) {
        parameters.push(`%${query.where.author.contains}%`);
        conditions.push(`author ILIKE $${parameters.length}`);
    }
    if (query.where?.rating?.min !== undefined) {
        parameters.push(query.where.rating.min);
        conditions.push(`rating >= $${parameters.length}`);
    }
    if (query.where?.rating?.max !== undefined) {
        parameters.push(query.where.rating.max);
        conditions.push(`rating <= $${parameters.length}`);
    }
    for (const tag of query.tags ?? []) {
        parameters.push(tag.toLocaleLowerCase());
        conditions.push(`$${parameters.length} = ANY(tags)`);
    }
}

function addCursorCondition(
    conditions: string[],
    parameters: unknown[],
    cursor: Cursor,
    order: Array<{ field: string; direction: 'asc' | 'desc' }>,
    fingerprint: string,
): void {
    if (cursor.fingerprint !== fingerprint || JSON.stringify(cursor.order) !== JSON.stringify(order) || cursor.values.length !== order.length) throw new Error('Pagination cursor does not match query');
    const parts: string[] = [];
    for (let index = 0; index < order.length; index += 1) {
        const equals: string[] = [];
        for (let previous = 0; previous < index; previous += 1) {
            parameters.push(cursor.values[previous]);
            equals.push(`${sqlExpression(order[previous].field)} = $${parameters.length}`);
        }
        parameters.push(cursor.values[index]);
        const operator = order[index].direction === 'desc' ? '<' : '>';
        parts.push(`(${equals.length ? `${equals.join(' AND ')} AND ` : ''}${sqlExpression(order[index].field)} ${operator} $${parameters.length})`);
    }
    conditions.push(`(${parts.join(' OR ')})`);
}

function orderExpression(field: string, direction = 'asc'): string {
    return `${sqlExpression(field)} ${direction === 'desc' ? 'DESC' : 'ASC'}`;
}

function sqlExpression(field: string): string {
    return field === 'name' ? 'name' : field;
}

function normalizeLimit(limit = 20): number {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('page.limit must be an integer between 1 and 100');
    return limit;
}

function validateQuery(query: SonolusQuery): void {
    if (query.search && query.search.length > 256) throw new RangeError('query.search must be at most 256 characters');
    if ((query.tags?.length ?? 0) > 20) throw new RangeError('query.tags must contain at most 20 values');
    if ((query.where?.name?.in?.length ?? 0) > 1000) throw new RangeError('where.name.in must contain at most 1000 values');
}

type Cursor = { version: 1; fingerprint: string; order: Array<{ field: string; direction: 'asc' | 'desc' }>; values: Array<string | number> };
function encodeCursor(item: Record<string, unknown>, order: Array<{ field: string; direction: 'asc' | 'desc' }>, fingerprint: string, secret?: string): string {
    const values = order.map(({ field }) => sortableValue(item, field));
    const payload = Buffer.from(JSON.stringify({ version: 1, fingerprint, order, values }), 'utf8').toString('base64url');
    return secret ? `${payload}.${sign(payload, secret)}` : payload;
}

function sortableValue(item: Record<string, unknown>, field: string): string | number {
    if (field === 'name') return String(item.name);
    if (field === 'rating' || field === 'time') return Number(item[field] ?? 0);
    if (field === 'title' || field === 'author') return textOf(item[field]).toLocaleLowerCase();
    const value = item[field];
    return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}
function decodeCursor(cursor?: string, secret?: string): Cursor | undefined {
    if (!cursor) return undefined;
    try {
        const [payload, signature] = cursor.split('.');
        if (secret && (!signature || !safeEqual(signature, sign(payload, secret)))) throw new Error();
        const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Cursor;
        if (value.version !== 1 || typeof value.fingerprint !== 'string' || !Array.isArray(value.order) || !Array.isArray(value.values) || value.order.length !== value.values.length) throw new Error();
        if (value.values.some((item) => typeof item !== 'string' && typeof item !== 'number')) throw new Error();
        return value;
    } catch { throw new Error('Invalid pagination cursor'); }
}

function sign(payload: string, secret: string): string { return createHmac('sha256', secret).update(payload).digest('base64url'); }
function safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left); const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}
function queryFingerprint(type: SonolusItemType, query: SonolusQuery): string {
    return createHmac('sha256', 'honolus-query-v1').update(JSON.stringify({ type, where: query.where, search: query.search, tags: query.tags })).digest('base64url').slice(0, 22);
}
function indexedValues(item: Record<string, unknown>) {
    return {
        title: textOf(item.title).toLocaleLowerCase(), author: textOf(item.author).toLocaleLowerCase(),
        rating: typeof item.rating === 'number' ? item.rating : null, time: typeof item.time === 'number' ? item.time : null,
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => textOf(tag).toLocaleLowerCase()) : [],
    };
}
function textOf(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value !== 'object' || value === null) return '';
    return Object.values(value).map(textOf).join(' ');
}

import { itemSchemas, validateItem } from './schema';
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
        await this.options.executor.query(`CREATE TABLE IF NOT EXISTS ${this.tableName} (type TEXT NOT NULL, name TEXT NOT NULL, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (type, name))`);
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
        const cursor = decodeCursor(query.page?.cursor);
        if (cursor) addCursorCondition(conditions, parameters, cursor, order);
        parameters.push(limit + 1);
        const result = await this.options.executor.query<SqlRow>(`SELECT type, name, payload FROM ${this.tableName} WHERE ${conditions.join(' AND ')} ORDER BY ${order.map((item) => orderExpression(item.field, item.direction)).join(', ')} LIMIT $${parameters.length}`, parameters);
        const hasNext = result.rows.length > limit;
        const rows = result.rows.slice(0, limit);
        const items = rows.map((row) => parseRow(type, row));
        return { items, totalCount: await this.count(type, query), ...(hasNext && rows.length ? { nextCursor: encodeCursor(items[items.length - 1] as unknown as Record<string, unknown>, order) } : {}) };
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
        await this.options.executor.query(`INSERT INTO ${this.tableName} (type, name, payload, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (type, name) DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP`, [type, item.name, JSON.stringify(item)]);
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
        conditions.push(`payload::text ILIKE $${parameters.length}`);
    }
    if (query.where?.title?.contains !== undefined) {
        parameters.push(`%${query.where.title.contains}%`);
        conditions.push(`payload::text ILIKE $${parameters.length}`);
    }
    if (query.where?.author?.contains !== undefined) {
        parameters.push(`%${query.where.author.contains}%`);
        conditions.push(`payload::text ILIKE $${parameters.length}`);
    }
    if (query.where?.rating?.min !== undefined) {
        parameters.push(query.where.rating.min);
        conditions.push(`(payload->>'rating')::numeric >= $${parameters.length}`);
    }
    if (query.where?.rating?.max !== undefined) {
        parameters.push(query.where.rating.max);
        conditions.push(`(payload->>'rating')::numeric <= $${parameters.length}`);
    }
    for (const tag of query.tags ?? []) {
        parameters.push(`%${tag}%`);
        conditions.push(`payload::text ILIKE $${parameters.length}`);
    }
}

function addCursorCondition(
    conditions: string[],
    parameters: unknown[],
    cursor: Cursor,
    order: Array<{ field: string; direction: 'asc' | 'desc' }>,
): void {
    if (JSON.stringify(cursor.order) !== JSON.stringify(order) || cursor.values.length !== order.length) throw new Error('Pagination cursor does not match query order');
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
    return field === 'name' ? 'name' : field === 'rating' || field === 'time' ? `(payload->>'${field}')::numeric` : `payload->>'${field}'`;
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

type Cursor = { order: Array<{ field: string; direction: 'asc' | 'desc' }>; values: Array<string | number> };
function encodeCursor(item: Record<string, unknown>, order: Array<{ field: string; direction: 'asc' | 'desc' }>): string {
    const values = order.map(({ field }) => sortableValue(item, field));
    return Buffer.from(JSON.stringify({ order, values }), 'utf8').toString('base64url');
}

function sortableValue(item: Record<string, unknown>, field: string): string | number {
    if (field === 'name') return String(item.name);
    if (field === 'rating' || field === 'time') return Number(item[field] ?? 0);
    const value = item[field];
    return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}
function decodeCursor(cursor?: string): Cursor | undefined {
    if (!cursor) return undefined;
    try {
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Cursor;
        if (!Array.isArray(value.order) || !Array.isArray(value.values) || value.order.length !== value.values.length) throw new Error();
        if (value.values.some((item) => typeof item !== 'string' && typeof item !== 'number')) throw new Error();
        return value;
    } catch { throw new Error('Invalid pagination cursor'); }
}

import { JsonSonolusDatabase } from './json';
import { MemorySonolusDatabase } from './memory';
import { SqlSonolusDatabase } from './sql';
import type { SonolusDatabase, SonolusDatabaseOptions } from './type';
export { SqlSonolusDatabase } from './sql';
export type { SqlDatabaseOptions, SqlExecutor, SqlRow } from './sql';
export { PostgresExecutor } from './postgres';
export type { PostgresExecutorOptions, PostgresPoolClientLike, PostgresPoolLike } from './postgres';

export function createSonolusDatabase(options: SonolusDatabaseOptions): SonolusDatabase {
    if (options.driver === 'memory') return new MemorySonolusDatabase(options.seed);
    if (options.driver === 'sql') return new SqlSonolusDatabase(options);
    return new JsonSonolusDatabase(options);
}

export { JsonSonolusDatabase } from './json';
export { MemorySonolusDatabase } from './memory';
export { itemSchemas, validateItem } from './schema';
export type {
    DatabaseSeed,
    ItemKey,
    JsonDatabaseOptions,
    MemoryDatabaseOptions,
    Page,
    PageResult,
    SonolusDatabase,
    SonolusDatabaseOptions,
    SonolusItem,
    SonolusItemMap,
    SonolusItemType,
    SonolusOrder,
    SonolusOrderField,
    SonolusQuery,
    SonolusRepository,
    SonolusWhere,
} from './type';

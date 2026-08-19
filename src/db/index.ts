import { JsonSonolusDatabase } from './json';
import { MemorySonolusDatabase } from './memory';
import type { SonolusDatabase, SonolusDatabaseOptions } from './type';

export function createSonolusDatabase(options: SonolusDatabaseOptions): SonolusDatabase {
    if (options.driver === 'memory') return new MemorySonolusDatabase(options.seed);
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

import { readFile, writeFile } from 'node:fs/promises';
import { itemSchemas } from './db';
import type { DatabaseSeed, SonolusDatabase, SonolusItem, SonolusItemType } from './db';

export async function seedDatabase(database: SonolusDatabase, seed: DatabaseSeed | SonolusItem[]): Promise<number> {
    const items: SonolusItem[] = Array.isArray(seed) ? seed : (Object.values(seed) as unknown as SonolusItem[][]).flat();
    for (const item of items) {
        const type = findType(item);
        await database.repository(type).put(item as never);
    }
    return items.length;
}

export async function readFixture(path: string): Promise<DatabaseSeed | SonolusItem[]> {
    return JSON.parse(await readFile(path, 'utf8')) as DatabaseSeed | SonolusItem[];
}

export async function writeFixture(path: string, seed: DatabaseSeed | SonolusItem[]): Promise<void> {
    await writeFile(path, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
}

export async function migrateDatabase(database: SonolusDatabase): Promise<void> {
    const migration = (database as SonolusDatabase & { migrate?: () => Promise<void> }).migrate;
    if (migration) await migration.call(database);
    else await database.ready?.();
}

function findType(item: SonolusItem): SonolusItemType {
    for (const type of ['post', 'playlist', 'level', 'skin', 'background', 'effect', 'particle', 'engine', 'replay'] as const) {
        if (itemSchemas[type].safeParse(item).success) return type;
    }
    throw new Error(`Unable to infer item type for ${item.name}`);
}

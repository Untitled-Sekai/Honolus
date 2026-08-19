import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { assertHash } from './file-assets';
import type { PackDocument, SonolusItem, SonolusItemType } from './type';

const databaseKeys: Record<SonolusItemType, keyof PackDocument> = {
    post: 'posts',
    playlist: 'playlists',
    level: 'levels',
    skin: 'skins',
    background: 'backgrounds',
    effect: 'effects',
    particle: 'particles',
    engine: 'engines',
    replay: 'replays',
};

export type DirectoryPack = {
    document: PackDocument;
    items: { type: SonolusItemType; item: SonolusItem }[];
    assets: { hash: string; data: Uint8Array }[];
};

export async function readDirectoryPack(directory: string): Promise<DirectoryPack> {
    const document = parseDocument(JSON.parse(await readFile(join(directory, 'db.json'), 'utf8')));
    const items: DirectoryPack['items'] = [];
    for (const type of itemTypes) {
        const key = databaseKeys[type];
        const values = document[key];
        if (!Array.isArray(values)) continue;
        for (const item of values) items.push({ type, item });
    }

    const repository = join(directory, 'repository');
    const names = await readdir(repository, { withFileTypes: true });
    const assets: DirectoryPack['assets'] = [];
    for (const entry of names) {
        if (!entry.isFile()) throw new Error(`Repository entry is not a regular file: ${entry.name}`);
        assertHash(entry.name);
        const data = await readFile(join(repository, entry.name));
        const actualHash = createHash('sha1').update(data).digest('hex');
        if (actualHash !== entry.name) throw new Error(`Repository hash mismatch: ${entry.name}`);
        assets.push({ hash: entry.name, data });
    }
    return { document, items, assets };
}

function parseDocument(value: unknown): PackDocument {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid Sonolus pack db.json');
    return value as PackDocument;
}

export const itemTypes: SonolusItemType[] = ['post', 'playlist', 'level', 'skin', 'background', 'effect', 'particle', 'engine', 'replay'];

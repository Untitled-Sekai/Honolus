import { readDirectoryPack } from './directory';
import { resolve } from 'node:path';
import type { SonolusPackImportResult, ImportSonolusPackOptions, SonolusItemType } from './type';
import type { SonolusItem } from '../db';
import { createHash } from 'node:crypto';

export async function importSonolusPack(options: ImportSonolusPackOptions): Promise<SonolusPackImportResult> {
    const sourcePath = options.source.type === 'directory'
        ? options.source.path
        : options.source.type === 'npm'
            ? await npmPackPath(options.source.packageName)
            : (() => { throw new Error(`Sonolus pack source "${options.source.type}" is not implemented yet`); })();
    const pack = await readDirectoryPack(sourcePath);
    const conflict = options.conflict ?? 'error';
    const publicRepositoryPath = normalizeRepositoryPath(options.publicRepositoryPath ?? '/sonolus/repository');
    let importedItems = 0;
    let skippedItems = 0;
    let importedAssets = 0;
    let skippedAssets = 0;
    const itemCounts: Partial<Record<SonolusItemType, number>> = {};
    const normalizedItems = pack.items.map(({ type, item }) => ({ type, item: normalizeItem(item, publicRepositoryPath) }));
    const availableAssets = new Set(pack.assets.map((asset) => asset.hash));
    for (const { item } of normalizedItems) {
        for (const hash of resourceHashes(item)) {
            if (!availableAssets.has(hash)) throw new Error(`Missing repository asset: ${hash}`);
        }
    }

    for (const { type, item: normalized } of normalizedItems) {
        const repository = options.database.repository(type);
        const existing = await repository.get(normalized.name);
        if (existing) {
            if (sameJson(existing, normalized)) {
                skippedItems++;
                continue;
            }
            if (conflict === 'error') throw new Error(`Item conflict for ${type}/${normalized.name}`);
            if (conflict === 'skip') {
                skippedItems++;
                continue;
            }
        }
        await repository.put(normalized as never);
        importedItems++;
        itemCounts[type] = (itemCounts[type] ?? 0) + 1;
    }

    for (const asset of pack.assets) {
        if (await options.assets.has(asset.hash)) {
            const existing = await readAsset(options.assets, asset.hash);
            const existingHash = createHash('sha1').update(existing).digest('hex');
            if (existingHash !== asset.hash) throw new Error(`Existing asset hash mismatch: ${asset.hash}`);
            skippedAssets++;
            continue;
        }
        await options.assets.put(asset.hash, asset.data);
        importedAssets++;
    }

    return {
        manifest: {
            source: sourcePath,
            importedAt: Date.now(),
            itemCounts,
            repositoryHashes: pack.assets.map((asset) => asset.hash),
        },
        importedItems,
        skippedItems,
        importedAssets,
        skippedAssets,
    };
}

async function npmPackPath(packageName: string): Promise<string> {
    const packageModule = await import(packageName) as { packPath?: unknown };
    if (typeof packageModule.packPath !== 'string') throw new Error(`npm pack source does not export packPath: ${packageName}`);
    return resolve(packageModule.packPath);
}

function resourceHashes(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(resourceHashes);
    if (typeof value !== 'object' || value === null) return [];
    const record = value as Record<string, unknown>;
    const own = typeof record.hash === 'string' ? [record.hash] : [];
    return own.concat(Object.values(record).flatMap(resourceHashes));
}

async function readAsset(store: ImportSonolusPackOptions['assets'], hash: string): Promise<Uint8Array> {
    const reader = (await store.open(hash)).getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const result = await reader.read();
        if (result.done) break;
        chunks.push(result.value);
        size += result.value.byteLength;
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return data;
}

function normalizeRepositoryPath(path: string): string {
    const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`;
    if (!normalized || normalized === '/') throw new Error('publicRepositoryPath must not be empty');
    return normalized;
}

function normalizeItem<T extends SonolusItem>(item: T, publicRepositoryPath: string): T {
    return replaceResources(item, publicRepositoryPath) as T;
}

function replaceResources(value: unknown, publicRepositoryPath: string): unknown {
    if (Array.isArray(value)) return value.map((entry) => replaceResources(entry, publicRepositoryPath));
    if (typeof value !== 'object' || value === null) return value;
    const record = value as Record<string, unknown>;
    if (typeof record.hash === 'string' && 'url' in record) {
        return { ...record, url: `${publicRepositoryPath}/${record.hash}` };
    }
    return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, replaceResources(entry, publicRepositoryPath)]));
}

function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

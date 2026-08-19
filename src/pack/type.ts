import type { SonolusDatabase, SonolusItem, SonolusItemType } from '../db';
export type { SonolusItem, SonolusItemType } from '../db';

export type SonolusPackSource =
    | { type: 'directory'; path: string }
    | { type: 'scp'; path: string }
    | { type: 'npm'; packageName: string };

export type SonolusPackConflict = 'error' | 'skip' | 'replace';

export interface SonolusAssetStore {
    has(hash: string): Promise<boolean>;
    put(hash: string, data: Uint8Array): Promise<void>;
    open(hash: string): Promise<ReadableStream<Uint8Array>>;
}

export type ImportSonolusPackOptions = {
    source: SonolusPackSource;
    database: SonolusDatabase;
    assets: SonolusAssetStore;
    conflict?: SonolusPackConflict;
    publicRepositoryPath?: string;
};

export type SonolusPackManifest = {
    source: string;
    importedAt: number;
    itemCounts: Partial<Record<SonolusItemType, number>>;
    repositoryHashes: string[];
};

export type SonolusPackImportResult = {
    manifest: SonolusPackManifest;
    importedItems: number;
    skippedItems: number;
    importedAssets: number;
    skippedAssets: number;
};

export type PackDocument = {
    info?: unknown;
    posts?: SonolusItem[];
    playlists?: SonolusItem[];
    levels?: SonolusItem[];
    skins?: SonolusItem[];
    backgrounds?: SonolusItem[];
    effects?: SonolusItem[];
    particles?: SonolusItem[];
    engines?: SonolusItem[];
    replays?: SonolusItem[];
};

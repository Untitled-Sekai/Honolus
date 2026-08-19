import type {
    DatabaseBackgroundItem,
    DatabaseEffectItem,
    DatabaseEngineItem,
    DatabaseLevelItem,
    DatabaseParticleItem,
    DatabasePlaylistItem,
    DatabasePostItem,
    DatabaseReplayItem,
    DatabaseSkinItem,
} from '@sonolus/core';

export type SonolusItemMap = {
    post: DatabasePostItem;
    playlist: DatabasePlaylistItem;
    level: DatabaseLevelItem;
    skin: DatabaseSkinItem;
    background: DatabaseBackgroundItem;
    effect: DatabaseEffectItem;
    particle: DatabaseParticleItem;
    engine: DatabaseEngineItem;
    replay: DatabaseReplayItem;
};

export type SonolusItemType = keyof SonolusItemMap;
export type SonolusItem<T extends SonolusItemType = SonolusItemType> = SonolusItemMap[T];

export type ItemKey<T extends SonolusItemType = SonolusItemType> = {
    type: T;
    name: string;
};

export type Page = {
    limit: number;
    cursor?: string;
};

export type SonolusOrderField = 'name' | 'title' | 'author' | 'time' | 'rating';

export type SonolusOrder<T extends SonolusItemType = SonolusItemType> = {
    field: SonolusOrderField & (T extends 'level' ? unknown : Exclude<SonolusOrderField, 'rating' | 'time'>);
    direction?: 'asc' | 'desc';
};

export type SonolusWhere<T extends SonolusItemType = SonolusItemType> = {
    name?: { equals?: string; startsWith?: string; in?: string[] };
    title?: { contains?: string };
    author?: { contains?: string };
    rating?: T extends 'level' ? { min?: number; max?: number } : never;
};

export type SonolusQuery<T extends SonolusItemType = SonolusItemType> = {
    where?: SonolusWhere<T>;
    search?: string;
    /** Text fragments searched in the serialized DatabaseTag title/icon values. */
    tags?: string[];
    orderBy?: SonolusOrder<T>[];
    page?: Page;
};

export type PageResult<T> = {
    items: T[];
    nextCursor?: string;
    totalCount: number;
};

export interface SonolusRepository<T extends SonolusItemType> {
    get(name: string): Promise<SonolusItemMap[T] | undefined>;
    list(query?: SonolusQuery<T>): Promise<PageResult<SonolusItemMap[T]>>;
    put(item: SonolusItemMap[T]): Promise<void>;
    delete(name: string): Promise<boolean>;
    count(query?: Omit<SonolusQuery<T>, 'page' | 'orderBy'>): Promise<number>;
}

export interface SonolusDatabase {
    repository<T extends SonolusItemType>(type: T): SonolusRepository<T>;
    close(): Promise<void>;
}

export type DatabaseSeed = Partial<{
    [T in SonolusItemType]: SonolusItemMap[T][];
}>;

export type MemoryDatabaseOptions = {
    driver: 'memory';
    seed?: DatabaseSeed | SonolusItem[];
};

export type JsonDatabaseOptions = {
    driver: 'json';
    path: string;
    mode?: 'readonly' | 'readwrite';
    seed?: DatabaseSeed | SonolusItem[];
};

export type SonolusDatabaseOptions = MemoryDatabaseOptions | JsonDatabaseOptions;

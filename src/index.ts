import { Hono } from 'hono';
import { RouteRegistry, SonolusRoutes } from './api';
import { sonolusMiddleware, version_middleware } from './middleware';
import { SonolusSearchRegistry } from './search';

import { ScpArchive, scpStaticMiddleware } from './pack';

export { FileSonolusAssetStore, importSonolusPack, ScpArchive, scpStaticMiddleware } from './pack';
export type {
    ImportSonolusPackOptions,
    SonolusAssetStore,
    SonolusPackConflict,
    SonolusPackImportResult,
    SonolusPackManifest,
    SonolusPackSource,
} from './pack';

export { createSonolusDatabase } from './db';
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
} from './db';

export interface HonolusOptions {
    /** Prefix used for every Sonolus API endpoint. */
    basePath?: `/${string}`;
    /** Value returned in the Sonolus-Version response header. */
    version?: string;
    /** Mount a read-only .scp static pack as a fallback for Sonolus routes. */
    pack?: {
        type: 'scp';
        path: string;
        mode?: 'static';
    };
}

export class Honolus {
    private readonly app: Hono;
    public readonly route: SonolusRoutes;
    public readonly search: SonolusSearchRegistry;

    constructor(options: HonolusOptions = {}) {
        const basePath = normalizeBasePath(options.basePath ?? '/sonolus');

        this.app = new Hono();
        this.search = new SonolusSearchRegistry();
        this.app.use(
            `${basePath}/*`,
            sonolusMiddleware(
                options.version,
                (path) => this.search.resolve(path, basePath),
            ),
            version_middleware(),
        );
        if (options.pack?.type === 'scp') {
            const archive = ScpArchive.fromFile(options.pack.path);
            this.app.use(`${basePath}/*`, scpStaticMiddleware(archive, basePath));
        }
        this.route = new SonolusRoutes(new RouteRegistry(this.app, basePath));
    }

    public getApp(): Hono {
        return this.app;
    }
}

function normalizeBasePath(path: `/${string}`): string {
    if (path === '/') return '';
    return path.endsWith('/') ? path.slice(0, -1) : path;
}

export { SonolusContext } from './context';
export { SonolusSearchRegistry } from './search';
export type {
    RouteDecorator,
    RouteDefinition,
    RouteHandler,
    RouteHandlerConstructor,
    RouteHook,
    RouteMethod,
    RoutableItem,
    RoutableItemType,
} from './api';
export type {
    AnySearchValue,
    QuickSearchValue,
    RegisteredSearch,
    RegisteredSearchValue,
    SearchForm,
    SearchForms,
    SearchFormValue,
    SearchItemType,
    SearchSlot,
    SearchValue,
} from './search';

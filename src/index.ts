import { Hono } from 'hono';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { RouteRegistry, SonolusRoutes } from './api';
import { sonolusMiddleware, version_middleware } from './middleware';
import { SonolusSearchRegistry } from './search';

import { ScpArchive, directoryStaticMiddleware, scpStaticMiddleware } from './pack';
import type { SonolusAssetStore } from './pack';
import type { SonolusDatabase } from './db';
import { createDatabaseHandlers } from './api/server/item/database';

export { FileSonolusAssetStore, importSonolusPack, ScpArchive, directoryStaticMiddleware, scpStaticMiddleware } from './pack';
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
    database?: SonolusDatabase;
    assets?: SonolusAssetStore;
    pack?:
        | { type: 'scp'; path: string; mode?: 'static' }
        | { type: 'directory'; path: string; mode?: 'static' }
        | { type: 'npm'; packageName: string; mode?: 'static' };
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
                options.database,
                options.assets,
            ),
            version_middleware(),
        );
        if (options.pack?.type === 'scp') {
            const archive = ScpArchive.fromFile(options.pack.path);
            this.app.use(`${basePath}/*`, scpStaticMiddleware(archive, basePath));
        } else if (options.pack?.type === 'directory') {
            this.app.use(`${basePath}/*`, directoryStaticMiddleware(options.pack.path, basePath));
        } else if (options.pack?.type === 'npm') {
            const packageEntry = createRequire(__filename).resolve(options.pack.packageName);
            this.app.use(`${basePath}/*`, directoryStaticMiddleware(join(dirname(packageEntry), 'static'), basePath));
        }
        this.route = new SonolusRoutes(new RouteRegistry(this.app, basePath));
        if (options.database) registerDatabaseRoutes(this.route, options.database);
        if (options.assets) registerAssetRoute(this.app, basePath, options.assets);
    }

    public getApp(): Hono {
        return this.app;
    }
}

function registerDatabaseRoutes(routes: SonolusRoutes, database: SonolusDatabase): void {
    for (const type of ['post', 'playlist', 'level', 'skin', 'background', 'effect', 'particle', 'engine', 'replay'] as const) {
        const handlers = createDatabaseHandlers(type);
        const route = (routes.server as any)[type];
        route.info(handlers.info);
        route.list(handlers.list);
        route.detail(handlers.detail);
    }
}

function registerAssetRoute(app: Hono, basePath: string, assets: SonolusAssetStore): void {
    app.get(`${basePath}/repository/:hash`, async (context) => {
        const hash = context.req.param('hash') ?? '';
        try {
            if (!(await assets.has(hash))) return context.notFound();
            const stream = await assets.open(hash);
            return new Response(stream, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' } });
        } catch (error) {
            if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') return context.notFound();
            return context.notFound();
        }
    });
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

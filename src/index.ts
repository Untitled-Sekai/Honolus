import { Hono } from 'hono';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { RouteRegistry, SonolusRoutes } from './api';
import { error_middleware, observability_middleware, rate_limit_middleware, request_id_middleware, session_middleware, sonolusMiddleware, timeout_middleware, version_middleware } from './middleware';
import { SonolusSearchRegistry } from './search';

import { ScpArchive, directoryStaticMiddleware, scpStaticMiddleware } from './pack';
import type { SonolusAssetStore } from './pack';
import type { SonolusDatabase } from './db';
import { createDatabaseHandlers } from './api/server/item/database';
import { z } from 'zod';
import type { JobQueue } from './jobs';
import type { Logger, Metrics, Tracer } from './runtime';
import { respondError } from './error';
import { createOpenApiDocument, createRouteManifest } from './manifest';
import type { HonolusRouteManifest, OpenApiDocument } from './manifest';
import { SessionManager } from './auth';
import type { AuthOptions } from './auth';

export { FileSonolusAssetStore, S3SonolusAssetStore, importSonolusPack, ScpArchive, directoryStaticMiddleware, scpStaticMiddleware } from './pack';
export type {
    ImportSonolusPackOptions,
    SonolusAssetStore,
    SonolusPackConflict,
    SonolusPackImportResult,
    SonolusPackManifest,
    SonolusPackSource,
    S3AssetStoreOptions,
    S3ClientLike,
} from './pack';

export { createSonolusDatabase } from './db';
export { HonolusError, respondError } from './error';
export { createOpenApiDocument, createRouteManifest } from './manifest';
export type { HonolusRouteManifest, OpenApiDocument } from './manifest';
export { assertCompatibility, warnDeprecated, HONOLUS_COMPATIBILITY_VERSION } from './compatibility';
export type { DeprecationNotice } from './compatibility';
export { migrateDatabase, readFixture, seedDatabase, writeFixture } from './fixtures';
export { MemoryCacheStore, MemoryLockStore, MemoryMetrics, MemoryRateLimitStore, JsonConsoleLogger, NoopTracer } from './runtime';
export { MemoryJobQueue, PostgresJobQueue, PACK_IMPORT_JOB, enqueuePackImport, registerPackImportWorker } from './jobs';
export type { CacheStore, LockStore, Logger, Metrics, RateLimitStore, SessionStore, Span, Tracer } from './runtime';
export type { EnqueueOptions, JobQueue, JobRecord, JobHandler, JobState, PostgresJobQueueOptions } from './jobs';
export type { RateLimitOptions, ObservabilityOptions } from './middleware';
export type { HonolusErrorCode } from './error';
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
export type { SqlDatabaseOptions, SqlExecutor, SqlRow } from './db';
export { PostgresExecutor } from './db';
export type { PostgresExecutorOptions, PostgresPoolClientLike, PostgresPoolLike } from './db';
export { SessionManager, requirePermission, requirePolicy, requireRole, requireSession } from './auth';
export type { AuthOptions, AuthSession, AuthUser, GuardOptions, Policy } from './auth';
export { RedisCacheStore, RedisLockStore, RedisRateLimitStore, RedisSessionStore } from './redis';
export type { RedisClientLike, RedisStoreOptions } from './redis';
export { OutboxDispatcher, TransactionalOutbox } from './outbox';
export type { OutboxDispatcherOptions, OutboxEvent, OutboxWriter, TransactionalOutboxOptions } from './outbox';
export { benchmarkRepository, FaultInjectingSqlExecutor, generateLoadSeed } from './load';

export interface HonolusOptions {
    /** Prefix used for every Sonolus API endpoint. */
    basePath?: `/${string}`;
    /** Value returned in the Sonolus-Version response header. */
    version?: string;
    /** Mount a read-only .scp static pack as a fallback for Sonolus routes. */
    database?: SonolusDatabase;
    /** Register built-in database-backed item routes. Disable when using custom decorators. */
    databaseRoutes?: boolean;
    assets?: SonolusAssetStore;
    pack?:
        | { type: 'scp'; path: string; mode?: 'static' }
        | { type: 'directory'; path: string; mode?: 'static' }
        | { type: 'npm'; packageName: string; mode?: 'static' };
    health?: { enabled?: boolean };
    timeoutMs?: number;
    rateLimit?: import('./middleware').RateLimitOptions;
    observability?: { logger?: Logger; metrics?: Metrics; tracer?: Tracer };
    jobQueue?: JobQueue;
    readiness?: Array<{ name: string; ready(): Promise<void> }>;
    auth?: AuthOptions;
}

export class Honolus {
    private readonly app: Hono;
    public readonly route: SonolusRoutes;
    public readonly search: SonolusSearchRegistry;
    private readonly database?: SonolusDatabase;
    private readonly jobQueue?: JobQueue;
    private readonly routeRegistry: RouteRegistry;
    public readonly sessions?: SessionManager;
    private readonly readinessDependencies: Array<{ name: string; ready(): Promise<void> }>;
    private inflight = 0;
    private closing = false;
    private closePromise?: Promise<void>;

    public static async create(options: HonolusOptions = {}): Promise<Honolus> {
        const honolus = new Honolus(options);
        await honolus.ready();
        return honolus;
    }

    constructor(options: HonolusOptions = {}) {
        validateOptions(options);
        const basePath = normalizeBasePath(options.basePath ?? '/sonolus');

        this.app = new Hono();
        this.database = options.database;
        this.jobQueue = options.jobQueue;
        this.readinessDependencies = options.readiness ?? [];
        this.sessions = options.auth ? new SessionManager(options.auth) : undefined;
        this.app.onError((error, context) => respondError(context, error));
        this.app.use('*', async (context, next) => {
            if (this.closing) return context.json({ error: 'Server is shutting down', code: 'NOT_READY' }, 503);
            this.inflight++;
            try { await next(); } finally { this.inflight--; }
        });
        this.app.use('*', request_id_middleware(), error_middleware());
        if (this.sessions) this.app.use('*', session_middleware(this.sessions));
        if (options.observability) this.app.use('*', observability_middleware(options.observability));
        if (options.rateLimit) this.app.use('*', rate_limit_middleware(options.rateLimit));
        if (options.timeoutMs !== undefined) this.app.use('*', timeout_middleware(options.timeoutMs));
        this.app.get('/health/live', (context) => context.json({ status: 'ok', requestId: context.get('requestId') }));
        this.app.get('/health/ready', async (context) => {
            context.set('observabilityRoute', '/health/ready');
            try {
                await this.database?.ready?.();
                await this.jobQueue?.ready?.();
                await Promise.all(this.readinessDependencies.map((dependency) => dependency.ready()));
                return context.json({ status: 'ok', requestId: context.get('requestId') });
            } catch {
                return context.json({ status: 'not_ready', requestId: context.get('requestId') }, 503);
            }
        });
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
        this.routeRegistry = new RouteRegistry(this.app, basePath);
        this.route = new SonolusRoutes(this.routeRegistry);
        if (options.database && options.databaseRoutes !== false) registerDatabaseRoutes(this.route, options.database);
        if (options.assets) registerAssetRoute(this.app, basePath, options.assets);
    }

    public getApp(): Hono {
        return this.app;
    }

    public getRouteManifest(): HonolusRouteManifest {
        return createRouteManifest(this.routeRegistry.getRoutes());
    }

    public getOpenApiDocument(options: { title?: string; version?: string } = {}): OpenApiDocument {
        return createOpenApiDocument(this.routeRegistry.getRoutes(), options);
    }

    public async ready(): Promise<void> {
        await this.database?.ready?.();
        await this.jobQueue?.ready?.();
        await Promise.all(this.readinessDependencies.map((dependency) => dependency.ready()));
    }

    public async close(options: { gracePeriodMs?: number } = {}): Promise<void> {
        if (this.closePromise) return this.closePromise;
        this.closing = true;
        this.closePromise = this.performClose(options.gracePeriodMs ?? 30_000);
        return this.closePromise;
    }

    private async performClose(gracePeriodMs: number): Promise<void> {
        if (!Number.isInteger(gracePeriodMs) || gracePeriodMs < 0) throw new RangeError('gracePeriodMs must be a non-negative integer');
        const deadline = Date.now() + gracePeriodMs;
        while (this.inflight > 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
        await this.jobQueue?.close();
        await this.database?.close();
    }
}

function validateOptions(options: HonolusOptions): void {
    const result = z.object({
        basePath: z.string().regex(/^\//).optional(),
        version: z.string().min(1).optional(),
    }).safeParse(options);
    if (!result.success) throw new Error(`Invalid Honolus options: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
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
            const etag = `"${hash}"`;
            if (context.req.header('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'public, max-age=31536000, immutable' } });
            const stream = await assets.open(hash);
            return new Response(stream, { headers: { ETag: etag, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable', 'Surrogate-Control': 'public, max-age=31536000, immutable' } });
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
export { createTestContext } from './testing';
export type { TestContextOptions } from './testing';
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
export { defineHandler } from './api/registry';
export type { FunctionHandlerOptions, HandlerDependencies } from './api/registry';
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

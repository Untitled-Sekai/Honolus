import { SonolusContext } from './context';
import type { Context, Next } from 'hono';
import type { RegisteredSearch } from './search';
import type { SonolusDatabase } from './db';
import type { SonolusAssetStore } from './pack';
import { randomUUID } from 'node:crypto';
import { respondError } from './error';
import { HonolusError } from './error';
import type { Logger, Metrics, RateLimitStore, Tracer } from './runtime';
import type { AuthSession, AuthUser, SessionManager } from './auth';

export type RateLimitOptions = { limit: number; windowMs: number; store: RateLimitStore; key?: (context: Context) => string; trustProxy?: boolean };
export type ObservabilityOptions = { logger?: Logger; metrics?: Metrics; tracer?: Tracer };

export const sonolusMiddleware = (
    sonolusVersion = '1.1.3',
    resolveSearch?: (path: string) => RegisteredSearch | undefined,
    database?: SonolusDatabase,
    assets?: SonolusAssetStore,
) => {
    /**
     * SonolusContextをHonoのコンテキストに追加するミドルウェア
     * Middleware to add SonolusContext to Hono context
     */
    return async (c: Context, next: Next) => {
        const requestId = c.req.header('X-Request-Id') || randomUUID();
        c.set('requestId', requestId);
        c.header('X-Request-Id', requestId);
        c.sonolus = new SonolusContext(c, sonolusVersion, resolveSearch?.(c.req.path), database, assets);
        await next();
    };
};

export const version_middleware = () => {
    /**
     * Sonolusのバージョンヘッダーを付与するミドルウェア
     * Middleware to add Sonolus version header
     */
    return async (c: Context, next: Next) => {
        await next();

        c.header('Sonolus-Version', c.sonolus.version);
    }
}

export const error_middleware = () => async (c: Context, next: Next) => {
    try {
        await next();
    } catch (error) {
        return respondError(c, error);
    }
};

export const request_id_middleware = () => async (c: Context, next: Next) => {
    const requestId = c.req.header('X-Request-Id') || randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    await next();
};

export const session_middleware = (sessions: SessionManager) => async (c: Context, next: Next) => {
    const id = c.req.header('Sonolus-Session');
    if (id) {
        const session = await sessions.resolve(id);
        if (session) c.set('authSession', session);
    }
    await next();
};

export const timeout_middleware = (timeoutMs: number) => async (c: Context, next: Next) => {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new RangeError('timeoutMs must be a positive integer');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    c.set('requestAbortSignal', controller.signal);
    try {
        await Promise.race([
            next(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new HonolusError('INTERNAL_ERROR', 'Request timed out', 504)); }, timeoutMs); }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

export const rate_limit_middleware = (options: RateLimitOptions) => async (c: Context, next: Next) => {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.windowMs < 1) throw new RangeError('Invalid rate limit options');
    const forwarded = options.trustProxy ? c.req.header('X-Forwarded-For')?.split(',')[0].trim() : undefined;
    const key = options.key?.(c) ?? c.req.header('Sonolus-Session') ?? forwarded ?? 'anonymous';
    const result = await options.store.increment(key, options.windowMs);
    c.header('X-RateLimit-Limit', String(options.limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, options.limit - result.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    if (result.count > options.limit) {
        c.header('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))));
        throw new HonolusError('RATE_LIMITED', 'Too many requests');
    }
    await next();
};

export const observability_middleware = (options: ObservabilityOptions = {}) => async (c: Context, next: Next) => {
    const started = performance.now();
    const span = options.tracer?.startSpan('http.request', { 'http.method': c.req.method, 'http.route': c.req.path });
    let errorStatus: number | undefined;
    try {
        await next();
    } catch (error) {
        errorStatus = error instanceof HonolusError ? error.status : 500;
        throw error;
    } finally {
        const duration = performance.now() - started;
        const status = errorStatus ?? c.res.status;
        const route = c.get('observabilityRoute') ?? unmatchedRoute(c.req.path);
        const labels = { method: c.req.method, route, status: String(status) };
        options.metrics?.increment('http.requests.total', 1, labels);
        options.metrics?.observe('http.request.duration_ms', duration, labels);
        span?.setAttribute('http.status_code', status);
        span?.end();
        options.logger?.log(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', 'http.request', { requestId: c.get('requestId'), method: c.req.method, route, status, durationMs: Math.round(duration * 100) / 100 });
    }
};

declare module 'hono' {
    interface ContextVariableMap {
        requestId: string;
        requestAbortSignal: AbortSignal;
        observabilityRoute: string;
        authSession: AuthSession<AuthUser>;
    }
}

function unmatchedRoute(path: string): string { return path.split('/').map((part) => /^[a-f0-9]{16,}$/i.test(part) ? ':id' : part).join('/'); }

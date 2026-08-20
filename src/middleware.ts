import { SonolusContext } from './context';
import type { Context, Next } from 'hono';
import type { RegisteredSearch } from './search';
import type { SonolusDatabase } from './db';
import type { SonolusAssetStore } from './pack';
import { randomUUID } from 'node:crypto';
import { respondError } from './error';

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

declare module 'hono' {
    interface ContextVariableMap {
        requestId: string;
    }
}

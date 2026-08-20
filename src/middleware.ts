import { SonolusContext } from './context';
import type { Context, Next } from 'hono';
import type { RegisteredSearch } from './search';
import type { SonolusDatabase } from './db';
import type { SonolusAssetStore } from './pack';

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

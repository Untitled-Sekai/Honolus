import { SonolusContext } from './context';
import type { Context, Next } from 'hono';

export const sonolusMiddleware = (sonolusVersion = '1.1.3') => {
    /**
     * SonolusContextをHonoのコンテキストに追加するミドルウェア
     * Middleware to add SonolusContext to Hono context
     */
    return async (c: Context, next: Next) => {
        c.sonolus = new SonolusContext(c, sonolusVersion);
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

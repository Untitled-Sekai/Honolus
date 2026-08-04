import { SonolusContext } from './context';
import type { Context, Next } from 'hono';

export const sonolusMiddleware = () => {
    /**
     * SonolusContextをHonoのコンテキストに追加するミドルウェア
     * Middleware to add SonolusContext to Hono context
     */
  return async (c: Context, next: () => Promise<void>) => {
    c.sonolus = new SonolusContext(c);
    await next();
  };
};

export const version_middleware = () => {
    /**
     * Sonolusのバージョンヘッダーを付与するミドルウェア
     * Middleware to add Sonolus version header
     */
    return async (c: Context, next: Next) => {
        c.sonolus = new SonolusContext(c); 
        await next();

        if (c.req.path.startsWith('/sonolus') || true) {
            c.header('Sonolus-Version', c.sonolus.version);
        }
    }
}
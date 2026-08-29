import { Hono } from 'hono';
import { SonolusContext } from './context';
import type { AuthSession } from './auth';
import type { SonolusAssetStore } from './pack';
import type { SonolusDatabase } from './db';

export type TestContextOptions = { url?: string; method?: string; headers?: Record<string, string>; body?: string | Uint8Array; version?: string; database?: SonolusDatabase; assets?: SonolusAssetStore; authSession?: AuthSession };

export async function createTestContext(options: TestContextOptions = {}): Promise<SonolusContext> {
    const app = new Hono(); let result: SonolusContext | undefined;
    app.all('*', (context) => {
        context.set('requestId', 'test-request');
        if (options.authSession) context.set('authSession', options.authSession);
        result = new SonolusContext(context, options.version, undefined, options.database, options.assets);
        return context.body(null, 204);
    });
    await app.request(options.url ?? 'http://localhost/sonolus/info', { method: options.method ?? 'GET', headers: options.headers, body: options.body });
    if (!result) throw new Error('Unable to create test context');
    return result;
}

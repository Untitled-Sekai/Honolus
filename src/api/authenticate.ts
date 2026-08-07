import type { Context } from 'hono';
import { getSignaturePublicKey } from '@sonolus/core';
import { authenticateSchema } from '../type';

export async function authenticate(c: Context): Promise<Response | undefined> {
    /**
     * Sonolusの認証を行う関数
     * Function to perform Sonolus authentication
     * 
     * @param c Honoのコンテキスト / Hono context
     * @returns 検証失敗時のレスポンス。成功時はundefined。
     *          Error response on failure, or undefined on success.
     */
    const { subtle } = globalThis.crypto;
    const session = c.sonolus.session;
    const signature = c.sonolus.signature;

    if (!session || !signature) {
        return c.sonolus.error(400, 'Missing session or signature');
    }

    let body;
    try {
        const rawBody = await c.req.json();
        body = await authenticateSchema.parseAsync(rawBody);
    } catch {
        return c.sonolus.error(400, 'Invalid authentication request');
    }

    const signaturePublicKey = await getSignaturePublicKey();

    // TODO: 他の検証は後ほど実装

    if (body.time + 60 * 1000 < Date.now()) {
        return c.sonolus.error(400, 'Request expired');
    }

    let result = false;
    try {
        result = await subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            signaturePublicKey,
            Buffer.from(signature, 'base64'),
            Buffer.from(JSON.stringify(body)),
        );
    } catch {
        return c.sonolus.error(400, 'Invalid signature');
    }

    if (!result) {
        return c.sonolus.error(400, 'Invalid signature');
    }

    return undefined;
}

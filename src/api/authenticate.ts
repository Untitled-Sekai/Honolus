import type { Context } from 'hono';
import { SonolusContext } from '../context';
import {
    getSignaturePublicKey,
} from '@sonolus/core'
import { authenticateSchema } from '../type';


export async function authenticate(c: Context): Promise<boolean> {
    /**
     * Sonolusの認証を行う関数
     * Function to perform Sonolus authentication
     * 
     * @param c Honoのコンテキスト / Hono context
     * @returns 認証結果 boolean / Authentication result boolean
     */
    c.sonolus = new SonolusContext(c); 
    const { subtle } = globalThis.crypto;
    const session = c.sonolus.session;
    const signature = c.sonolus.signature;

    if (!session || !signature) {
        c.sonolus.error(401, 'Missing session or signature');
        return false;
    }

    const rawBody = await c.req.json();
    const body = await authenticateSchema.parseAsync(rawBody)
    const signaturePublicKey = await getSignaturePublicKey()

    // TODO: 他の検証は後ほど実装

    const result = await subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        signaturePublicKey,
        Buffer.from(signature, 'base64'),
        Buffer.from(JSON.stringify(body))
    )
    if (!result) {
        c.sonolus.error(401, 'Invalid signature');
        return false;
    }

    return true;
}
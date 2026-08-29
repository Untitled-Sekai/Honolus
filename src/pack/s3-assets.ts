import { createHash, randomUUID } from 'node:crypto';
import { assertHash } from './file-assets';
import type { SonolusAssetStore } from './type';

export interface S3ClientLike {
    head(key: string): Promise<{ exists: boolean; size?: number; lastModified?: Date }>;
    get(key: string): Promise<ReadableStream<Uint8Array>>;
    put(key: string, body: Uint8Array, options?: { contentType?: string }): Promise<void>;
    copy(source: string, destination: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(prefix: string): Promise<Array<{ key: string; lastModified?: Date }>>;
    createMultipart(key: string, options?: { contentType?: string }): Promise<string>;
    uploadPart(key: string, uploadId: string, partNumber: number, body: Uint8Array): Promise<{ etag: string }>;
    completeMultipart(key: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>): Promise<void>;
    abortMultipart(key: string, uploadId: string): Promise<void>;
    presignPut?(key: string, expiresInSeconds: number): Promise<string>;
}

export type S3AssetStoreOptions = { client: S3ClientLike; prefix?: string; multipartThresholdBytes?: number; partSizeBytes?: number };

export class S3SonolusAssetStore implements SonolusAssetStore {
    private readonly prefix: string; private readonly stagingPrefix: string;
    public constructor(private readonly options: S3AssetStoreOptions) { this.prefix = normalizePrefix(options.prefix ?? 'honolus/repository'); this.stagingPrefix = `${this.prefix}/.staging`; }
    public async has(hash: string): Promise<boolean> { assertHash(hash); return (await this.options.client.head(this.key(hash))).exists; }
    public async open(hash: string): Promise<ReadableStream<Uint8Array>> { assertHash(hash); return this.options.client.get(this.key(hash)); }
    public async put(hash: string, data: Uint8Array): Promise<void> {
        assertHash(hash); verifyHash(hash, data); if (await this.has(hash)) return;
        const staging = `${this.stagingPrefix}/${randomUUID()}`;
        await this.upload(staging, data);
        try { await this.options.client.copy(staging, this.key(hash)); } finally { await this.options.client.delete(staging).catch(() => undefined); }
    }
    public async createPresignedUpload(hash: string, expiresInSeconds = 900): Promise<{ key: string; url: string }> {
        assertHash(hash); if (!this.options.client.presignPut) throw new Error('S3 client does not support presigned uploads');
        const key = `${this.stagingPrefix}/${hash}-${randomUUID()}`; return { key, url: await this.options.client.presignPut(key, expiresInSeconds) };
    }
    public async commitStaged(hash: string, stagingKey: string): Promise<void> {
        assertHash(hash); if (!stagingKey.startsWith(`${this.stagingPrefix}/`)) throw new Error('Invalid staging key');
        const data = await readAll(await this.options.client.get(stagingKey)); verifyHash(hash, data);
        try { await this.options.client.copy(stagingKey, this.key(hash)); } finally { await this.options.client.delete(stagingKey).catch(() => undefined); }
    }
    public async collectStaleStaging(olderThanMs: number): Promise<number> {
        const cutoff = Date.now() - olderThanMs; let deleted = 0;
        for (const object of await this.options.client.list(`${this.stagingPrefix}/`)) if (object.lastModified && +object.lastModified < cutoff) { await this.options.client.delete(object.key); deleted++; }
        return deleted;
    }
    private key(hash: string): string { return `${this.prefix}/${hash}`; }
    private async upload(key: string, data: Uint8Array): Promise<void> {
        const threshold = this.options.multipartThresholdBytes ?? 8 * 1024 * 1024; if (data.byteLength < threshold) return this.options.client.put(key, data, { contentType: 'application/octet-stream' });
        const partSize = Math.max(5 * 1024 * 1024, this.options.partSizeBytes ?? 8 * 1024 * 1024); const uploadId = await this.options.client.createMultipart(key, { contentType: 'application/octet-stream' }); const parts = [];
        try { for (let offset = 0, partNumber = 1; offset < data.byteLength; offset += partSize, partNumber++) { const result = await this.options.client.uploadPart(key, uploadId, partNumber, data.subarray(offset, Math.min(offset + partSize, data.byteLength))); parts.push({ partNumber, etag: result.etag }); } await this.options.client.completeMultipart(key, uploadId, parts); }
        catch (error) { await this.options.client.abortMultipart(key, uploadId).catch(() => undefined); throw error; }
    }
}

function normalizePrefix(value: string): string { const result = value.replace(/^\/+|\/+$/g, ''); if (!result || result.includes('..')) throw new Error('Invalid S3 prefix'); return result; }
function verifyHash(expected: string, data: Uint8Array): void { if (createHash('sha1').update(data).digest('hex') !== expected) throw new Error(`Asset hash mismatch: ${expected}`); }
async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> { const reader = stream.getReader(); const chunks = []; let size = 0; while (true) { const result = await reader.read(); if (result.done) break; chunks.push(result.value); size += result.value.byteLength; } const data = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; } return data; }

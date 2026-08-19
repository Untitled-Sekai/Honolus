import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import type { SonolusAssetStore } from './type';

const HASH_PATTERN = /^[a-f0-9]{40}$/;

export class FileSonolusAssetStore implements SonolusAssetStore {
    public constructor(private readonly directory: string) {}

    public async has(hash: string): Promise<boolean> {
        assertHash(hash);
        try {
            await access(this.path(hash), constants.F_OK);
            return true;
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        }
    }

    public async put(hash: string, data: Uint8Array): Promise<void> {
        assertHash(hash);
        await mkdir(this.directory, { recursive: true });
        const target = this.path(hash);
        const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(temporary, data);
        await rename(temporary, target);
    }

    public async open(hash: string): Promise<ReadableStream<Uint8Array>> {
        assertHash(hash);
        return Readable.toWeb(createReadStream(this.path(hash))) as ReadableStream<Uint8Array>;
    }

    public async read(hash: string): Promise<Uint8Array> {
        assertHash(hash);
        return readFile(this.path(hash));
    }

    private path(hash: string): string {
        return join(this.directory, hash);
    }
}

export function assertHash(hash: string): void {
    if (!HASH_PATTERN.test(hash)) throw new Error(`Invalid repository hash: ${hash}`);
}

function isNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import type { Context, MiddlewareHandler, Next } from 'hono';

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_COUNT = 10_000;

type ScpEntry = {
    compression: 0 | 8;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
};

export class ScpArchive {
    private readonly entries = new Map<string, ScpEntry>();

    public constructor(private readonly archive: Uint8Array) {
        if (archive.byteLength > MAX_ARCHIVE_BYTES) throw new Error('SCP archive is too large');
        this.readCentralDirectory();
    }

    public static fromFile(path: string): ScpArchive {
        return new ScpArchive(readFileSync(path));
    }

    public has(path: string): boolean {
        return this.entries.has(normalizeEntryPath(path));
    }

    public read(path: string): Uint8Array | undefined {
        const normalizedPath = normalizeEntryPath(path);
        const entry = this.entries.get(normalizedPath);
        if (!entry) return undefined;
        if (entry.uncompressedSize > MAX_ENTRY_BYTES) throw new Error(`SCP entry is too large: ${normalizedPath}`);

        const localOffset = entry.localHeaderOffset;
        if (readUInt32(this.archive, localOffset) !== LOCAL_FILE_HEADER) throw new Error(`Invalid SCP local header: ${normalizedPath}`);
        const fileNameLength = readUInt16(this.archive, localOffset + 26);
        const extraLength = readUInt16(this.archive, localOffset + 28);
        const dataStart = localOffset + 30 + fileNameLength + extraLength;
        const dataEnd = dataStart + entry.compressedSize;
        if (dataStart < 0 || dataEnd > this.archive.byteLength) throw new Error(`Invalid SCP entry range: ${normalizedPath}`);

        const compressed = this.archive.subarray(dataStart, dataEnd);
        const data = entry.compression === 0 ? compressed : inflateRawSync(compressed);
        if (data.byteLength !== entry.uncompressedSize) throw new Error(`SCP entry size mismatch: ${normalizedPath}`);
        return data;
    }

    public keys(): string[] {
        return [...this.entries.keys()];
    }

    private readCentralDirectory(): void {
        const endOffset = findEndOfCentralDirectory(this.archive);
        const entryCount = readUInt16(this.archive, endOffset + 10);
        const directorySize = readUInt32(this.archive, endOffset + 12);
        const directoryOffset = readUInt32(this.archive, endOffset + 16);
        if (entryCount > MAX_ENTRY_COUNT) throw new Error('SCP archive contains too many entries');
        if (directoryOffset + directorySize > this.archive.byteLength) throw new Error('Invalid SCP central directory');

        let offset = directoryOffset;
        for (let index = 0; index < entryCount; index++) {
            if (readUInt32(this.archive, offset) !== CENTRAL_DIRECTORY_ENTRY) throw new Error('Invalid SCP central directory entry');
            const flags = readUInt16(this.archive, offset + 8);
            const compression = readUInt16(this.archive, offset + 10);
            const compressedSize = readUInt32(this.archive, offset + 20);
            const uncompressedSize = readUInt32(this.archive, offset + 24);
            const fileNameLength = readUInt16(this.archive, offset + 28);
            const extraLength = readUInt16(this.archive, offset + 30);
            const commentLength = readUInt16(this.archive, offset + 32);
            const localHeaderOffset = readUInt32(this.archive, offset + 42);
            if ((flags & 0x1) !== 0) throw new Error('Encrypted SCP entries are not supported');
            if (compression !== 0 && compression !== 8) throw new Error(`Unsupported SCP compression method: ${compression}`);
            if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error('SCP entry is too large');

            const name = new TextDecoder().decode(this.archive.subarray(offset + 46, offset + 46 + fileNameLength));
            const normalizedName = normalizeEntryPath(name);
            if (this.entries.has(normalizedName)) throw new Error(`Duplicate SCP entry: ${normalizedName}`);
            this.entries.set(normalizedName, { compression, compressedSize, uncompressedSize, localHeaderOffset });
            offset += 46 + fileNameLength + extraLength + commentLength;
        }
    }
}

export function scpStaticMiddleware(archive: ScpArchive, basePath: string): MiddlewareHandler {
    return async (context: Context, next: Next) => {
        if (context.req.method !== 'GET' && context.req.method !== 'HEAD') return next();
        const relativePath = basePath ? context.req.path.slice(basePath.length) : context.req.path;
        let entryPath: string;
        try {
            entryPath = normalizeEntryPath(`sonolus${relativePath}`);
        } catch {
            return next();
        }
        if (!archive.has(entryPath)) return next();
        const data = archive.read(entryPath)!;
        const headers = new Headers({
            'Content-Type': contentType(entryPath),
            'Content-Length': String(data.byteLength),
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
        return new Response(context.req.method === 'HEAD' ? undefined : Buffer.from(data), { status: 200, headers });
    };
}

export function directoryStaticMiddleware(directory: string, basePath: string): MiddlewareHandler {
    return async (context: Context, next: Next) => {
        if (context.req.method !== 'GET' && context.req.method !== 'HEAD') return next();
        const relativePath = basePath ? context.req.path.slice(basePath.length) : context.req.path;
        let entryPath: string;
        try {
            entryPath = normalizeEntryPath(`sonolus${relativePath}`);
        } catch {
            return next();
        }
        try {
            const data = await readFile(join(directory, ...entryPath.split('/')));
            const headers = new Headers({ 'Content-Type': contentType(entryPath), 'Content-Length': String(data.byteLength), 'Cache-Control': 'public, max-age=31536000, immutable' });
            return new Response(context.req.method === 'HEAD' ? undefined : data, { status: 200, headers });
        } catch (error) {
            if (isNotFound(error)) return next();
            throw error;
        }
    };
}

export function normalizeEntryPath(path: string): string {
    const normalized = path.replace(/^\/+/, '');
    if (!normalized.startsWith('sonolus/')) throw new Error(`SCP entry is outside sonolus/: ${path}`);
    if (normalized.includes('\\') || normalized.split('/').some((part) => part === '..' || part === '.')) throw new Error(`Invalid SCP entry path: ${path}`);
    if (normalized.includes('\0')) throw new Error(`Invalid SCP entry path: ${path}`);
    return normalized;
}

function findEndOfCentralDirectory(archive: Uint8Array): number {
    const start = Math.max(0, archive.byteLength - 65_557);
    for (let offset = archive.byteLength - 22; offset >= start; offset--) {
        if (readUInt32(archive, offset) === END_OF_CENTRAL_DIRECTORY) {
            const commentLength = readUInt16(archive, offset + 20);
            if (offset + 22 + commentLength <= archive.byteLength) return offset;
        }
    }
    throw new Error('SCP end of central directory not found');
}

function readUInt16(data: Uint8Array, offset: number): number {
    if (offset < 0 || offset + 2 > data.byteLength) throw new Error('Invalid SCP header');
    return data[offset] | (data[offset + 1] << 8);
}

function readUInt32(data: Uint8Array, offset: number): number {
    if (offset < 0 || offset + 4 > data.byteLength) throw new Error('Invalid SCP header');
    return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function contentType(path: string): string {
    if (path.endsWith('/info') || path.endsWith('/list') || path.endsWith('/package')) return 'application/json; charset=utf-8';
    return 'application/octet-stream';
}

function isNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

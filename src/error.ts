import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type HonolusErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL_ERROR';

export class HonolusError extends Error {
    public constructor(
        public readonly code: HonolusErrorCode,
        message: string,
        public readonly status: ContentfulStatusCode = statusFor(code),
        options?: { cause?: unknown },
    ) {
        super(message, options);
        this.name = 'HonolusError';
    }
}

export function respondError(context: Context, error: unknown): Response {
    const value = error instanceof HonolusError
        ? error
        : new HonolusError('INTERNAL_ERROR', 'Internal server error', 500, { cause: error });
    const requestId = context.get('requestId') as string | undefined;
    return context.json({ error: value.message, code: value.code, ...(requestId ? { requestId } : {}) }, value.status);
}

function statusFor(code: HonolusErrorCode): ContentfulStatusCode {
    switch (code) {
        case 'BAD_REQUEST': return 400;
        case 'UNAUTHORIZED': return 401;
        case 'FORBIDDEN': return 403;
        case 'NOT_FOUND': return 404;
        case 'CONFLICT': return 409;
        case 'RATE_LIMITED': return 429;
        default: return 500;
    }
}

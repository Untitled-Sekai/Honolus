import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { HonolusError } from './error';
import type { Logger, SessionStore } from './runtime';

export type AuthUser = { id: string; roles?: string[]; permissions?: string[]; [key: string]: unknown };
export type AuthSession<TUser extends AuthUser = AuthUser> = { user: TUser; createdAt: number; expiresAt: number; refreshExpiresAt?: number; refreshHash?: string; metadata?: Record<string, unknown> };
export type AuthOptions<TUser extends AuthUser = AuthUser> = { sessions: SessionStore<AuthSession<TUser>>; sessionTtlMs?: number; refreshTtlMs?: number; logger?: Logger };

export class SessionManager<TUser extends AuthUser = AuthUser> {
    public constructor(private readonly options: AuthOptions<TUser>) {}

    public async create(user: TUser, metadata?: Record<string, unknown>): Promise<{ session: string; refreshToken: string; expiration: number }> {
        const session = token(); const refreshToken = token(); const now = Date.now(); const expiration = now + (this.options.sessionTtlMs ?? 3_600_000);
        const refreshTtlMs = this.options.refreshTtlMs ?? this.options.sessionTtlMs ?? 3_600_000;
        await this.options.sessions.set(key(session), { user, createdAt: now, expiresAt: expiration, refreshExpiresAt: now + refreshTtlMs, refreshHash: hash(refreshToken), ...(metadata ? { metadata } : {}) }, { ttlMs: refreshTtlMs });
        this.audit('auth.session.created', user.id, session);
        return { session, refreshToken, expiration };
    }

    public async resolve(session: string): Promise<AuthSession<TUser> | undefined> {
        const value = await this.options.sessions.get(key(session));
        if (!value) return undefined;
        if (value.expiresAt <= Date.now()) {
            if ((value.refreshExpiresAt ?? value.expiresAt) <= Date.now()) await this.options.sessions.revoke(key(session));
            return undefined;
        }
        return value;
    }

    public async rotate(session: string, refreshToken: string): Promise<{ session: string; refreshToken: string; expiration: number }> {
        const current = await this.options.sessions.get(key(session));
        if (!current?.refreshHash || (current.refreshExpiresAt ?? current.expiresAt) <= Date.now() || !safeHashEqual(current.refreshHash, hash(refreshToken))) {
            await this.revoke(session);
            throw new HonolusError('UNAUTHORIZED', 'Invalid or reused refresh token');
        }
        await this.options.sessions.revoke(key(session));
        this.audit('auth.session.rotated', current.user.id, session);
        return this.create(current.user, current.metadata);
    }

    public async revoke(session: string): Promise<void> {
        const current = await this.options.sessions.get(key(session));
        await this.options.sessions.revoke(key(session));
        this.audit('auth.session.revoked', current?.user.id, session);
    }

    private audit(event: string, userId: string | undefined, session: string): void {
        this.options.logger?.log('info', event, { userId, sessionHash: hash(session).slice(0, 16) });
    }
}

export type Policy<TUser extends AuthUser = AuthUser> = (input: { context: Context; session: AuthSession<TUser>; user: TUser }) => boolean | Promise<boolean>;
export type GuardOptions = { logger?: Logger; resource?: (context: Context) => string | undefined };

export function requireSession<TUser extends AuthUser = AuthUser>(): (context: Context) => void {
    return (context) => { if (!context.get('authSession')) throw new HonolusError('UNAUTHORIZED', 'Authentication required'); };
}

export function requirePermission(permission: string, options: GuardOptions = {}): (context: Context) => Promise<void> {
    return requirePolicy(({ user }) => user.permissions?.includes(permission) ?? false, { ...options, permission });
}

export function requireRole(role: string, options: GuardOptions = {}): (context: Context) => Promise<void> {
    return requirePolicy(({ user }) => user.roles?.includes(role) ?? false, { ...options, permission: `role:${role}` });
}

export function requirePolicy<TUser extends AuthUser = AuthUser>(policy: Policy<TUser>, options: GuardOptions & { permission?: string } = {}): (context: Context) => Promise<void> {
    return async (context) => {
        const session = context.get('authSession') as AuthSession<TUser> | undefined;
        if (!session) throw new HonolusError('UNAUTHORIZED', 'Authentication required');
        const allowed = await policy({ context, session, user: session.user });
        options.logger?.log('info', 'auth.policy.evaluated', { requestId: context.get('requestId'), userId: session.user.id, permission: options.permission, resource: options.resource?.(context), allowed });
        if (!allowed) throw new HonolusError('FORBIDDEN', 'Permission denied');
    };
}

function token(): string { return randomBytes(32).toString('base64url'); }
function hash(value: string): string { return createHash('sha256').update(value).digest('base64url'); }
function key(session: string): string { return `session:${hash(session)}`; }
function safeHashEqual(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

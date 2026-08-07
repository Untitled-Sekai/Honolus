import type { Context } from 'hono';

export const itemName = (context: Context): string =>
    context.req.param('itemName') ?? '';

export const leaderboardName = (context: Context): string =>
    context.req.param('leaderboardName') ?? '';

export const recordName = (context: Context): string =>
    context.req.param('recordName') ?? '';

export const commentName = (context: Context): string =>
    context.req.param('commentName') ?? '';

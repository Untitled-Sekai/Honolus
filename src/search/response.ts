import type { ServerForm } from '@sonolus/core';
import type { Context } from 'hono';

export function respondWithRegisteredSearches<TResponse extends { searches?: ServerForm[] }>(
    context: Context,
    value: TResponse,
): Response {
    const searches = context.sonolus.searchForms;
    return context.json(
        searches && value.searches === undefined
            ? { ...value, searches }
            : value,
    );
}

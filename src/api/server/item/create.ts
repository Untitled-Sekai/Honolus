import type { ServerCreateItemRequest, ServerCreateItemResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export type ItemCreateArguments = readonly [request: ServerCreateItemRequest];

export function createItemCreateDefinition(
    pluralType: string,
): RouteDefinition<ServerCreateItemResponse, ItemCreateArguments> {
    return {
        method: 'POST',
        path: `/${pluralType}/create`,
        arguments: async (context) => [await context.req.json<ServerCreateItemRequest>()],
    };
}

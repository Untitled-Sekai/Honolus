import type { ServerItemDetails } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export type ItemDetailArguments = readonly [itemName: string];

export function createItemDetailDefinition<TItem extends object>(
    pluralType: string,
): RouteDefinition<ServerItemDetails<TItem>, ItemDetailArguments> {
    return {
        method: 'GET',
        path: `/${pluralType}/:itemName`,
        arguments: (context) => [context.req.param('itemName') ?? ''],
    };
}

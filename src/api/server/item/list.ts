import type { ServerItemList } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';
import { respondWithRegisteredSearches } from '../../../search/response';

export function createItemListDefinition<TItem extends object>(
    pluralType: string,
): RouteDefinition<ServerItemList<TItem>> {
    return {
        method: 'GET',
        path: `/${pluralType}/list`,
        respond: respondWithRegisteredSearches,
    };
}

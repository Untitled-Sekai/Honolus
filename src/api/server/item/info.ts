import type { ServerItemInfo } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';
import { respondWithRegisteredSearches } from '../../../search/response';

export function createItemInfoDefinition(
    pluralType: string,
): RouteDefinition<ServerItemInfo> {
    return {
        method: 'GET',
        path: `/${pluralType}/info`,
        respond: respondWithRegisteredSearches,
    };
}

import type { ServerItemInfo } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export function createItemInfoDefinition(
    pluralType: string,
): RouteDefinition<ServerItemInfo> {
    return {
        method: 'GET',
        path: `/${pluralType}/info`,
    };
}

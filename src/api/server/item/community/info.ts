import type { ServerItemCommunityInfo } from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { itemName } from '../arguments';

export type CommunityInfoArguments = readonly [itemName: string];

export function createCommunityInfoDefinition(
    pluralType: string,
): RouteDefinition<ServerItemCommunityInfo, CommunityInfoArguments> {
    return {
        method: 'GET',
        path: `/${pluralType}/:itemName/community/info`,
        arguments: (context) => [itemName(context)],
    };
}

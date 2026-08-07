import type { ServerItemCommunityCommentList } from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { itemName } from '../arguments';

export type CommunityCommentsListArguments = readonly [itemName: string];

export function createCommunityCommentsListDefinition(
    pluralType: string,
): RouteDefinition<ServerItemCommunityCommentList, CommunityCommentsListArguments> {
    return {
        method: 'GET',
        path: `/${pluralType}/:itemName/community/comments/list`,
        arguments: (context) => [itemName(context)],
    };
}

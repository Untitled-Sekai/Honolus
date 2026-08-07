import type {
    ServerSubmitItemCommunityCommentActionRequest,
    ServerSubmitItemCommunityCommentActionResponse,
} from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { commentName, itemName } from '../arguments';

export type CommunityCommentSubmitArguments = readonly [
    itemName: string,
    commentName: string,
    request: ServerSubmitItemCommunityCommentActionRequest,
];

export function createCommunityCommentSubmitDefinition(
    pluralType: string,
): RouteDefinition<
    ServerSubmitItemCommunityCommentActionResponse,
    CommunityCommentSubmitArguments
> {
    return {
        method: 'POST',
        path: `/${pluralType}/:itemName/community/comments/:commentName/submit`,
        arguments: async (context) => [
            itemName(context),
            commentName(context),
            await context.req.json<ServerSubmitItemCommunityCommentActionRequest>(),
        ],
    };
}

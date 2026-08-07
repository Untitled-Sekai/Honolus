import type { ServerUploadItemCommunityCommentActionResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { commentName, itemName } from '../arguments';

export type CommunityCommentUploadArguments = readonly [
    itemName: string,
    commentName: string,
    files: FormData,
];

export function createCommunityCommentUploadDefinition(
    pluralType: string,
): RouteDefinition<
    ServerUploadItemCommunityCommentActionResponse,
    CommunityCommentUploadArguments
> {
    return {
        method: 'POST',
        path: `/${pluralType}/:itemName/community/comments/:commentName/upload`,
        arguments: async (context) => [
            itemName(context),
            commentName(context),
            await context.req.formData(),
        ],
    };
}

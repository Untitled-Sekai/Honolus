import type { ServerUploadItemCommunityActionResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { itemName } from '../arguments';

export type CommunityUploadArguments = readonly [itemName: string, files: FormData];

export function createCommunityUploadDefinition(
    pluralType: string,
): RouteDefinition<ServerUploadItemCommunityActionResponse, CommunityUploadArguments> {
    return {
        method: 'POST',
        path: `/${pluralType}/:itemName/community/upload`,
        arguments: async (context) => [itemName(context), await context.req.formData()],
    };
}

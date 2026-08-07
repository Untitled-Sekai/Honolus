import type { ServerUploadItemActionResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';
import { itemName } from './arguments';

export type ItemUploadArguments = readonly [itemName: string, files: FormData];

export function createItemUploadDefinition(
    pluralType: string,
): RouteDefinition<ServerUploadItemActionResponse, ItemUploadArguments> {
    return {
        method: 'POST',
        path: `/${pluralType}/:itemName/upload`,
        arguments: async (context) => [itemName(context), await context.req.formData()],
    };
}

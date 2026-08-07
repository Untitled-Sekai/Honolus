import type { ServerUploadItemResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export type ItemCreateUploadArguments = readonly [files: FormData];

export function createItemCreateUploadDefinition(
    pluralType: string,
): RouteDefinition<ServerUploadItemResponse, ItemCreateUploadArguments> {
    return {
        method: 'POST',
        path: `/${pluralType}/upload`,
        arguments: async (context) => [await context.req.formData()],
    };
}

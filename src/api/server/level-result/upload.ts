import type { ServerUploadLevelResultResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export type LevelResultUploadArguments = readonly [files: FormData];

export const levelResultUploadDefinition: RouteDefinition<
    ServerUploadLevelResultResponse,
    LevelResultUploadArguments
> = {
    method: 'POST',
    path: '/levels/result/upload',
    arguments: async (context) => [await context.req.formData()],
};

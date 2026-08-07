import type {
    ServerSubmitLevelResultRequest,
    ServerSubmitLevelResultResponse,
} from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export type LevelResultSubmitArguments = readonly [request: ServerSubmitLevelResultRequest];

export const levelResultSubmitDefinition: RouteDefinition<
    ServerSubmitLevelResultResponse,
    LevelResultSubmitArguments
> = {
    method: 'POST',
    path: '/levels/result/submit',
    arguments: async (context) => [await context.req.json<ServerSubmitLevelResultRequest>()],
};

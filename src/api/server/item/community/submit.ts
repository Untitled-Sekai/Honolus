import type {
    ServerSubmitItemCommunityActionRequest,
    ServerSubmitItemCommunityActionResponse,
} from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { itemName } from '../arguments';

export type CommunitySubmitArguments = readonly [
    itemName: string,
    request: ServerSubmitItemCommunityActionRequest,
];

export function createCommunitySubmitDefinition(
    pluralType: string,
): RouteDefinition<ServerSubmitItemCommunityActionResponse, CommunitySubmitArguments> {
    return {
        method: 'POST',
        path: `/${pluralType}/:itemName/community/submit`,
        arguments: async (context) => [
            itemName(context),
            await context.req.json<ServerSubmitItemCommunityActionRequest>(),
        ],
    };
}

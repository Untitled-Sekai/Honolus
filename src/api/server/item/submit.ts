import type {
    ServerSubmitItemActionRequest,
    ServerSubmitItemActionResponse,
} from '@sonolus/core';
import type { RouteDefinition } from '../../registry';
import { itemName } from './arguments';

export type ItemSubmitArguments = readonly [
    itemName: string,
    request: ServerSubmitItemActionRequest,
];

export function createItemSubmitDefinition(
    pluralType: string,
): RouteDefinition<ServerSubmitItemActionResponse, ItemSubmitArguments> {
    return {
        method: 'POST',
        path: `/${pluralType}/:itemName/submit`,
        arguments: async (context) => [
            itemName(context),
            await context.req.json<ServerSubmitItemActionRequest>(),
        ],
    };
}

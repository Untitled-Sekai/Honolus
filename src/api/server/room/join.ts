import type { ServerJoinRoomRequest, ServerJoinRoomResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export type RoomJoinArguments = readonly [
    itemName: string,
    request: ServerJoinRoomRequest,
];

export const roomJoinDefinition: RouteDefinition<ServerJoinRoomResponse, RoomJoinArguments> = {
    method: 'POST',
    path: '/rooms/:itemName',
    arguments: async (context) => [
        context.req.param('itemName') ?? '',
        await context.req.json<ServerJoinRoomRequest>(),
    ],
};

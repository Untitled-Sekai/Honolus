import type { ServerCreateRoomRequest, ServerCreateRoomResponse } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export type RoomCreateArguments = readonly [request: ServerCreateRoomRequest];

export const roomCreateDefinition: RouteDefinition<
    ServerCreateRoomResponse,
    RoomCreateArguments
> = {
    method: 'POST',
    path: '/rooms/create',
    arguments: async (context) => [await context.req.json<ServerCreateRoomRequest>()],
};

import type {
    RoomItem,
    ServerCreateRoomResponse,
    ServerJoinRoomResponse,
} from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../../registry';
import { ServerItemReadRoutes } from '../item';
import { roomCreateDefinition, type RoomCreateArguments } from './create';
import { roomJoinDefinition, type RoomJoinArguments } from './join';

export class ServerRoomRoutes extends ServerItemReadRoutes<RoomItem> {
    public readonly create: RouteDecorator<ServerCreateRoomResponse, RoomCreateArguments>;
    public readonly join: RouteDecorator<ServerJoinRoomResponse, RoomJoinArguments>;

    constructor(registry: RouteRegistry, pluralType: string) {
        super(registry, pluralType);
        this.create = registry.decorator(roomCreateDefinition);
        this.join = registry.decorator(roomJoinDefinition);
    }
}

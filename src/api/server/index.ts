import type { 
    ServerAuthenticateResponse,
    ServerInfo
} from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../registry';
import { serverAuthenticateDefinition } from './authenticate';
import { serverInfoDefinition } from './info';
import { ROUTABLE_ITEM_PATHS, ServerItemRoutes, type RoutableItemMap } from './item';

/** Decorators for routes under the Sonolus server API. */
export class ServerRoutes {
    public readonly authenticate: RouteDecorator<ServerAuthenticateResponse>;
    public readonly server_info: RouteDecorator<ServerInfo>;
    public readonly post: ServerItemRoutes<RoutableItemMap['post']>;
    public readonly playlist: ServerItemRoutes<RoutableItemMap['playlist']>;
    public readonly level: ServerItemRoutes<RoutableItemMap['level']>;
    public readonly skin: ServerItemRoutes<RoutableItemMap['skin']>;
    public readonly background: ServerItemRoutes<RoutableItemMap['background']>;
    public readonly effect: ServerItemRoutes<RoutableItemMap['effect']>;
    public readonly particle: ServerItemRoutes<RoutableItemMap['particle']>;
    public readonly engine: ServerItemRoutes<RoutableItemMap['engine']>;
    public readonly replay: ServerItemRoutes<RoutableItemMap['replay']>;
    public readonly room: ServerItemRoutes<RoutableItemMap['room']>;

    constructor(registry: RouteRegistry) {
        this.authenticate = registry.decorator(serverAuthenticateDefinition);
        this.server_info = registry.decorator(serverInfoDefinition);
        this.post = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.post);
        this.playlist = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.playlist);
        this.level = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.level);
        this.skin = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.skin);
        this.background = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.background);
        this.effect = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.effect);
        this.particle = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.particle);
        this.engine = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.engine);
        this.replay = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.replay);
        this.room = new ServerItemRoutes(registry, ROUTABLE_ITEM_PATHS.room);
    }
}

export type { RoutableItem, RoutableItemType } from './item';

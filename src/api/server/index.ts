import type { 
    ServerAuthenticateResponse,
    ServerInfo
} from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../registry';
import { serverAuthenticateDefinition } from './authenticate';
import { serverInfoDefinition } from './info';

/** Decorators for routes under the Sonolus server API. */
export class ServerRoutes {
    public readonly authenticate: RouteDecorator<ServerAuthenticateResponse>;
    public readonly server_info: RouteDecorator<ServerInfo>;

    constructor(registry: RouteRegistry) {
        this.authenticate = registry.decorator(serverAuthenticateDefinition);
        this.server_info = registry.decorator(serverInfoDefinition);
    }
}

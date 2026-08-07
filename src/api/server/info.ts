import type { ServerInfo } from '@sonolus/core';
import type { RouteDefinition } from '../registry';

export const serverInfoDefinition: RouteDefinition<ServerInfo> = {
    method: 'GET',
    path: '/info'
}
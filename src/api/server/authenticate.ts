import type { ServerAuthenticateResponse } from '@sonolus/core';
import type { RouteDefinition } from '../registry';

export const serverAuthenticateDefinition: RouteDefinition<ServerAuthenticateResponse> = {
    method: 'POST',
    path: '/authenticate',
};

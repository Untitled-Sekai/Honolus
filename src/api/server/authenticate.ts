import type { ServerAuthenticateResponse } from '@sonolus/core';
import { authenticate } from '../authenticate';
import type { RouteDefinition } from '../registry';

export const serverAuthenticateDefinition: RouteDefinition<ServerAuthenticateResponse> = {
    method: 'POST',
    path: '/authenticate',
    before: [authenticate],
};

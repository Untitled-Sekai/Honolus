import type { ServerAuthenticateResponse } from '@sonolus/core';
import { Honolus, SonolusContext } from '../src';

const sonolus = new Honolus();

@sonolus.route.server.authenticate
class AuthenticateHandler {
    async handle(_context: SonolusContext): Promise<ServerAuthenticateResponse> {
        return {
            session: 'test-session',
            expiration: Date.now() + 60_000,
        };
    }
}

void AuthenticateHandler;

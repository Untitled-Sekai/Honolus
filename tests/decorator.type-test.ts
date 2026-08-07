import type {
    PostItem,
    ServerAuthenticateResponse,
    ServerItemDetails,
    ServerItemInfo,
    ServerItemList,
} from '@sonolus/core';
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

@sonolus.route.server.level.info
class ItemInfoHandler {
    async handle(context: SonolusContext): Promise<ServerItemInfo> {
        void context.param('type');
        return { sections: [] };
    }
}

@sonolus.route.server.post.detail
class ItemDetailHandler {
    async handle(
        context: SonolusContext,
        itemName: string,
    ): Promise<ServerItemDetails<PostItem>> {
        void context.itemName;
        void itemName;
        throw new Error('Type-only test');
    }
}

void ItemInfoHandler;
void ItemDetailHandler;

@sonolus.route.server.post.list
class ItemListHandler {
    async handle(_context: SonolusContext): Promise<ServerItemList<PostItem>> {
        return {
            pageCount: 1,
            items: [],
        };
    }
}

void ItemListHandler;

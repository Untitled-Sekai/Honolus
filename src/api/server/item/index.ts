import type {
    ServerCreateItemResponse,
    ServerItemDetails,
    ServerItemInfo,
    ServerItemList,
    ServerSubmitItemActionResponse,
    ServerUploadItemActionResponse,
    ServerUploadItemResponse,
} from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../../registry';
import { createItemCreateDefinition, type ItemCreateArguments } from './create';
import {
    createItemCreateUploadDefinition,
    type ItemCreateUploadArguments,
} from './create-upload';
import { createItemDetailDefinition, type ItemDetailArguments } from './detail';
import { createItemInfoDefinition } from './info';
import { createItemListDefinition } from './list';
import { createItemSubmitDefinition, type ItemSubmitArguments } from './submit';
import { createItemUploadDefinition, type ItemUploadArguments } from './upload';
import { ServerItemCommunityRoutes } from './community';
import { ServerItemLeaderboardRoutes } from './leaderboard';

/** Read-only decorators shared by every Sonolus item type, including rooms. */
export class ServerItemReadRoutes<TItem extends object> {
    public readonly info: RouteDecorator<ServerItemInfo>;
    public readonly list: RouteDecorator<ServerItemList<TItem>>;
    public readonly detail: RouteDecorator<ServerItemDetails<TItem>, ItemDetailArguments>;

    constructor(registry: RouteRegistry, pluralType: string) {
        this.info = registry.decorator(createItemInfoDefinition(pluralType));
        this.list = registry.decorator(createItemListDefinition<TItem>(pluralType));
        this.detail = registry.decorator(createItemDetailDefinition<TItem>(pluralType));
    }
}

/** Complete decorators shared by non-room Sonolus item types. */
export class ServerItemRoutes<TItem extends object> extends ServerItemReadRoutes<TItem> {
    public readonly create: RouteDecorator<ServerCreateItemResponse, ItemCreateArguments>;
    public readonly createUpload: RouteDecorator<
        ServerUploadItemResponse,
        ItemCreateUploadArguments
    >;
    public readonly submit: RouteDecorator<
        ServerSubmitItemActionResponse,
        ItemSubmitArguments
    >;
    public readonly upload: RouteDecorator<
        ServerUploadItemActionResponse,
        ItemUploadArguments
    >;
    public readonly community: ServerItemCommunityRoutes;
    public readonly leaderboard: ServerItemLeaderboardRoutes;

    constructor(registry: RouteRegistry, pluralType: string) {
        super(registry, pluralType);
        this.create = registry.decorator(createItemCreateDefinition(pluralType));
        this.createUpload = registry.decorator(createItemCreateUploadDefinition(pluralType));
        this.submit = registry.decorator(createItemSubmitDefinition(pluralType));
        this.upload = registry.decorator(createItemUploadDefinition(pluralType));
        this.community = new ServerItemCommunityRoutes(registry, pluralType);
        this.leaderboard = new ServerItemLeaderboardRoutes(registry, pluralType);
    }
}

export type { RoutableItem, RoutableItemMap, RoutableItemType } from './type';
export { ROUTABLE_ITEM_PATHS } from './type';

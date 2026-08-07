import type { ServerItemDetails, ServerItemInfo } from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../../registry';
import { createItemDetailDefinition, type ItemDetailArguments } from './detail';
import { createItemInfoDefinition } from './info';

/** Decorators for one concrete Sonolus item type. */
export class ServerItemRoutes<TItem extends object> {
    public readonly info: RouteDecorator<ServerItemInfo>;
    public readonly detail: RouteDecorator<ServerItemDetails<TItem>, ItemDetailArguments>;

    constructor(registry: RouteRegistry, pluralType: string) {
        this.info = registry.decorator(createItemInfoDefinition(pluralType));
        this.detail = registry.decorator(createItemDetailDefinition<TItem>(pluralType));
    }
}

export type { RoutableItem, RoutableItemMap, RoutableItemType } from './type';
export { ROUTABLE_ITEM_PATHS } from './type';

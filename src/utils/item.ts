import { VALID_ITEM_TYPES, ItemKey } from '../type'

export function isValidItemType(item_type: string): item_type is ItemKey {
    return VALID_ITEM_TYPES.includes(item_type as ItemKey);
}
import type {
    BackgroundItem,
    EffectItem,
    EngineItem,
    LevelItem,
    ParticleItem,
    PlaylistItem,
    PostItem,
    ReplayItem,
    RoomItem,
    SkinItem,
} from '@sonolus/core';

export interface RoutableItemMap {
    post: PostItem;
    playlist: PlaylistItem;
    level: LevelItem;
    skin: SkinItem;
    background: BackgroundItem;
    effect: EffectItem;
    particle: ParticleItem;
    engine: EngineItem;
    replay: ReplayItem;
    room: RoomItem;
}

export type RoutableItemType = keyof RoutableItemMap;
export type RoutableItem = RoutableItemMap[RoutableItemType];

export const ROUTABLE_ITEM_PATHS: Record<RoutableItemType, string> = {
    post: 'posts',
    playlist: 'playlists',
    level: 'levels',
    skin: 'skins',
    background: 'backgrounds',
    effect: 'effects',
    particle: 'particles',
    engine: 'engines',
    replay: 'replays',
    room: 'rooms',
};

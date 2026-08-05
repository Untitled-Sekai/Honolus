export const route_item = {
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
    user: 'users',
} as const;

export type ItemKey = keyof typeof route_item;

export const VALID_ITEM_TYPES = Object.keys({
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
    user: 'users',
}) as ItemKey[];
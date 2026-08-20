import type { ServerItemDetails, ServerItemInfo, ServerItemList } from '@sonolus/core';
import type { SonolusContext } from '../../../context';
import type { SonolusDatabase, SonolusItem, SonolusItemType } from '../../../db';

const paths: Record<SonolusItemType, string> = {
    post: 'posts', playlist: 'playlists', level: 'levels', skin: 'skins',
    background: 'backgrounds', effect: 'effects', particle: 'particles',
    engine: 'engines', replay: 'replays',
};

export function createDatabaseHandlers(type: SonolusItemType) {
    return {
        info: class {
            async handle(context: SonolusContext): Promise<ServerItemInfo> {
                return { title: paths[type], sections: [] };
            }
        },
        list: class {
            async handle(context: SonolusContext): Promise<ServerItemList<object>> {
                const query = context.query('query') ?? context.query('search');
                const result = await requiredDatabase(context).repository(type).list({
                    ...(query ? { search: query } : {}),
                    page: { limit: context.pagination.limit, ...(context.query('cursor') ? { cursor: context.query('cursor') } : {}) },
                });
                return {
                    title: paths[type],
                    pageCount: Math.ceil(result.totalCount / context.pagination.limit),
                    ...(result.nextCursor ? { cursor: result.nextCursor } : {}),
                    items: await Promise.all(result.items.map((item) => toServerItem(type, item, context))),
                };
            }
        },
        detail: class {
            async handle(context: SonolusContext, name: string): Promise<ServerItemDetails<object>> {
                const item = await requiredDatabase(context).repository(type).get(name);
                if (!item) throw new NotFoundError();
                return { item: await toServerItem(type, item, context), description: localized(item.description, context.localization), actions: [], hasCommunity: false, leaderboards: [], sections: [] };
            }
        },
    };
}

export class NotFoundError extends Error {
    public constructor() { super('Item not found'); this.name = 'NotFoundError'; }
}

function requiredDatabase(context: SonolusContext): SonolusDatabase {
    if (!context.database) throw new Error('Honolus database is not configured');
    return context.database;
}

async function toServerItem(type: SonolusItemType, item: SonolusItem, context: SonolusContext, seen = new Set<string>()): Promise<object> {
    const key = `${type}/${item.name}`;
    if (seen.has(key)) throw new Error(`Circular item reference: ${key}`);
    seen.add(key);
    const result: Record<string, unknown> = { ...item };
    for (const key of ['title', 'subtitle', 'author', 'artists', 'description']) {
        if (key in result) result[key] = localized(result[key], context.localization);
    }
    if (Array.isArray(result.tags)) result.tags = result.tags.map((tag: any) => ({ ...tag, title: localized(tag.title, context.localization) }));
    for (const key of ['engine', 'skin', 'background', 'effect', 'particle', 'level']) {
        if (typeof result[key] === 'string') {
            const childType = key === 'level' ? 'level' : key as SonolusItemType;
            const child = await requiredDatabase(context).repository(childType).get(result[key] as string);
            if (!child) throw new Error(`Referenced ${childType} item not found: ${result[key]}`);
            result[key] = await toServerItem(childType, child, context, new Set(seen));
        }
    }
    for (const key of ['useSkin', 'useBackground', 'useEffect', 'useParticle']) {
        const use = result[key] as { useDefault?: boolean; item?: string } | undefined;
        if (use && !use.useDefault && typeof use.item === 'string') {
            const childType = key.slice(3).toLowerCase() as SonolusItemType;
            const child = await requiredDatabase(context).repository(childType).get(use.item);
            if (!child) throw new Error(`Referenced ${childType} item not found: ${use.item}`);
            result[key] = { useDefault: false, item: await toServerItem(childType, child, context, new Set(seen)) };
        }
    }
    if (Array.isArray(result.levels)) result.levels = await Promise.all((result.levels as string[]).map(async (name) => {
        const child = await requiredDatabase(context).repository('level').get(name);
        if (!child) throw new Error(`Referenced level item not found: ${name}`);
        return toServerItem('level', child, context, new Set(seen));
    }));
    return result;
}

function localized(value: unknown, language: string): string | undefined {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    const selected = record[language] ?? record.en ?? Object.values(record)[0];
    return typeof selected === 'string' ? selected : undefined;
}

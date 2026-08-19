import { z } from 'zod';
import type { SonolusItemType } from './type';

const localization = z.record(z.string(), z.unknown());
const resource = z.object({ hash: z.string().nullable().optional(), url: z.string().nullable().optional() }).passthrough();
const tag = z.object({ title: localization.optional(), icon: z.union([resource, z.string()]).optional() }).passthrough();

const common = {
    name: z.string().min(1),
    title: localization,
    author: localization,
    tags: z.array(tag),
};

export const itemSchemas = {
    post: z.object({ ...common, version: z.literal(1), time: z.number(), description: localization.optional(), thumbnail: resource.optional() }).passthrough(),
    playlist: z.object({ ...common, version: z.literal(1), subtitle: localization, description: localization.optional(), levels: z.array(z.string()), thumbnail: resource.optional() }).passthrough(),
    level: z.object({ ...common, version: z.literal(1), rating: z.number(), artists: localization, description: localization.optional(), engine: z.string(), useSkin: z.unknown(), useBackground: z.unknown(), useEffect: z.unknown(), useParticle: z.unknown(), cover: resource, bgm: resource, preview: resource.optional(), data: resource }).passthrough(),
    skin: z.object({ ...common, version: z.literal(4), subtitle: localization, description: localization.optional(), thumbnail: resource, data: resource, texture: resource }).passthrough(),
    background: z.object({ ...common, version: z.literal(2), subtitle: localization, description: localization.optional(), thumbnail: resource, data: resource, image: resource, configuration: resource }).passthrough(),
    effect: z.object({ ...common, version: z.literal(5), subtitle: localization, description: localization.optional(), thumbnail: resource, data: resource, audio: resource }).passthrough(),
    particle: z.object({ ...common, version: z.literal(3), subtitle: localization, description: localization.optional(), thumbnail: resource, data: resource, texture: resource }).passthrough(),
    engine: z.object({ ...common, version: z.literal(13), subtitle: localization, description: localization.optional(), skin: z.string(), background: z.string(), effect: z.string(), particle: z.string(), thumbnail: resource, playData: resource, watchData: resource, previewData: resource, tutorialData: resource, rom: resource.optional(), configuration: resource }).passthrough(),
    replay: z.object({ ...common, version: z.literal(1), subtitle: localization, description: localization.optional(), level: z.string(), data: resource, configuration: resource }).passthrough(),
} as const;

export type ItemSchemaMap = typeof itemSchemas;

export function validateItem<T extends SonolusItemType>(type: T, value: unknown) {
    const result = itemSchemas[type].safeParse(value);
    if (!result.success) {
        const name = typeof value === 'object' && value !== null && 'name' in value ? String(value.name) : '<unknown>';
        const fields = result.error.issues.map((issue) => issue.path.join('.') || issue.code).join(', ');
        throw new Error(`Invalid ${type} item ${name}: ${fields}`);
    }
    return result.data;
}

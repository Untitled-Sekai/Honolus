import type { RegisteredSearch, SearchForms, SearchItemType } from './type';

export interface SearchSlot {
    <const TForms extends SearchForms>(forms: TForms): RegisteredSearch<TForms>;
    readonly current: RegisteredSearch | undefined;
}

const itemPaths: Record<SearchItemType, string> = {
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

export class SonolusSearchRegistry {
    public readonly post = createSearchSlot('post');
    public readonly playlist = createSearchSlot('playlist');
    public readonly level = createSearchSlot('level');
    public readonly skin = createSearchSlot('skin');
    public readonly background = createSearchSlot('background');
    public readonly effect = createSearchSlot('effect');
    public readonly particle = createSearchSlot('particle');
    public readonly engine = createSearchSlot('engine');
    public readonly replay = createSearchSlot('replay');
    public readonly room = createSearchSlot('room');

    public resolve(path: string, basePath: string): RegisteredSearch | undefined {
        const relativePath = basePath ? path.slice(basePath.length) : path;
        const pluralType = relativePath.split('/').filter(Boolean)[0];
        const itemType = (Object.entries(itemPaths) as [SearchItemType, string][])
            .find(([, candidate]) => candidate === pluralType)?.[0];
        return itemType ? this[itemType].current : undefined;
    }
}

function createSearchSlot(itemType: SearchItemType): SearchSlot {
    let current: RegisteredSearch | undefined;
    const slot = (<const TForms extends SearchForms>(forms: TForms): RegisteredSearch<TForms> => {
        validateSearchForms(forms);
        const registration = { itemType, forms } as RegisteredSearch<TForms>;
        current = registration;
        return registration;
    }) as SearchSlot;

    Object.defineProperty(slot, 'current', {
        enumerable: true,
        get: () => current,
    });
    return slot;
}

function validateSearchForms(forms: SearchForms): void {
    const types = new Set<string>();

    for (const form of forms) {
        if (form.type === 'quick') {
            throw new Error('Search form type "quick" is reserved for Sonolus quick search');
        }
        if (types.has(form.type)) {
            throw new Error(`Duplicate search form type: ${form.type}`);
        }
        types.add(form.type);

        const queries = new Set<string>();
        for (const option of form.options) {
            if (option.query === 'type') {
                throw new Error('Search option query "type" is reserved for the form type');
            }
            if (queries.has(option.query)) {
                throw new Error(`Duplicate search option query in ${form.type}: ${option.query}`);
            }
            queries.add(option.query);
        }
    }
}

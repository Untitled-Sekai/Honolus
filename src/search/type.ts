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
    ServerForm,
    ServerOption,
    Sil,
    SkinItem,
    UserItem,
} from '@sonolus/core';

export type DeepReadonly<T> = T extends (...arguments_: never[]) => unknown
    ? T
    : T extends readonly (infer TItem)[]
        ? readonly DeepReadonly<TItem>[]
        : T extends object
            ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
            : T;

export type SearchForm = DeepReadonly<ServerForm>;
export type SearchForms = readonly SearchForm[];

type CollectionItemMap = {
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
    user: UserItem;
};

type OptionValue<TOption extends DeepReadonly<ServerOption>> =
    TOption extends { readonly type: 'text' | 'textArea' | 'file' }
        ? string
        : TOption extends { readonly type: 'slider' }
            ? number
            : TOption extends { readonly type: 'toggle' }
                ? boolean
                : TOption extends {
                    readonly type: 'select';
                    readonly def: infer TDefault extends string;
                    readonly values: readonly { readonly name: infer TName extends string }[];
                }
                    ? TDefault | TName
                    : TOption extends {
                        readonly type: 'multi';
                        readonly values: readonly { readonly name: infer TName extends string }[];
                    }
                        ? { [TKey in TName]: boolean }
                        : TOption extends { readonly type: 'serverItem' }
                            ? Sil | null
                            : TOption extends { readonly type: 'serverItems' }
                                ? Sil[]
                                : TOption extends {
                                    readonly type: 'collectionItem';
                                    readonly itemType: infer TType extends keyof CollectionItemMap;
                                }
                                    ? CollectionItemMap[TType] | undefined
                                    : never;

type FormOptions<TForm extends SearchForm> = {
    [TOption in TForm['options'][number] as TOption['query']]: OptionValue<TOption>;
};

type RawFormOptions<TForm extends SearchForm> = Partial<FormOptions<TForm>>;

export type SearchFormValue<TForm extends SearchForm> = {
    type: TForm['type'];
    options: FormOptions<TForm>;
    rawOptions: RawFormOptions<TForm>;
};

export type QuickSearchValue = {
    type: 'quick';
    options: { keywords: string };
    rawOptions: { keywords?: string };
};

export type SearchValue<TForms extends SearchForms> =
    | QuickSearchValue
    | SearchFormValue<TForms[number]>;

export type AnySearchValue = {
    type: string;
    options: Record<string, unknown>;
    rawOptions: Record<string, unknown>;
};

declare const registeredSearchBrand: unique symbol;

export interface RegisteredSearch<TForms extends SearchForms = SearchForms> {
    readonly itemType: SearchItemType;
    readonly forms: TForms;
    readonly [registeredSearchBrand]: true;
}

export type RegisteredSearchValue<TSearch extends RegisteredSearch> =
    TSearch extends RegisteredSearch<infer TForms> ? SearchValue<TForms> : never;

export type SearchItemType =
    | 'post'
    | 'playlist'
    | 'level'
    | 'skin'
    | 'background'
    | 'effect'
    | 'particle'
    | 'engine'
    | 'replay'
    | 'room';

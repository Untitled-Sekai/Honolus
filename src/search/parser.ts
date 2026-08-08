import type { ServerOption, Sil } from '@sonolus/core';
import type {
    AnySearchValue,
    DeepReadonly,
    RegisteredSearch,
    SearchForm,
    SearchForms,
    SearchValue,
} from './type';

type ReadonlyOption = DeepReadonly<ServerOption>;

export function parseSearch<TForms extends SearchForms>(
    parameters: URLSearchParams,
    search: RegisteredSearch<TForms>,
): SearchValue<TForms> {
    const type = parameters.get('type') ?? 'quick';
    if (type === 'quick') return parseQuick(parameters);

    const form = search.forms.find((candidate) => candidate.type === type);
    if (!form) return parseQuick(new URLSearchParams());

    return parseForm(parameters, form) as SearchValue<TForms>;
}

function parseQuick(parameters: URLSearchParams): SearchValue<SearchForms> {
    const keywords = parameters.get('keywords');
    return {
        type: 'quick',
        options: { keywords: keywords ?? '' },
        rawOptions: keywords === null ? {} : { keywords },
    };
}

function parseForm(parameters: URLSearchParams, form: SearchForm): AnySearchValue {
    const options: Record<string, unknown> = {};
    const rawOptions: Record<string, unknown> = {};

    for (const option of form.options) {
        const rawValue = parseRawOption(parameters.get(option.query), option);
        if (rawValue !== undefined) rawOptions[option.query] = rawValue;
        options[option.query] = normalizeOption(rawValue, option);
    }

    return { type: form.type, options, rawOptions };
}

function parseRawOption(value: string | null, option: ReadonlyOption): unknown {
    if (value === null) return undefined;

    switch (option.type) {
        case 'text':
        case 'textArea':
        case 'file':
            return value;
        case 'slider': {
            const parsed = Number(value);
            return Number.isNaN(parsed) ? undefined : parsed;
        }
        case 'toggle':
            return value !== '0';
        case 'select':
            return option.values.some(({ name }) => name === value) ? value : undefined;
        case 'multi': {
            const selected = new Set(value.split(','));
            return Object.fromEntries(option.values.map(({ name }) => [name, selected.has(name)]));
        }
        case 'serverItem': {
            const parsed = parseJson(value);
            return parsed === null || isSil(parsed) ? parsed : undefined;
        }
        case 'serverItems': {
            const parsed = parseJson(value);
            return Array.isArray(parsed) && parsed.every(isSil) ? parsed : undefined;
        }
        case 'collectionItem':
            return parseJson(value);
    }
}

function normalizeOption(value: unknown, option: ReadonlyOption): unknown {
    switch (option.type) {
        case 'text':
        case 'textArea':
            return typeof value === 'string' && (option.limit === 0 || value.length <= option.limit)
                ? value
                : option.def;
        case 'file':
            return typeof value === 'string' ? value : option.def;
        case 'slider':
            return typeof value === 'number' && value >= option.min && value <= option.max
                ? value
                : option.def;
        case 'toggle':
            return typeof value === 'boolean' ? value : option.def;
        case 'select':
            return typeof value === 'string' ? value : option.def;
        case 'multi':
            return value ?? Object.fromEntries(
                option.values.map(({ name }, index) => [name, option.def[index] ?? false]),
            );
        case 'serverItem':
            return value !== undefined ? value : option.def;
        case 'serverItems':
            return Array.isArray(value) && (option.limit === 0 || value.length <= option.limit)
                ? value
                : [...option.def];
        case 'collectionItem':
            return value;
    }
}

function parseJson(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return undefined;
    }
}

function isSil(value: unknown): value is Sil {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Sil>;
    return typeof candidate.address === 'string' && typeof candidate.name === 'string';
}

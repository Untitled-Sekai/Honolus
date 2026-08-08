import type { ServerForm, ServerItemList, LevelItem } from '@sonolus/core';
import { Honolus, SonolusContext } from '../src';

const sonolus = new Honolus();
const levelSearch = sonolus.search.level([
    {
        type: 'advanced',
        title: 'Advanced',
        requireConfirmation: false,
        options: [
            {
                query: 'keywords', name: 'Keywords', required: false, type: 'text',
                def: '', placeholder: 'Keywords', limit: 20, shortcuts: [],
            },
            {
                query: 'rating', name: 'Rating', required: false, type: 'slider',
                def: 0, min: 0, max: 100, step: 1,
            },
            {
                query: 'random', name: 'Random', required: false, type: 'toggle', def: false,
            },
            {
                query: 'genre', name: 'Genre', required: false, type: 'select', def: 'pop',
                values: [{ name: 'pop', title: 'Pop' }, { name: 'rock', title: 'Rock' }],
            },
            {
                query: 'difficulty', name: 'Difficulty', required: false, type: 'multi',
                def: [true, false],
                values: [{ name: 'easy', title: 'Easy' }, { name: 'hard', title: 'Hard' }],
            },
        ],
    },
]);

const expectType = <T>(_value: T): void => {};

@sonolus.route.server.level.list
class LevelSearchHandler {
    async handle(context: SonolusContext): Promise<ServerItemList<LevelItem>> {
        const search = context.search(levelSearch);

        if (search.type === 'advanced') {
            expectType<string>(search.options.keywords);
            expectType<number>(search.options.rating);
            expectType<boolean>(search.options.random);
            expectType<'pop' | 'rock'>(search.options.genre);
            expectType<{ easy: boolean; hard: boolean }>(search.options.difficulty);
            expectType<number | undefined>(search.rawOptions.rating);
        } else {
            expectType<'quick'>(search.type);
            expectType<string>(search.options.keywords);
        }

        return { pageCount: 0, items: [] };
    }
}

const broadForms: ServerForm[] = [];
sonolus.search.post(broadForms);

void LevelSearchHandler;

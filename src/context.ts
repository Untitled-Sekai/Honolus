/**
 * SonolusContextクラスを定義する
 * Define the SonolusContext class
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ServerForm } from '@sonolus/core';
import { ITEMS_PER_PAGE } from './type';
import { parseSearch } from './search';
import type {
    AnySearchValue,
    RegisteredSearch,
    SearchForms,
    SearchValue,
} from './search';
import type { SonolusAssetStore } from './pack';
import type { SonolusDatabase } from './db';
import type { AuthSession, AuthUser } from './auth';

export class SonolusContext {
    constructor(
        private readonly context: Context,
        private readonly sonolus_version: string = '1.1.3',
        private readonly registeredSearch?: RegisteredSearch,
        public readonly database?: SonolusDatabase,
        public readonly assets?: SonolusAssetStore,
    ) {}

    public get version(): string {
        return this.sonolus_version;
    }

    public get localization(): string {
        const localization = this.context.req.query('localization');
        if (localization) {
            return localization;
        } else {
            return 'en';
        }
    }

    /** Returns the first value of a query parameter. */
    public query(name: string): string | undefined {
        return this.context.req.query(name);
    }

    /** Returns every value of a repeated query parameter. */
    public queries(name: string): string[] {
        return this.context.req.queries(name) ?? [];
    }

    /** Mutable URLSearchParams view containing all query parameters. */
    public get queryParams(): URLSearchParams {
        return new URL(this.context.req.url).searchParams;
    }

    /** Parses search parameters using a registered, type-safe search definition. */
    public search<TForms extends SearchForms>(registration: RegisteredSearch<TForms>): SearchValue<TForms>;
    /** Parses search parameters using the definition registered for the current item route. */
    public search(): AnySearchValue | undefined;
    public search<TForms extends SearchForms>(
        registration?: RegisteredSearch<TForms>,
    ): SearchValue<TForms> | AnySearchValue | undefined {
        const target = registration ?? this.registeredSearch;
        if (!target) return undefined;
        return parseSearch(this.queryParams, target);
    }

    /** Search forms registered for the current item route. */
    public get searchForms(): ServerForm[] | undefined {
        return this.registeredSearch
            ? [...this.registeredSearch.forms] as ServerForm[]
            : undefined;
    }

    /** Parses the request JSON body with a caller-selected type. */
    public json<T = unknown>(): Promise<T> {
        return this.context.req.json<T>();
    }

    /** Parses a multipart/form-data or application/x-www-form-urlencoded body. */
    public formData(): Promise<FormData> {
        return this.context.req.formData();
    }

    /** Returns an arbitrary request header. */
    public header(name: string): string | undefined {
        return this.context.req.header(name);
    }

    /** Returns all dynamic route parameters, such as `type` and `itemName`. */
    public get params(): Record<string, string> {
        return this.context.req.param();
    }

    /** Returns one dynamic route parameter. */
    public param(name: string): string | undefined {
        return this.context.req.param(name);
    }

    /** Item name supplied to a detail route. */
    public get itemName(): string | undefined {
        return this.param('itemName');
    }

    public get pagination() {
        const page = parseInt(this.context.req.query('page') ?? '0', 10);
        return {
            page: isNaN(page) ? 0 : page,
            offset: this.utils.page_2_offset(isNaN(page) ? 0 : page),
            cursor: this.context.req.query('cursor') ?? null,
            limit: ITEMS_PER_PAGE
        }
    }

    public get session(): string | null {
        const session = this.context.req.header('Sonolus-Session');
        if (session) {
            return session;
        } else {
            return null;
        }
    }

    public get signature(): string | null {
        const signature = this.context.req.header('Sonolus-Signature');
        if (signature) {
            return signature;
        } else {
            return null;
        }
    }

    public get upload_key(): string | null {
        const upload_key = this.context.req.header('Sonolus-Upload-Key');
        if (upload_key) {
            return upload_key;
        } else {
            return null;
        }
    }

    public get room_key(): string | null {
        return this.header('Sonolus-Room-Key') ?? null;
    }

    public error(status: ContentfulStatusCode, message: string) {
        return this.context.json({ error: message }, status);
    }

    public get requestId(): string | undefined {
        return this.context.get('requestId') as string | undefined;
    }

    public get authSession(): AuthSession | undefined { return this.context.get('authSession') as AuthSession | undefined; }
    public get user(): AuthUser | undefined { return this.authSession?.user; }

    /** Aborted when the configured request timeout expires. */
    public get abortSignal(): AbortSignal | undefined {
        return this.context.get('requestAbortSignal') as AbortSignal | undefined;
    }

    public utils = new SonolusUtils();
}

// ----------------------------------------------------------------------------

/**
 * SonolusUtilsクラスを定義する
 * Define the SonolusUtils class
 */

class SonolusUtils {
    public calc_pagecount(total_cont: number): number {
        /**
         * ページ数を計算する関数
         * Function to calculate the number of pages
         * 
         * @param total_cont 総コンテンツ数 / Total number of contents
         * @returns ページ数 / Number of pages
         */
        return Math.ceil(total_cont / ITEMS_PER_PAGE);
    }

    public page_2_offset(page: number): number {
        return page * ITEMS_PER_PAGE;
    }
}

// ----------------------------------------------------------------------------

/**
 * HonoのContextにSonolusContextを追加する
 * Add SonolusContext to Hono's Context
 */

declare module 'hono' {
  interface Context {
    sonolus: SonolusContext;
  }
}

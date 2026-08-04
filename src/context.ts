/**
 * SonolusContextクラスを定義する
 * Define the SonolusContext class
 */

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ITEMS_PER_PAGE } from './type';

export class SonolusContext {
    constructor(
        private readonly context: Context,
        private readonly sonolus_version: string = '1.1.3'
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

    public get session(): string | null {
        const session = this.context.req.header('Sonolus-Session');
        if (session) {
            return session;
        } else {
            return null;
        }
    }

    public get signature(): string | null {
        const signature = this.context.req.header('sonolus-signature');
        if (signature) {
            return signature;
        } else {
            return null;
        }
    }

    public error(status: ContentfulStatusCode, message: string) {
        return this.context.json({ error: message}, status);
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
import { Hono } from 'hono';

class Honolus {
    /**
     * Honolus 基底クラス
     * Honolus base class
     */
    private app = new Hono();

    constructor() {
        /**
         * ここで、共通のミドルウェア、ルート、コンテキストなどを。後でやる。
         */
    }

    public getApp() {
        return this.app;
    }
}
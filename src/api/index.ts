/**
 * Sonolus API登録
 * Sonolus API registration
 */

import { Hono } from 'hono';
import { route_item } from '../type';

export function register_sonolus_api(app: Hono) {
    const sonolus_router = new Hono();
    
    // ==========================
    // 基本情報系(Basic information)
    // ==========================

    sonolus_router.post('/authenticate', async (c) => {
        // TODO: 認証関数の作成。booleanを返してその後レスポンスの作成を行う
    })

    sonolus_router.get('/info', async (c) => {
        // TODO: serverinfoハンドラーの呼び出し
    })

    // ==========================
    // アイテム系(Generic Items API)
    // ==========================
    sonolus_router.get('/:item_type/info', async (c) => {
        const item_type = c.req.param('item_type');
    })

    sonolus_router.get('/:item_type/list', async (c) => {
        const item_type = c.req.param('item_type');
    })

    sonolus_router.get('/:item_type/:item_id', async (c) => {
        const item_type = c.req.param('item_type');
        const item_id = c.req.param('item_id');
    })

    sonolus_router.post('/:item_type/:name/submit', async (c) => {
        const item_type = c.req.param('item_type');
        const name = c.req.param('name');
    })

    sonolus_router.post('/:item_type/:item_id/upload', async (c) => {
        const item_type = c.req.param('item_type');
        const item_id = c.req.param('item_id');
    })

    app.route('/sonolus', sonolus_router);
}
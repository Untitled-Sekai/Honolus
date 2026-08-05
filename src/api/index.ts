/**
 * Sonolus API登録
 * Sonolus API registration
 */

import { Hono } from 'hono';
import { authenticate } from './authenticate';
import { ItemKey, route_item } from '../type';
import { isValidItemType } from '../utils'

export function register_sonolus_api(app: Hono) {
    const sonolus_router = new Hono();
    
    // ==========================
    // 基本情報系(Basic information)
    // ==========================

    sonolus_router.post('/authenticate', async (c) => {
        const result = await authenticate(c);
        if (!result) c.sonolus.error(400, 'Authentication failed');
    })

    sonolus_router.get('/info', async (c) => {
        // TODO: serverinfoハンドラーの呼び出し
    })

    // ==========================
    // アイテム系(Generic Items API)
    // ==========================
    sonolus_router.get('/:item_type/info', async (c) => {
        const raw_item_type = c.req.param('item_type');
        if (!isValidItemType(raw_item_type)) return c.sonolus.error(404, 'Invalid item type');
        const item_type: ItemKey = raw_item_type;
        const api_plural_path = route_item[item_type];
    })

    sonolus_router.get('/:item_type/list', async (c) => {
        const raw_item_type = c.req.param('item_type');
        if (!isValidItemType(raw_item_type)) return c.sonolus.error(404, 'Invalid item type');
        const item_type: ItemKey = raw_item_type;
    })

    sonolus_router.get('/:item_type/:item_id', async (c) => {
        const raw_item_type = c.req.param('item_type');
        const item_id = c.req.param('item_id');

        if (!isValidItemType(raw_item_type)) return c.sonolus.error(404, 'Invalid item type');
        const item_type: ItemKey = raw_item_type;
    })

    sonolus_router.post('/:item_type/:name/submit', async (c) => {
        const raw_item_type = c.req.param('item_type');
        const name = c.req.param('name');

        if (!isValidItemType(raw_item_type)) return c.sonolus.error(404, 'Invalid item type');
        const item_type: ItemKey = raw_item_type;
    })

    sonolus_router.post('/:item_type/:item_id/upload', async (c) => {
        const raw_item_type = c.req.param('item_type');
        const item_id = c.req.param('item_id');

        if (!isValidItemType(raw_item_type)) return c.sonolus.error(404, 'Invalid item type');
        const item_type: ItemKey = raw_item_type;
    })

    app.route('/sonolus', sonolus_router);
}
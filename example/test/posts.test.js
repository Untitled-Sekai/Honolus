import assert from 'node:assert/strict'
import test from 'node:test'
import { sonolus } from '../dist/app.js'

test('Postのinfo、list、detailをHTTPで取得できる', async () => {
    const app = sonolus.getApp()

    const infoResponse = await app.request('/sonolus/posts/info')
    assert.equal(infoResponse.status, 200)
    assert.deepEqual(await infoResponse.json(), {
        title: 'Posts',
        sections: [],
    })

    const listResponse = await app.request('/sonolus/posts/list?localization=ja')
    assert.equal(listResponse.status, 200)
    const list = await listResponse.json()
    assert.equal(list.pageCount, 1)
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].name, 'welcome')
    assert.equal(list.items[0].title, 'Honolusへようこそ')

    const detailResponse = await app.request('/sonolus/posts/welcome?localization=ja')
    assert.equal(detailResponse.status, 200)
    const detail = await detailResponse.json()
    assert.equal(detail.item.name, 'welcome')
    assert.equal(detail.item.title, 'Honolusへようこそ')
    assert.equal(detail.description, 'ExampleのMemoryデータベースから取得したポストです。')

    const missingResponse = await app.request('/sonolus/posts/missing')
    assert.equal(missingResponse.status, 404)
})

test.after(() => sonolus.close())

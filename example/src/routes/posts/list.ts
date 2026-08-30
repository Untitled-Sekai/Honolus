import type { PostItem, ServerItemList } from '@sonolus/core'
import type { SonolusContext } from '@untitledsekai/honolus'
import { sonolus } from '../../sonolus.js'
import { toPostItem } from './mapper.js'

@sonolus.route.server.post.list
export class PostListHandler {
    public async handle(context: SonolusContext): Promise<ServerItemList<PostItem>> {
        const search = context.query('search')
        const result = await context.database!.repository('post').list({
            ...(search ? { search } : {}),
            page: {
                limit: context.pagination.limit,
                ...(context.pagination.cursor ? { cursor: context.pagination.cursor } : {}),
            },
        })

        return {
            title: 'Posts',
            pageCount: Math.ceil((result.totalCount ?? result.items.length) / context.pagination.limit),
            ...(result.nextCursor ? { cursor: result.nextCursor } : {}),
            items: result.items.map((post) => toPostItem(post, context.localization)),
        }
    }
}

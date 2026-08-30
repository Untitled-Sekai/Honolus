import type { PostItem, ServerItemDetails } from '@sonolus/core'
import type { SonolusContext } from '@untitledsekai/honolus'
import { sonolus } from '../../sonolus.js'
import { localized, toPostItem } from './mapper.js'

@sonolus.route.server.post.detail
export class PostDetailHandler {
    public async handle(context: SonolusContext, itemName: string): Promise<ServerItemDetails<PostItem>> {
        const post = await context.database!.repository('post').get(itemName)
        if (!post) throw new PostNotFoundError(itemName)

        return {
            item: toPostItem(post, context.localization),
            ...(post.description ? { description: localized(post.description, context.localization) } : {}),
            actions: [],
            hasCommunity: false,
            leaderboards: [],
            sections: [],
        }
    }
}

class PostNotFoundError extends Error {
    public constructor(itemName: string) {
        super(`Post not found: ${itemName}`)
        this.name = 'NotFoundError'
    }
}

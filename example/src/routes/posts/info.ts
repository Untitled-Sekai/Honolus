import type { ServerItemInfo } from '@sonolus/core'
import type { SonolusContext } from '@untitledsekai/honolus'
import { sonolus } from '../../sonolus.js'

@sonolus.route.server.post.info
export class PostInfoHandler {
    public handle(_context: SonolusContext): ServerItemInfo {
        return { title: 'Posts', sections: [] }
    }
}

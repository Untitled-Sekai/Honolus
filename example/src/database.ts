import { createSonolusDatabase } from '@untitledsekai/honolus'
import { welcomePost } from './fixtures/posts.js'

export const database = createSonolusDatabase({
    driver: 'memory',
    seed: { post: [welcomePost] },
})

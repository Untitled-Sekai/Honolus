import type { ServerInfo } from '@sonolus/core'
import type { SonolusContext } from '@untitledsekai/honolus'
import { sonolus } from '../sonolus.js'

@sonolus.route.server.info
export class ServerInfoHandler {
    public handle(_context: SonolusContext): ServerInfo {
        return {
            title: 'Honolus Example',
            description: 'A minimal Sonolus server with custom Post routes.',
            buttons: [{ type: 'post' }, { type: 'configuration' }],
            configuration: { options: [] },
        }
    }
}

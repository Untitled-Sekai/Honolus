import { serve } from '@hono/node-server'
import { sonolus } from './app.js'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
}

await sonolus.ready()

const server = serve({
    fetch: sonolus.getApp().fetch,
    port,
})

console.log(`Honolus example listening on http://localhost:${port}`)

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`Received ${signal}; shutting down`)

    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
    })
    await sonolus.close({ gracePeriodMs: 30_000 })
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

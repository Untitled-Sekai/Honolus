import { Honolus, JsonConsoleLogger, MemoryMetrics } from '@untitledsekai/honolus'
import { database } from './database.js'

export { database }
export const metrics = new MemoryMetrics()

export const sonolus = new Honolus({
    database,
    databaseRoutes: false,
    version: '1.1.3',
    timeoutMs: 10_000,
    observability: { logger: new JsonConsoleLogger(), metrics },
})

export default sonolus.getApp()

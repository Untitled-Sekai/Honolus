import { Hono } from 'hono';
import { RouteRegistry, SonolusRoutes } from './api';
import { sonolusMiddleware, version_middleware } from './middleware';

export interface HonolusOptions {
    /** Prefix used for every Sonolus API endpoint. */
    basePath?: `/${string}`;
    /** Value returned in the Sonolus-Version response header. */
    version?: string;
}

export class Honolus {
    private readonly app: Hono;
    public readonly route: SonolusRoutes;

    constructor(options: HonolusOptions = {}) {
        const basePath = normalizeBasePath(options.basePath ?? '/sonolus');

        this.app = new Hono();
        this.app.use(`${basePath}/*`, sonolusMiddleware(options.version), version_middleware());
        this.route = new SonolusRoutes(new RouteRegistry(this.app, basePath));
    }

    public getApp(): Hono {
        return this.app;
    }
}

function normalizeBasePath(path: `/${string}`): string {
    if (path === '/') return '';
    return path.endsWith('/') ? path.slice(0, -1) : path;
}

export { SonolusContext } from './context';
export type {
    RouteDecorator,
    RouteDefinition,
    RouteHandler,
    RouteHandlerConstructor,
    RouteHook,
    RouteMethod,
    RoutableItem,
    RoutableItemType,
} from './api';

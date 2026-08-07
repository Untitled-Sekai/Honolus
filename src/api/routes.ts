import { RouteRegistry } from './registry';
import { ServerRoutes } from './server';

/** Root object exposed as `sonolus.route`. */
export class SonolusRoutes {
    public readonly server: ServerRoutes;

    constructor(registry: RouteRegistry) {
        this.server = new ServerRoutes(registry);
    }
}

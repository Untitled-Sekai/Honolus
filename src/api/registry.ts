import type { Context, Hono } from 'hono';
import type { SonolusContext } from '../context';

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteDefinition<TResponse extends object> {
    readonly method: RouteMethod;
    readonly path: `/${string}`;
    readonly respond?: (context: Context, value: TResponse) => Response;
}

export interface RouteHandler<TResponse extends object> {
    handle(context: SonolusContext): TResponse | Promise<TResponse>;
}

export type RouteHandlerConstructor<TResponse extends object> =
    new () => RouteHandler<TResponse>;

export type RouteDecorator<TResponse extends object> =
    <THandler extends RouteHandlerConstructor<TResponse>>(handler: THandler) => THandler;

/** Registers class-based handlers on the Hono application. */
export class RouteRegistry {
    private readonly registeredRoutes = new Set<string>();

    constructor(
        private readonly app: Hono,
        private readonly basePath: string,
    ) {}

    public decorator<TResponse extends object>(
        definition: RouteDefinition<TResponse>,
    ): RouteDecorator<TResponse> {
        return <THandler extends RouteHandlerConstructor<TResponse>>(Handler: THandler): THandler => {
            this.register(definition, Handler);
            return Handler;
        };
    }

    private register<TResponse extends object>(
        definition: RouteDefinition<TResponse>,
        Handler: RouteHandlerConstructor<TResponse>,
    ): void {
        const path = `${this.basePath}${definition.path}`;
        const routeId = `${definition.method} ${path}`;

        if (this.registeredRoutes.has(routeId)) {
            throw new Error(`A handler is already registered for ${routeId}`);
        }
        this.registeredRoutes.add(routeId);

        this.app.on(definition.method, path, async (context) => {
            const value = await new Handler().handle(context.sonolus);
            return definition.respond?.(context, value) ?? context.json(value);
        });
    }
}

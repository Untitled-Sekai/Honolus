import type { Context, Hono } from 'hono';
import type { SonolusContext } from '../context';

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type RouteHook = (context: Context) => void | Response | Promise<void | Response>;

export interface RouteDefinition<
    TResponse extends object,
    TArguments extends readonly unknown[] = readonly [],
> {
    readonly method: RouteMethod;
    readonly path: `/${string}`;
    /** Hooks run in order before the class handler. Returning a Response stops the chain. */
    readonly before?: readonly RouteHook[];
    /** Builds the arguments passed after SonolusContext to handle(). */
    readonly arguments?: (context: Context) => TArguments;
    readonly respond?: (context: Context, value: TResponse) => Response;
}

export interface RouteHandler<
    TResponse extends object,
    TArguments extends readonly unknown[] = readonly [],
> {
    handle(
        context: SonolusContext,
        ...arguments_: TArguments
    ): TResponse | Promise<TResponse>;
}

export type RouteHandlerConstructor<
    TResponse extends object,
    TArguments extends readonly unknown[] = readonly [],
> = new () => RouteHandler<TResponse, TArguments>;

export type RouteDecorator<
    TResponse extends object,
    TArguments extends readonly unknown[] = readonly [],
> = <THandler extends RouteHandlerConstructor<TResponse, TArguments>>(handler: THandler) => THandler;

/** Registers class-based handlers on the Hono application. */
export class RouteRegistry {
    private readonly registeredRoutes = new Set<string>();

    constructor(
        private readonly app: Hono,
        private readonly basePath: string,
    ) {}

    public decorator<TResponse extends object, TArguments extends readonly unknown[] = readonly []>(
        definition: RouteDefinition<TResponse, TArguments>,
    ): RouteDecorator<TResponse, TArguments> {
        let RegisteredHandler: RouteHandlerConstructor<TResponse, TArguments> | undefined;
        const routeId = this.register(definition, () => RegisteredHandler);

        return <THandler extends RouteHandlerConstructor<TResponse, TArguments>>(
            Handler: THandler,
        ): THandler => {
            if (RegisteredHandler) {
                throw new Error(`A handler is already registered for ${routeId}`);
            }
            RegisteredHandler = Handler;
            return Handler;
        };
    }

    private register<TResponse extends object, TArguments extends readonly unknown[]>(
        definition: RouteDefinition<TResponse, TArguments>,
        getHandler: () => RouteHandlerConstructor<TResponse, TArguments> | undefined,
    ): string {
        const path = `${this.basePath}${definition.path}`;
        const routeId = `${definition.method} ${path}`;

        if (this.registeredRoutes.has(routeId)) {
            throw new Error(`A handler is already registered for ${routeId}`);
        }
        this.registeredRoutes.add(routeId);

        this.app.on(definition.method, path, async (context) => {
            const Handler = getHandler();
            if (!Handler) return context.notFound();

            for (const hook of definition.before ?? []) {
                const response = await hook(context);
                if (response instanceof Response) return response;
            }

            const arguments_ = definition.arguments
                ? definition.arguments(context)
                : [] as unknown as TArguments;
            const value = await new Handler().handle(context.sonolus, ...arguments_);
            return definition.respond?.(context, value) ?? context.json(value);
        });

        return routeId;
    }
}

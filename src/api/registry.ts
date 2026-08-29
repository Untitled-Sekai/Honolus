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
    readonly arguments?: (context: Context) => TArguments | Promise<TArguments>;
    readonly respond?: (context: Context, value: TResponse) => Response;
}

export type RegisteredRoute = {
    method: RouteMethod;
    path: string;
};

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
> = {
    <THandler extends RouteHandlerConstructor<TResponse, TArguments>>(handler: THandler): THandler;
    /** Returns the same decorator with additional policy/middleware hooks. */
    use(...hooks: readonly RouteHook[]): RouteDecorator<TResponse, TArguments>;
};

export type HandlerDependencies<TDependencies, TArguments extends readonly unknown[]> = TDependencies | ((context: SonolusContext, ...arguments_: TArguments) => TDependencies | Promise<TDependencies>);
export type FunctionHandlerOptions<TResponse extends object, TArguments extends readonly unknown[], TDependencies> = {
    dependencies: HandlerDependencies<TDependencies, TArguments>;
    handle(input: { context: SonolusContext; dependencies: TDependencies; arguments: TArguments }): TResponse | Promise<TResponse>;
};

/** Creates a decorator-compatible handler while keeping dependencies explicit and testable. */
export function defineHandler<TResponse extends object, TArguments extends readonly unknown[] = readonly [], TDependencies = Record<string, never>>(
    options: FunctionHandlerOptions<TResponse, TArguments, TDependencies>,
): RouteHandlerConstructor<TResponse, TArguments> {
    return class {
        public async handle(context: SonolusContext, ...arguments_: TArguments): Promise<TResponse> {
            const dependencies = typeof options.dependencies === 'function'
                ? await (options.dependencies as (context: SonolusContext, ...arguments_: TArguments) => TDependencies | Promise<TDependencies>)(context, ...arguments_)
                : options.dependencies;
            return options.handle({ context, dependencies, arguments: arguments_ });
        }
    };
}

/** Registers class-based handlers on the Hono application. */
export class RouteRegistry {
    private readonly registeredRoutes = new Set<string>();
    private readonly routes: RegisteredRoute[] = [];

    constructor(
        private readonly app: Hono,
        private readonly basePath: string,
    ) {}

    public decorator<TResponse extends object, TArguments extends readonly unknown[] = readonly []>(
        definition: RouteDefinition<TResponse, TArguments>,
    ): RouteDecorator<TResponse, TArguments> {
        let RegisteredHandler: RouteHandlerConstructor<TResponse, TArguments> | undefined;
        const additionalHooks: RouteHook[] = [];
        const routeId = this.register(definition, () => RegisteredHandler, additionalHooks);

        const decorator = <THandler extends RouteHandlerConstructor<TResponse, TArguments>>(
            Handler: THandler,
        ): THandler => {
            if (RegisteredHandler) {
                throw new Error(`A handler is already registered for ${routeId}`);
            }
            RegisteredHandler = Handler;
            return Handler;
        };
        decorator.use = (...hooks: readonly RouteHook[]) => { additionalHooks.push(...hooks); return decorator; };
        return decorator;
    }

    private register<TResponse extends object, TArguments extends readonly unknown[]>(
        definition: RouteDefinition<TResponse, TArguments>,
        getHandler: () => RouteHandlerConstructor<TResponse, TArguments> | undefined,
        additionalHooks: RouteHook[],
    ): string {
        const path = `${this.basePath}${definition.path}`;
        const routeId = `${definition.method} ${path}`;

        if (this.registeredRoutes.has(routeId)) {
            throw new Error(`A handler is already registered for ${routeId}`);
        }
        this.registeredRoutes.add(routeId);
        this.routes.push({ method: definition.method, path });

        this.app.on(definition.method, path, async (context) => {
            context.set('observabilityRoute', path);
            const Handler = getHandler();
            if (!Handler) return context.notFound();

            for (const hook of [...(definition.before ?? []), ...additionalHooks]) {
                const response = await hook(context);
                if (response instanceof Response) return response;
            }

            const arguments_ = definition.arguments
                ? await definition.arguments(context)
                : [] as unknown as TArguments;
            let value: TResponse;
            try {
                value = await new Handler().handle(context.sonolus, ...arguments_);
            } catch (error) {
                if (error instanceof Error && error.name === 'NotFoundError') return context.notFound();
                throw error;
            }
            return definition.respond?.(context, value) ?? context.json(value);
        });

        return routeId;
    }

    public getRoutes(): RegisteredRoute[] {
        return this.routes.map((route) => ({ ...route }));
    }
}

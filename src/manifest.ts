import type { RegisteredRoute } from './api';

export type HonolusRouteManifest = {
    version: 1;
    generatedAt: string;
    routes: RegisteredRoute[];
};

export type OpenApiDocument = {
    openapi: '3.0.3';
    info: { title: string; version: string };
    paths: Record<string, Record<string, { responses: Record<string, { description: string }> }>>;
};

export function createRouteManifest(routes: readonly RegisteredRoute[]): HonolusRouteManifest {
    return { version: 1, generatedAt: new Date().toISOString(), routes: routes.map((route) => ({ ...route })) };
}

export function createOpenApiDocument(routes: readonly RegisteredRoute[], options: { title?: string; version?: string } = {}): OpenApiDocument {
    const paths: OpenApiDocument['paths'] = {};
    for (const route of routes) {
        const path = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
        paths[path] ??= {};
        paths[path][route.method.toLowerCase()] = { responses: { '200': { description: 'Success' }, '400': { description: 'Bad request' }, '500': { description: 'Internal server error' } } };
    }
    return { openapi: '3.0.3', info: { title: options.title ?? 'Honolus API', version: options.version ?? '1.0.0' }, paths };
}

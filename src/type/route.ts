export const RouteKey = {
    ServerAuthenticate: 'server.authenticate',
    ServerInfo: 'server.info',
    Item: {
        info: (type: string) => `item.${type}.info`,
        list: (type: string) => `item.${type}.list`,
        detail: (type: string, id: string) => `item.${type}.${id}.detail`,
        submit: (type: string, name: string) => `item.${type}.${name}.submit`,
        upload: (type: string, id: string) => `item.${type}.${id}.upload`,
    }
} as const;

export type RouteKey = typeof RouteKey[keyof typeof RouteKey];
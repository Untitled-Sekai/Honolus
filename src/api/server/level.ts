import type { LevelItem } from '@sonolus/core';
import { RouteRegistry } from '../registry';
import { ServerItemRoutes } from './item';
import { ServerLevelResultRoutes } from './level-result';

export class ServerLevelRoutes extends ServerItemRoutes<LevelItem> {
    public readonly result: ServerLevelResultRoutes;

    constructor(
        registry: RouteRegistry,
        pluralType: string,
        result: ServerLevelResultRoutes,
    ) {
        super(registry, pluralType);
        this.result = result;
    }
}

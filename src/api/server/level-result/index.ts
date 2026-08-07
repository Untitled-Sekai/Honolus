import type {
    ServerLevelResultInfo,
    ServerSubmitLevelResultResponse,
    ServerUploadLevelResultResponse,
} from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../../registry';
import { levelResultInfoDefinition } from './info';
import { levelResultSubmitDefinition, type LevelResultSubmitArguments } from './submit';
import { levelResultUploadDefinition, type LevelResultUploadArguments } from './upload';

export class ServerLevelResultRoutes {
    public readonly info: RouteDecorator<ServerLevelResultInfo>;
    public readonly submit: RouteDecorator<
        ServerSubmitLevelResultResponse,
        LevelResultSubmitArguments
    >;
    public readonly upload: RouteDecorator<
        ServerUploadLevelResultResponse,
        LevelResultUploadArguments
    >;

    constructor(registry: RouteRegistry) {
        this.info = registry.decorator(levelResultInfoDefinition);
        this.submit = registry.decorator(levelResultSubmitDefinition);
        this.upload = registry.decorator(levelResultUploadDefinition);
    }
}

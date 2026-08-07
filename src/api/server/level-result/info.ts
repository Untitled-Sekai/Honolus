import type { ServerLevelResultInfo } from '@sonolus/core';
import type { RouteDefinition } from '../../registry';

export const levelResultInfoDefinition: RouteDefinition<ServerLevelResultInfo> = {
    method: 'GET',
    path: '/levels/result/info',
};

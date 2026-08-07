import type { ServerItemLeaderboardDetails } from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { itemName, leaderboardName } from '../arguments';

export type LeaderboardDetailsArguments = readonly [
    itemName: string,
    leaderboardName: string,
];

export function createLeaderboardDetailsDefinition(
    pluralType: string,
): RouteDefinition<ServerItemLeaderboardDetails, LeaderboardDetailsArguments> {
    return {
        method: 'GET',
        path: `/${pluralType}/:itemName/leaderboards/:leaderboardName`,
        arguments: (context) => [itemName(context), leaderboardName(context)],
    };
}

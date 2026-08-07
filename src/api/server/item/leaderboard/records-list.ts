import type { ServerItemLeaderboardRecordList } from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { itemName, leaderboardName } from '../arguments';

export type LeaderboardRecordsListArguments = readonly [
    itemName: string,
    leaderboardName: string,
];

export function createLeaderboardRecordsListDefinition(
    pluralType: string,
): RouteDefinition<ServerItemLeaderboardRecordList, LeaderboardRecordsListArguments> {
    return {
        method: 'GET',
        path: `/${pluralType}/:itemName/leaderboards/:leaderboardName/records/list`,
        arguments: (context) => [itemName(context), leaderboardName(context)],
    };
}

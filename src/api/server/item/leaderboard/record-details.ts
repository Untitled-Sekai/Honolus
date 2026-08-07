import type { ServerItemLeaderboardRecordDetails } from '@sonolus/core';
import type { RouteDefinition } from '../../../registry';
import { itemName, leaderboardName, recordName } from '../arguments';

export type LeaderboardRecordDetailsArguments = readonly [
    itemName: string,
    leaderboardName: string,
    recordName: string,
];

export function createLeaderboardRecordDetailsDefinition(
    pluralType: string,
): RouteDefinition<ServerItemLeaderboardRecordDetails, LeaderboardRecordDetailsArguments> {
    return {
        method: 'GET',
        path: `/${pluralType}/:itemName/leaderboards/:leaderboardName/records/:recordName`,
        arguments: (context) => [
            itemName(context),
            leaderboardName(context),
            recordName(context),
        ],
    };
}

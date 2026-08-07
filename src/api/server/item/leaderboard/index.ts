import type {
    ServerItemLeaderboardDetails,
    ServerItemLeaderboardRecordDetails,
    ServerItemLeaderboardRecordList,
} from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../../../registry';
import { createLeaderboardDetailsDefinition, type LeaderboardDetailsArguments } from './details';
import {
    createLeaderboardRecordDetailsDefinition,
    type LeaderboardRecordDetailsArguments,
} from './record-details';
import {
    createLeaderboardRecordsListDefinition,
    type LeaderboardRecordsListArguments,
} from './records-list';

export class ServerItemLeaderboardRecordsRoutes {
    public readonly list: RouteDecorator<
        ServerItemLeaderboardRecordList,
        LeaderboardRecordsListArguments
    >;
    public readonly detail: RouteDecorator<
        ServerItemLeaderboardRecordDetails,
        LeaderboardRecordDetailsArguments
    >;
    /** @deprecated Use `detail`. */
    public readonly details: RouteDecorator<
        ServerItemLeaderboardRecordDetails,
        LeaderboardRecordDetailsArguments
    >;

    constructor(registry: RouteRegistry, pluralType: string) {
        this.list = registry.decorator(createLeaderboardRecordsListDefinition(pluralType));
        this.detail = registry.decorator(createLeaderboardRecordDetailsDefinition(pluralType));
        this.details = this.detail;
    }
}

export class ServerItemLeaderboardRoutes {
    public readonly detail: RouteDecorator<
        ServerItemLeaderboardDetails,
        LeaderboardDetailsArguments
    >;
    /** @deprecated Use `detail`. */
    public readonly details: RouteDecorator<
        ServerItemLeaderboardDetails,
        LeaderboardDetailsArguments
    >;
    public readonly records: ServerItemLeaderboardRecordsRoutes;

    constructor(registry: RouteRegistry, pluralType: string) {
        this.detail = registry.decorator(createLeaderboardDetailsDefinition(pluralType));
        this.details = this.detail;
        this.records = new ServerItemLeaderboardRecordsRoutes(registry, pluralType);
    }
}

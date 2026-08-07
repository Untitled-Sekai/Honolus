import type {
    ServerItemCommunityCommentList,
    ServerItemCommunityInfo,
    ServerSubmitItemCommunityActionResponse,
    ServerSubmitItemCommunityCommentActionResponse,
    ServerUploadItemCommunityActionResponse,
    ServerUploadItemCommunityCommentActionResponse,
} from '@sonolus/core';
import { RouteRegistry, type RouteDecorator } from '../../../registry';
import {
    createCommunityCommentSubmitDefinition,
    type CommunityCommentSubmitArguments,
} from './comment-submit';
import {
    createCommunityCommentUploadDefinition,
    type CommunityCommentUploadArguments,
} from './comment-upload';
import {
    createCommunityCommentsListDefinition,
    type CommunityCommentsListArguments,
} from './comments-list';
import { createCommunityInfoDefinition, type CommunityInfoArguments } from './info';
import { createCommunitySubmitDefinition, type CommunitySubmitArguments } from './submit';
import { createCommunityUploadDefinition, type CommunityUploadArguments } from './upload';

export class ServerItemCommunityCommentsRoutes {
    public readonly list: RouteDecorator<
        ServerItemCommunityCommentList,
        CommunityCommentsListArguments
    >;
    public readonly submit: RouteDecorator<
        ServerSubmitItemCommunityCommentActionResponse,
        CommunityCommentSubmitArguments
    >;
    public readonly upload: RouteDecorator<
        ServerUploadItemCommunityCommentActionResponse,
        CommunityCommentUploadArguments
    >;

    constructor(registry: RouteRegistry, pluralType: string) {
        this.list = registry.decorator(createCommunityCommentsListDefinition(pluralType));
        this.submit = registry.decorator(createCommunityCommentSubmitDefinition(pluralType));
        this.upload = registry.decorator(createCommunityCommentUploadDefinition(pluralType));
    }
}

export class ServerItemCommunityRoutes {
    public readonly info: RouteDecorator<ServerItemCommunityInfo, CommunityInfoArguments>;
    public readonly submit: RouteDecorator<
        ServerSubmitItemCommunityActionResponse,
        CommunitySubmitArguments
    >;
    public readonly upload: RouteDecorator<
        ServerUploadItemCommunityActionResponse,
        CommunityUploadArguments
    >;
    public readonly comments: ServerItemCommunityCommentsRoutes;

    constructor(registry: RouteRegistry, pluralType: string) {
        this.info = registry.decorator(createCommunityInfoDefinition(pluralType));
        this.submit = registry.decorator(createCommunitySubmitDefinition(pluralType));
        this.upload = registry.decorator(createCommunityUploadDefinition(pluralType));
        this.comments = new ServerItemCommunityCommentsRoutes(registry, pluralType);
    }
}

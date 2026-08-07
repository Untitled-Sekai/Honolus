import type {
    ServerCreateItemRequest,
    ServerCreateItemResponse,
    ServerCreateRoomRequest,
    ServerCreateRoomResponse,
    ServerInfo,
    ServerItemCommunityCommentList,
    ServerItemCommunityInfo,
    ServerItemLeaderboardDetails,
    ServerItemLeaderboardRecordDetails,
    ServerItemLeaderboardRecordList,
    ServerJoinRoomRequest,
    ServerJoinRoomResponse,
    ServerLevelResultInfo,
    ServerSubmitItemActionRequest,
    ServerSubmitItemActionResponse,
    ServerSubmitItemCommunityActionRequest,
    ServerSubmitItemCommunityActionResponse,
    ServerSubmitItemCommunityCommentActionRequest,
    ServerSubmitItemCommunityCommentActionResponse,
    ServerSubmitLevelResultRequest,
    ServerSubmitLevelResultResponse,
    ServerUploadItemActionResponse,
    ServerUploadItemCommunityActionResponse,
    ServerUploadItemCommunityCommentActionResponse,
    ServerUploadItemResponse,
    ServerUploadLevelResultResponse,
} from '@sonolus/core';
import { Honolus, SonolusContext } from '../src';

const sonolus = new Honolus();

@sonolus.route.server.info
class ServerInfoHandler {
    async handle(context: SonolusContext): Promise<ServerInfo> {
        void context.query('option');
        void context.queries('option');
        void context.queryParams;
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.create
class CreateHandler {
    async handle(
        _context: SonolusContext,
        _request: ServerCreateItemRequest,
    ): Promise<ServerCreateItemResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.createUpload
class CreateUploadHandler {
    async handle(_context: SonolusContext, _files: FormData): Promise<ServerUploadItemResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.submit
class SubmitHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _request: ServerSubmitItemActionRequest,
    ): Promise<ServerSubmitItemActionResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.upload
class UploadHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _files: FormData,
    ): Promise<ServerUploadItemActionResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.community.info
class CommunityInfoHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
    ): Promise<ServerItemCommunityInfo> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.community.submit
class CommunitySubmitHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _request: ServerSubmitItemCommunityActionRequest,
    ): Promise<ServerSubmitItemCommunityActionResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.community.upload
class CommunityUploadHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _files: FormData,
    ): Promise<ServerUploadItemCommunityActionResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.community.comments.list
class CommentsListHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
    ): Promise<ServerItemCommunityCommentList> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.community.comments.submit
class CommentSubmitHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _commentName: string,
        _request: ServerSubmitItemCommunityCommentActionRequest,
    ): Promise<ServerSubmitItemCommunityCommentActionResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.community.comments.upload
class CommentUploadHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _commentName: string,
        _files: FormData,
    ): Promise<ServerUploadItemCommunityCommentActionResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.leaderboard.detail
class LeaderboardHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _leaderboardName: string,
    ): Promise<ServerItemLeaderboardDetails> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.leaderboard.records.list
class RecordsListHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _leaderboardName: string,
    ): Promise<ServerItemLeaderboardRecordList> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.post.leaderboard.records.detail
class RecordDetailsHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _leaderboardName: string,
        _recordName: string,
    ): Promise<ServerItemLeaderboardRecordDetails> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.level.result.info
class ResultInfoHandler {
    async handle(_context: SonolusContext): Promise<ServerLevelResultInfo> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.level.result.submit
class ResultSubmitHandler {
    async handle(
        _context: SonolusContext,
        _request: ServerSubmitLevelResultRequest,
    ): Promise<ServerSubmitLevelResultResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.level.result.upload
class ResultUploadHandler {
    async handle(
        _context: SonolusContext,
        _files: FormData,
    ): Promise<ServerUploadLevelResultResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.room.create
class RoomCreateHandler {
    async handle(
        _context: SonolusContext,
        _request: ServerCreateRoomRequest,
    ): Promise<ServerCreateRoomResponse> {
        throw new Error('Type-only test');
    }
}

@sonolus.route.server.room.join
class RoomJoinHandler {
    async handle(
        _context: SonolusContext,
        _itemName: string,
        _request: ServerJoinRoomRequest,
    ): Promise<ServerJoinRoomResponse> {
        throw new Error('Type-only test');
    }
}

void [
    ServerInfoHandler,
    CreateHandler,
    CreateUploadHandler,
    SubmitHandler,
    UploadHandler,
    CommunityInfoHandler,
    CommunitySubmitHandler,
    CommunityUploadHandler,
    CommentsListHandler,
    CommentSubmitHandler,
    CommentUploadHandler,
    LeaderboardHandler,
    RecordsListHandler,
    RecordDetailsHandler,
    ResultInfoHandler,
    ResultSubmitHandler,
    ResultUploadHandler,
    RoomCreateHandler,
    RoomJoinHandler,
];

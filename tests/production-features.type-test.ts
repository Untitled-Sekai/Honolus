import type { ServerInfo } from '@sonolus/core';
import { Honolus, defineHandler, requirePermission } from '../src';

const sonolus = new Honolus();

const InfoHandler = defineHandler<ServerInfo, readonly [], { title: string }>({
    dependencies: { title: 'Server' },
    handle: ({ context, dependencies }) => {
        context.abortSignal?.throwIfAborted();
        void dependencies.title;
        throw new Error('Type-only test');
    },
});

sonolus.route.server.info.use(requirePermission('server:read'))(InfoHandler);

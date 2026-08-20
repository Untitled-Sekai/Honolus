import type { Logger } from './runtime';

export const HONOLUS_COMPATIBILITY_VERSION = 1;

export type DeprecationNotice = {
    name: string;
    replacement?: string;
    since: string;
    removeIn?: string;
};

export function assertCompatibility(version: number): void {
    if (!Number.isInteger(version) || version < 1 || version > HONOLUS_COMPATIBILITY_VERSION) throw new Error(`Unsupported Honolus compatibility version: ${version}`);
}

const warned = new Set<string>();
export function warnDeprecated(notice: DeprecationNotice, logger?: Logger): void {
    if (warned.has(notice.name)) return;
    warned.add(notice.name);
    logger?.log('warn', 'deprecated.api', { name: notice.name, replacement: notice.replacement, since: notice.since, removeIn: notice.removeIn });
}

import type { DatabasePostItem, PostItem } from '@sonolus/core'

export function toPostItem(post: DatabasePostItem, localization: string): PostItem {
    return {
        name: post.name,
        version: post.version,
        title: localized(post.title, localization),
        time: post.time,
        author: localized(post.author, localization),
        tags: post.tags.map((tag) => ({
            ...(tag.title ? { title: localized(tag.title, localization) } : {}),
            ...(tag.icon ? { icon: tag.icon } : {}),
        })),
        ...(post.thumbnail ? { thumbnail: post.thumbnail } : {}),
    }
}

export function localized(value: Record<string, string>, localization: string): string {
    return value[localization] ?? value.en ?? Object.values(value)[0] ?? ''
}

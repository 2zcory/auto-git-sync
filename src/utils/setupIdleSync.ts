import { App } from "obsidian";
import { SimpleGit } from "simple-git";
import { getTimestampMessage, hasVaultChanged, isOnline, saveAllMarkdownViews } from "./common";

type Dispose = () => void;

export function setupIdleSync(opts: {
    app: App;
    git: SimpleGit;
    idleMs: number;
    minIntervalms?: number; // throttle: minimum interval between syncs
    onlineCacheMs?: number; // cache online status for this amount of time

    // hooks for sync events
    onSyncStart?: () => void;
    onSyncSuccess?: () => void;
    onSyncSkipped?: (reason: "offline" | "nochange" | "throttled") => void;
    onSyncFailed?: (err: unknown) => void;
}): Dispose {
    const {
        app,
        git,
        idleMs: optsIdleMs,
        minIntervalms = 60 * 1000,
        onlineCacheMs = 30 * 1000
    } = opts;

    const idleMs = Math.max(15 * 1000, optsIdleMs);

    let idleTimeout: ReturnType<typeof setTimeout> | null = null;
    let isSyncing = false;
    let lastSyncAt = 0;

    let onlineCache = { at: 0, value: true };
    const checkOnlineCached = async () => {
        const now = Date.now();
        if (now - onlineCache.at < onlineCacheMs) return onlineCache.value;
        onlineCache.at = now;
        onlineCache.value = await isOnline();
        return onlineCache.value;
    }

    const triggerSync = async () => {
        if (isSyncing) return;

        const now = Date.now();
        if (now - lastSyncAt < minIntervalms) {
            opts.onSyncSkipped?.("throttled");
            return;
        }

        isSyncing = true;
        opts.onSyncStart?.();

        try {
            const online = await checkOnlineCached();
            if (!online) {
                opts.onSyncSkipped?.("offline");
                return;
            }

            const changed = await hasVaultChanged(git);
            if (!changed) {
                opts.onSyncSkipped?.("nochange");
                return;
            }

            saveAllMarkdownViews(app);

            const changedAfterSave = await hasVaultChanged(git);
            if (!changedAfterSave) {
                opts.onSyncSkipped?.("nochange");
                return;
            }

            await git.add('.');
            await git.commit(getTimestampMessage());
            await git.push('origin', (await git.branchLocal()).current);

            lastSyncAt = Date.now();
            opts.onSyncSuccess?.();
        } catch (e) {
            opts.onSyncFailed?.(e);
        } finally {
            isSyncing = false;
        }
    }

    const schedule = () => {
        if (idleTimeout) clearTimeout(idleTimeout);

        idleTimeout = setTimeout(() => {
            void triggerSync();
        }, idleMs);
    }

    const events: Array<[string, AddEventListenerOptions | boolean | undefined]> = [
        ['mousemove', { passive: true }],
        ['scroll', { passive: true }],
        ['click', undefined],
        ['keydown', undefined],
    ]

    const listener = () => schedule();

    events.forEach(([event, options]) => {
        window.addEventListener(event, listener, options);
    });
    schedule();

    return () => {
        if (idleTimeout) clearTimeout(idleTimeout);
        events.forEach(([event, options]) => {
            window.removeEventListener(event, listener, options);
        });
    }
}
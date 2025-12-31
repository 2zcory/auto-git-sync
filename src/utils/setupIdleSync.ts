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
}): Dispose {
    const {
        app,
        git,
        minIntervalms = 60 * 1000,
        onlineCacheMs = 30 * 1000
    } = opts;

    const idleMs = Math.max(15 * 1000, minIntervalms);

    let idleTimeout: NodeJS.Timeout | null = null;
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
        if (now - lastSyncAt < minIntervalms) return;

        isSyncing = true;

        try {
            const online = await checkOnlineCached();
            if (!online) return;

            const changed = await hasVaultChanged(git);
            if (!changed) return;

            saveAllMarkdownViews(app);

            const changedAfterSave = await hasVaultChanged(git);
            if (!changedAfterSave) return;

            await git.add('.');
            await git.commit(getTimestampMessage());
            await git.push();

            lastSyncAt = Date.now();
        } catch (e) {
            console.error('Auto Git Sync Push failed', e);
        } finally {
            isSyncing = false;
        }
    }

    const schedule = () => {
        if (idleTimeout) clearTimeout(idleTimeout);

        idleTimeout = setTimeout(triggerSync, idleMs);
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
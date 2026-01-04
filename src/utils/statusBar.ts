export type SyncPhase = "idle" | "syncing" | "offline" | "failed" | "ok";

export interface StatusState {
    phase: SyncPhase;
    lastSyncAtMs: number | null;
    lastError?: string;
}

export type Dispose = () => void;

export function createSyncStatusBar(createItem: () => HTMLElement): {
    setState: (patch: Partial<StatusState>) => void;
    getState: () => StatusState;
    dispose: Dispose;
} {
    const el = createItem();
    el.addClass("auto-git-sync-status");

    let state: StatusState = {
        phase: "idle",
        lastSyncAtMs: null,
    };

    let timer: number | null = null;

    const render = () => {
        const { phase, lastSyncAtMs, lastError } = state;

        if (phase === "syncing") {
            el.setText("Git: Syncing...");
            el.setAttr("arial-label", "Auto Git Sync: Syncing...");

            return;
        }

        if (phase === "offline") {
            el.setText(lastSyncAtMs ? `Git: Offline · ${formatAgo(lastSyncAtMs)}` : "Git: Offline");
            el.setAttr("arial-label", "Auto Git Sync: Offline");

            return;
        }

        if (phase === "failed") {
            el.setText(lastSyncAtMs ? `Git: Failed · ${formatAgo(lastSyncAtMs)}` : "Git: Failed");
            el.setAttr("arial-label", `Auto Git Sync: Failed ${lastError ? `: ${lastError}` : ""}`);

            return;
        }

        if (!lastSyncAtMs) {
            el.setText("Git: Never synced");
            el.setAttr("arial-label", "Auto Git Sync: Never synced");

            return;
        }

        el.setText(`Git: ${formatAgo(lastSyncAtMs)}`);
        el.setAttr("arial-label", `Auto Git Sync: Last synced ${formatAgo(lastSyncAtMs)}`);
    }

    const setState = (patch: Partial<StatusState>) => {
        state = { ...state, ...patch };
        render();
    }

    const getState = () => state;

    timer = window.setInterval(render, 30 * 1000);
    render();

    const dispose = () => {
        timer && window.clearInterval(timer);
        timer = null;
        el.remove();
    }

    return {
        setState,
        getState,
        dispose,
    }
}

function formatAgo(tsMs: number): string {
    const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));

    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
}
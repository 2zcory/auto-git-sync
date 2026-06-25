import { App, FileSystemAdapter, requestUrl } from "obsidian";
import { SimpleGit } from "simple-git";

export function getVaultPath(app: App) {
    const adapter = app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) return adapter.getBasePath();
    return null;
}

export async function isOnline(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return false;
    }
    try {
        const res = await requestUrl({
            url: 'https://github.com',
            method: 'HEAD',
            throw: false,
        });
        return res.status >= 200 && res.status < 400;
    } catch {
        return false;
    }
}

export function getTimestampMessage() {
    const timestamp = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `Auto commit on ${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())} ${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}`;
}

interface SaveableView {
    requestSave(): void;
}

export function saveAllMarkdownViews(app: App) {
    app.workspace.getLeavesOfType('markdown').forEach(leaf => {
        const view = leaf.view;
        if (view) {
            const saveableView = view as unknown as SaveableView;
            if (typeof saveableView.requestSave === 'function') {
                saveableView.requestSave();
            }
        }
    });
}

export async function hasVaultChanged(git: SimpleGit) {
    const status = await git.status();
    return status.files.length > 0;
}
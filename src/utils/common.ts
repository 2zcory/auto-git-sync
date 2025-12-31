import { App, FileSystemAdapter } from "obsidian";
import { SimpleGit } from "simple-git";
import dns from 'dns';

export function getVaultPath(app: App) {
    const adapter = app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) return adapter.getBasePath();
    return null;
}

export async function isOnline(): Promise<boolean> {
    return new Promise((resolve) => {
        dns.lookup('github.com', (err) => {
            resolve(!err);
        });
    });
}

export function getTimestampMessage() {
    const timestamp = new Date();
    const pad = (n: Number) => n.toString().padStart(2, '0');
    return `Auto commit on ${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())} ${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}`;
}

export function saveAllMarkdownViews(app: App) {
    app.workspace.getLeavesOfType('markdown').forEach(leaf => {
        const view = leaf.view;

        // @ts-ignore
        if (view && view.requestSave) view.requestSave();
    })
}

export async function hasVaultChanged(git: SimpleGit) {
    const status = await git.status();
    return status.files.length > 0;
}
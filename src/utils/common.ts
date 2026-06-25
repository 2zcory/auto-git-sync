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

export async function checkIsRepo(git: SimpleGit): Promise<boolean> {
    try {
        return await git.checkIsRepo();
    } catch {
        return false;
    }
}

export async function getUnpushedCommitsCount(git: SimpleGit, branch: string): Promise<number> {
    try {
        const remoteBranch = `origin/${branch}`;
        const remotes = await git.branch(['-r']);
        if (!remotes.all.includes(remoteBranch)) {
            return 0;
        }
        const log = await git.log({ from: remoteBranch, to: branch });
        return log.total;
    } catch {
        return 0;
    }
}

export async function squashUnpushedCommits(git: SimpleGit, branch: string): Promise<void> {
    const remoteBranch = `origin/${branch}`;
    const count = await getUnpushedCommitsCount(git, branch);
    if (count <= 1) return;

    await git.reset(['--soft', remoteBranch]);
    const msg = `${getTimestampMessage()} (squashed)`;
    await git.commit(msg);
}

export async function getConflictedFiles(git: SimpleGit): Promise<string[]> {
    const status = await git.status();
    return status.conflicted;
}
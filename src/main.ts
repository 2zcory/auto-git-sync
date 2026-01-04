import { getTimestampMessage, getVaultPath, hasVaultChanged, isOnline, saveAllMarkdownViews } from 'utils/common';
import { Notice, Platform, Plugin } from 'obsidian';
import { SimpleGit, simpleGit } from 'simple-git';
import { setupIdleSync } from 'utils/setupIdleSync';
import { AutoGitSyncSettings, DEFAULT_SETTINGS } from 'settings';
import { AutoGitSyncSettingTab } from 'ui/AutoGitSyncSettingTab';
import { createSyncStatusBar } from 'utils/statusBar';

export default class AutoGitSyncPlugin extends Plugin {
	settings!: AutoGitSyncSettings;

	private git: SimpleGit | null = null;
	private disposeIdleSync: (() => void) | null = null;

	private statusBar: ReturnType<typeof createSyncStatusBar>;
	private lastSyncAtMs: number | null = null; // source of truth for sync state

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AutoGitSyncSettingTab(this.app, this));

		// create status bar
		this.statusBar = createSyncStatusBar(() => this.addStatusBarItem());
		this.statusBar.setState({
			phase: 'idle',
			lastSyncAtMs: this.lastSyncAtMs,
		});

		const vaultPath = getVaultPath(this.app);
		if (!vaultPath) return;

		this.git = simpleGit({ baseDir: vaultPath });

		// pull on load
		await this.pullOnLoad();

		this.addCommand({
			id: 'auto-git-sync-commit-and-push',
			name: 'Auto Git Sync: Commit and Push',
			callback: () => this.commitAndPush({ silent: false, reason: "manual" }),
		});

		if (Platform.isDesktopApp) {
			this.registerEvent(
				this.app.workspace.on('quit', (tasks) => {
					if (!this.git) return;
					tasks.addPromise(this.commitAndPush({ silent: true, reason: "quit" }));
				})
			)
		}

		await this.applyRuntimeConfig();
	}

	onunload() {
		this.disposeIdleSync?.();
		this.disposeIdleSync = null;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async applyRuntimeConfig() {
		this.disposeIdleSync?.();
		this.disposeIdleSync = null;

		if (!this.git) return;

		if (this.settings.idleSyncEnabled) {
			this.disposeIdleSync = setupIdleSync({
				app: this.app,
				git: this.git,
				idleMs: this.settings.idleSyncInterval,
				minIntervalms: 60 * 1000,
				onlineCacheMs: 30 * 1000,
			});
		}
	}

	// ----------- Core actions integrated with status ----------

	private async pullOnLoad() {
		if (!this.git) return;

		this.statusBar.setState({ phase: "syncing" });

		const online = await isOnline();
		if (!online) {
			this.statusBar.setState({ phase: "offline" });
			new Notice('Auto Git Sync failed, you are offline');
			return;
		}

		try {
			await this.git.pull('origin', (await this.git.branchLocal()).current);
			this.markSynced();
			new Notice('Auto Git Sync completed successfully');
		} catch (e) {
			this.markFailed(e);
			new Notice('Auto Git Sync failed');
			console.error('Auto Git Sync failed', e);
		}
	}

	private async commitAndPush(opts: { silent: boolean; reason: "manual" | "quit" }) {
		if (!this.git) return;

		this.statusBar.setState({ phase: "syncing" });

		try {
			const online = await isOnline();
			if (!online) {
				this.statusBar.setState({ phase: "offline" });
				if (!opts.silent) new Notice('Auto Git Sync failed, you are offline');
				return;
			}

			const changed = await hasVaultChanged(this.git);
			if (!changed) {
				this.statusBar.setState({ phase: "idle" });
				if (!opts.silent) new Notice('Auto Git Sync skipped, no changes detected');
				return;
			}

			saveAllMarkdownViews(this.app);

			const changedAfterSave = await hasVaultChanged(this.git);
			if (!changedAfterSave) {
				this.statusBar.setState({ phase: "idle" });
				if (!opts.silent) new Notice('Auto Git Sync skipped, no changes detected after saving');
				return;
			}

			await this.git.add('.');
			await this.git.commit(getTimestampMessage());
			await this.git.push('origin', (await this.git.branchLocal()).current);

			this.markSynced();
			if (!opts.silent) new Notice('Auto Git Sync completed successfully');
		} catch (e) {
			this.markFailed(e);
			if (!opts.silent) new Notice('Auto Git Sync failed');
			console.error('Auto Git Sync failed', e);
		}
	}

	private markSynced() {
		this.lastSyncAtMs = Date.now();
		this.statusBar.setState({ phase: "ok", lastSyncAtMs: this.lastSyncAtMs, lastError: undefined });
	}

	private markFailed(error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		this.statusBar.setState({ phase: "failed", lastSyncAtMs: this.lastSyncAtMs, lastError: msg });
	}
}
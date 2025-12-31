import { getTimestampMessage, getVaultPath, isOnline, saveAllMarkdownViews } from 'utils/common';
import { Notice, Platform, Plugin } from 'obsidian';
import { SimpleGit, simpleGit } from 'simple-git';
import { setupIdleSync } from 'utils/setupIdleSync';
import { AutoGitSyncSettings, DEFAULT_SETTINGS } from 'settings';
import { AutoGitSyncSettingTab } from 'ui/AutoGitSyncSettingTab';

export default class AutoGitSyncPlugin extends Plugin {
	settings!: AutoGitSyncSettings;

	private git: SimpleGit | null = null;
	private disposeIdleSync: (() => void) | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AutoGitSyncSettingTab(this.app, this));

		const online = await isOnline();
		if (!online) {
			new Notice('Auto Git Sync failed, you are offline');
			return;
		}

		const vaultPath = getVaultPath(this.app);
		if (!vaultPath) return;

		this.git = simpleGit({ baseDir: vaultPath });

		// try to sync
		try {
			const currentBranch = (await this.git.branchLocal()).current;
			await this.git.pull('origin', currentBranch, { '--rebase': 'true' });
			console.log('Synced successfully');
			new Notice('Auto Git Sync completed successfully');
		} catch (error) {
			console.error('Sync failed', error);
			new Notice('Auto Git Sync failed');
		}

		await this.applyRuntimeConfig();

		if (Platform.isDesktopApp) {
			const git = this.git;
			this.registerEvent(
				this.app.workspace.on('quit', (tasks) => {
					const commitAndPushTask = async () => {
						try {
							saveAllMarkdownViews(this.app);
							await git.add('.');
							await git.commit(getTimestampMessage());
							await git.push('origin', (await git.branchLocal()).current);
							console.log('Auto Git Sync Push completed successfully');
						} catch (error) {
							console.error('Auto Git Sync Push failed', error);
						}
					}
					tasks.addPromise(commitAndPushTask());
				})
			)
		}
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
}
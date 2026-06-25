import { getTimestampMessage, getVaultPath, hasVaultChanged, isOnline, saveAllMarkdownViews, checkIsRepo, getUnpushedCommitsCount, squashUnpushedCommits, getConflictedFiles } from 'utils/common';
import { Notice, Platform, Plugin } from 'obsidian';
import { SimpleGit, simpleGit } from 'simple-git';
import { setupIdleSync } from 'utils/setupIdleSync';
import { AutoGitSyncSettings, DEFAULT_SETTINGS } from 'settings';
import { AutoGitSyncSettingTab } from 'ui/AutoGitSyncSettingTab';
import { createSyncStatusBar } from 'utils/statusBar';
import { ConflictResolveModal } from 'ui/ConflictResolveModal';

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
		const statusBarItem = this.addStatusBarItem();
		statusBarItem.addEventListener('click', () => {
			if (this.statusBar.getState().phase === 'conflict') {
				void this.showConflictModal();
			}
		});
		this.statusBar = createSyncStatusBar(() => statusBarItem);
		this.statusBar.setState({
			phase: 'idle',
			lastSyncAtMs: this.lastSyncAtMs,
		});

		const vaultPath = getVaultPath(this.app);
		if (!vaultPath) return;

		this.git = simpleGit({ baseDir: vaultPath });

		// pull on load (non-blocking)
		this.app.workspace.onLayoutReady(() => {
			void this.pullOnLoad();
		});

		this.addCommand({
			id: 'commit-and-push',
			name: 'Commit and push',
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as AutoGitSyncSettings;
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
		await this.performSync({ silent: true, pullOnly: true });
	}

	private async commitAndPush(opts: { silent: boolean; reason: "manual" | "quit" }) {
		await this.performSync({ silent: opts.silent });
	}

	private async performSync(opts: { silent: boolean; pullOnly?: boolean }) {
		if (!this.git) return;

		this.statusBar.setState({ phase: "syncing" });

		try {
			// 1. Check if git repo is initialized
			const isRepo = await checkIsRepo(this.git);
			if (!isRepo) {
				this.statusBar.setState({ phase: "failed", lastError: "Not a git repository" });
				if (!opts.silent) new Notice("Đồng bộ thất bại: thư mục không phải Git repository");
				return;
			}

			// 2. Check remote configuration
			const remotes = await this.git.getRemotes();
			const hasOrigin = remotes.some(r => r.name === 'origin');
			if (!hasOrigin) {
				this.statusBar.setState({ phase: "failed", lastError: "No 'origin' remote" });
				if (!opts.silent) new Notice("Đồng bộ thất bại: chưa cấu hình remote 'origin'");
				return;
			}

			// 3. Check connectivity
			const online = await isOnline();
			if (!online) {
				this.statusBar.setState({ phase: "offline" });
				if (!opts.silent) new Notice("Đồng bộ thất bại: ngoại tuyến (offline)");
				return;
			}

			const branch = (await this.git.branchLocal()).current;

			// 4. Commit local changes if not pullOnly
			if (!opts.pullOnly) {
				const changed = await hasVaultChanged(this.git);
				if (changed) {
					saveAllMarkdownViews(this.app);
					const changedAfterSave = await hasVaultChanged(this.git);
					if (changedAfterSave) {
						await this.git.add('.');
						await this.git.commit(getTimestampMessage());
					}
				}
			}

			// 5. Fetch remote changes
			await this.git.raw(['fetch', 'origin']);

			// 6. Squash unpushed commits if > 1
			await squashUnpushedCommits(this.git, branch);

			// 7. Pull and rebase
			try {
				await this.git.raw(['pull', '--rebase', '--autostash', 'origin', branch]);
			} catch (e) {
				const conflicted = await getConflictedFiles(this.git);
				if (conflicted.length > 0) {
					this.statusBar.setState({ phase: "conflict" });
					new Notice("Conflict detected! Click the status bar to resolve.");
					this.handleConflict(conflicted);
					return;
				} else {
					throw e;
				}
			}

			// 8. Push if we have unpushed commits
			const unpushedCount = await getUnpushedCommitsCount(this.git, branch);
			if (unpushedCount > 0) {
				await this.git.raw(['push', 'origin', branch]);
			}

			this.markSynced();
			if (!opts.silent) new Notice("Sync completed successfully!");
		} catch (e) {
			this.markFailed(e);
			if (!opts.silent) new Notice("Sync failed");
			console.error("Sync failed", e);
		}
	}

	private handleConflict(conflictedFiles: string[]) {
		new ConflictResolveModal(
			this.app,
			conflictedFiles,
			(resolutions) => {
				void this.applyResolutions(resolutions);
			},
			() => {
				void this.abortRebase();
			}
		).open();
	}

	private async applyResolutions(resolutions: Record<string, 'local' | 'remote' | 'manual'>) {
		try {
			this.statusBar.setState({ phase: "syncing" });
			for (const [file, choice] of Object.entries(resolutions)) {
				if (choice === 'local') {
					await this.git!.raw(['checkout', '--theirs', file]);
					await this.git!.add(file);
				} else if (choice === 'remote') {
					await this.git!.raw(['checkout', '--ours', file]);
					await this.git!.add(file);
				} else if (choice === 'manual') {
					await this.git!.add(file);
				}
			}

			try {
				await this.git!.raw(['-c', 'core.editor=true', 'rebase', '--continue']);
				
				const status = await this.git!.status();
				if (status.conflicted.length > 0) {
					void this.handleConflict(status.conflicted);
				} else {
					const branch = (await this.git!.branchLocal()).current;
					await this.git!.raw(['push', 'origin', branch]);
					this.markSynced();
					new Notice('Conflict resolved and synced successfully!');
				}
			} catch (e) {
				const status = await this.git!.status();
				if (status.conflicted.length > 0) {
					void this.handleConflict(status.conflicted);
				} else {
					this.markFailed(e);
					new Notice('Error occurred during rebase');
				}
			}
		} catch (e) {
			this.markFailed(e);
			new Notice('Failed to apply conflict resolution');
		}
	}

	private async abortRebase() {
		try {
			await this.git!.raw(['rebase', '--abort']);
			this.statusBar.setState({ phase: "idle" });
			new Notice('Sync aborted: reverted to local state');
		} catch (e) {
			console.error('Failed to abort rebase', e);
		}
	}

	private async showConflictModal() {
		if (!this.git) return;
		try {
			const status = await this.git.status();
			if (status.conflicted.length > 0) {
				void this.handleConflict(status.conflicted);
			} else {
				this.statusBar.setState({ phase: "idle" });
				new Notice('No conflicts detected');
			}
		} catch (e) {
			console.error('Failed to show conflict modal', e);
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
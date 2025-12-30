import { FileSystemAdapter, Notice, Plugin } from 'obsidian';
import { SimpleGit, simpleGit } from 'simple-git';

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	async onload() {
		const adapter = this.app.vault.adapter;
		// check if the adapter is a FileSystemAdapter
		if (!(adapter instanceof FileSystemAdapter)) return;
		const vaultPath = adapter.getBasePath();
		const git: SimpleGit = simpleGit({ baseDir: vaultPath });

		// try to sync
		try {
			const currentBranch = (await git.branchLocal()).current;
			await git.pull('origin', currentBranch, { '--rebase': 'true' });
			console.log('Synced successfully');
		} catch (error) {
			console.error('Sync failed', error);

			// show a notice
			new Notice('Sync failed, please commit/remove your changes first.');
		}

		this.addCommand({
			id: 'auto-git-sync-push',
			name: 'Auto Git Sync Push',
			callback: async () => {
				const adapter = this.app.vault.adapter;
				if (!(adapter instanceof FileSystemAdapter)) {
					new Notice('This plugin only works on Desktop version of Obsidian');
					return;
				};
				const vaultPath = adapter.getBasePath();
				const git: SimpleGit = simpleGit({ baseDir: vaultPath });
				try {
					await git.add('.');
					const timestamp = new Date();
					const pad = (n: Number) => n.toString().padStart(2, '0');
					const commitMessage = `Auto commit on ${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())} ${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}`;
					await git.commit(commitMessage);
					await git.push('origin', (await git.branchLocal()).current);
					new Notice('Auto Git Sync Push completed successfully');
				} catch (error) {
					console.error('Auto Git Sync Push failed', error);
					new Notice('Auto Git Sync Push failed');
				}
			}
		});
	}

	onunload() {
	}
}
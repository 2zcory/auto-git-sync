import AutoGitSyncPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class AutoGitSyncSettingTab extends PluginSettingTab {
    plugin: AutoGitSyncPlugin;

    constructor(app: App, plugin: AutoGitSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        // Top Heading (avoids using "settings" or "general")
        new Setting(containerEl).setName('Git sync').setHeading();

        // --- Sync Triggers ---
        new Setting(containerEl)
            .setName('Sync triggers')
            .setDesc('Configure when the plugin should perform Git synchronization operations.')
            .setHeading();

        new Setting(containerEl)
            .setName('Sync on startup')
            .setDesc('Choose sync behavior when Obsidian loads.')
            .addDropdown(dropdown => dropdown
                .addOption('disabled', 'Disabled')
                .addOption('pull', 'Pull only (default)')
                .addOption('pull-push', 'Pull and push')
                .setValue(this.plugin.settings.syncOnStartup)
                .onChange(async (v) => {
                    this.plugin.settings.syncOnStartup = v as "disabled" | "pull" | "pull-push";
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Sync on exit')
            .setDesc('Commit and push changes when Obsidian closes.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncOnQuit)
                .onChange(async (v) => {
                    this.plugin.settings.syncOnQuit = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Conflict resolution behavior')
            .setDesc('What to do when merge/rebase conflicts are detected during pull.')
            .addDropdown(dropdown => dropdown
                .addOption('modal', 'Show interactive modal')
                .addOption('abort', 'Abort and revert to local')
                .setValue(this.plugin.settings.conflictBehavior)
                .onChange(async (v) => {
                    this.plugin.settings.conflictBehavior = v as "modal" | "abort";
                    await this.plugin.saveSettings();
                })
            );

        // --- Idle Sync Section ---
        new Setting(containerEl)
            .setName('Idle background sync')
            .setDesc('Configure automatic background sync when you stop typing or moving your mouse.')
            .setHeading();

        new Setting(containerEl)
            .setName('Enable idle sync')
            .setDesc('Sync when the device becomes idle.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.idleSyncEnabled)
                .onChange(async (v) => {
                    this.plugin.settings.idleSyncEnabled = v;
                    await this.plugin.saveSettings();
                    await this.plugin.applyRuntimeConfig();
                    this.display(); // Redraw to show/hide interval setting
                })
            );

        if (this.plugin.settings.idleSyncEnabled) {
            new Setting(containerEl)
                .setName('Idle sync timeout')
                .setDesc('Time of inactivity required before triggering an automatic background sync.')
                .addDropdown(dropdown => dropdown
                    .addOption((15 * 1000).toString(), '15s')
                    .addOption((30 * 1000).toString(), '30s')
                    .addOption((60 * 1000).toString(), '1m')
                    .addOption((5 * 60 * 1000).toString(), '5m (default)')
                    .addOption((10 * 60 * 1000).toString(), '10m')
                    .addOption((15 * 60 * 1000).toString(), '15m')
                    .addOption((30 * 60 * 1000).toString(), '30m')
                    .addOption((60 * 60 * 1000).toString(), '1h')
                    .setValue(this.plugin.settings.idleSyncInterval.toString())
                    .onChange(async (v) => {
                        this.plugin.settings.idleSyncInterval = parseInt(v);
                        await this.plugin.saveSettings();
                        await this.plugin.applyRuntimeConfig();
                    })
                );
        }

        // --- Commit & Repo Settings ---
        new Setting(containerEl)
            .setName('Commit and repository')
            .setDesc('Customize how commit messages are formatted and what branch to target.')
            .setHeading();

        new Setting(containerEl)
            .setName('Commit message template')
            .setDesc('Dynamic placeholders: {{datetime}} (timestamp), {{device}} (desktop/mobile), {{reason}} (manual/idle/quit/startup).')
            .addText(text => text
                .setPlaceholder('E.g., Vault sync: {{datetime}}')
                .setValue(this.plugin.settings.commitMessageTemplate)
                .onChange(async (v) => {
                    this.plugin.settings.commitMessageTemplate = v || 'Vault sync: {{datetime}}';
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Target branch override')
            .setDesc('Specify a branch name to target for sync. Leave empty to auto-detect and track current active branch.')
            .addText(text => text
                .setPlaceholder('E.g., main')
                .setValue(this.plugin.settings.syncBranch)
                .onChange(async (v) => {
                    this.plugin.settings.syncBranch = v.trim();
                    await this.plugin.saveSettings();
                })
            );

        // --- Advanced Network Settings ---
        new Setting(containerEl)
            .setName('Advanced network')
            .setDesc('Configure parameters for network connectivity checks.')
            .setHeading();

        new Setting(containerEl)
            .setName('Connectivity check URL')
            .setDesc('URL pinged to verify internet access before performing Git operations.')
            .addText(text => text
                .setPlaceholder('https://github.com')
                .setValue(this.plugin.settings.connectionCheckUrl)
                .onChange(async (v) => {
                    this.plugin.settings.connectionCheckUrl = v.trim() || 'https://github.com';
                    await this.plugin.saveSettings();
                })
            );
    }
}
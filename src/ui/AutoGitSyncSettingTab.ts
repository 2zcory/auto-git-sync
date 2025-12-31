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

        containerEl.createEl('h2', { text: 'Auto Git Sync Settings' });

        new Setting(containerEl)
            .setName('Idle Sync')
            .setDesc('Sync when you are idle')
            .addToggle(toggle => toggle.setValue(this.plugin.settings.idleSyncEnabled).onChange(async (v) => {
                this.plugin.settings.idleSyncEnabled = v;
                await this.plugin.saveSettings();
                await this.plugin.applyRuntimeConfig();
                this.display();
            }));

        if (this.plugin.settings.idleSyncEnabled) {
            new Setting(containerEl)
                .setName('Idle Sync Interval')
                .setDesc('Interval between idle syncs')
                .addDropdown(dropdown => dropdown
                    .addOption((15 * 1000).toString(), '15s')
                    .addOption((30 * 1000).toString(), '30s')
                    .addOption((60 * 1000).toString(), '1m')
                    .addOption((5 * 60 * 1000).toString(), '5m')
                    .addOption((10 * 60 * 1000).toString(), '10m')
                    .addOption((15 * 60 * 1000).toString(), '15m')
                    .addOption((30 * 60 * 1000).toString(), '30m')
                    .addOption((60 * 60 * 1000).toString(), '1h')
                    .setValue(this.plugin.settings.idleSyncInterval.toString())
                    .onChange(async (v) => {
                        this.plugin.settings.idleSyncInterval = parseInt(v);
                        await this.plugin.saveSettings();
                        await this.plugin.applyRuntimeConfig();
                        this.display();
                    })
                );
        }
    }
}
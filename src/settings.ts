export interface AutoGitSyncSettings {
    idleSyncEnabled: boolean;
    idleSyncInterval: number;
}

export const DEFAULT_SETTINGS: AutoGitSyncSettings = {
    idleSyncEnabled: true,
    idleSyncInterval: 15 * 1000,
}
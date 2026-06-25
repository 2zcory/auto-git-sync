export interface AutoGitSyncSettings {
    idleSyncEnabled: boolean;
    idleSyncInterval: number;
    syncOnStartup: "disabled" | "pull" | "pull-push";
    syncOnQuit: boolean;
    commitMessageTemplate: string;
    syncBranch: string;
    conflictBehavior: "modal" | "abort";
    connectionCheckUrl: string;
}

export const DEFAULT_SETTINGS: AutoGitSyncSettings = {
    idleSyncEnabled: true,
    idleSyncInterval: 5 * 60 * 1000,
    syncOnStartup: "pull",
    syncOnQuit: true,
    commitMessageTemplate: "Vault sync: {{datetime}} [{{device}}] [{{reason}}]",
    syncBranch: "",
    conflictBehavior: "modal",
    connectionCheckUrl: "https://github.com",
}
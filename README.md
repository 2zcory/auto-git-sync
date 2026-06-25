# Auto Git Sync

Auto Git Sync is an Obsidian plugin that automatically synchronizes your markdown vault with a remote Git repository. It runs in the background and keeps your notes up-to-date across multiple devices.

## Features

- **Startup Pull**: Automatically pulls the latest changes from your remote Git repository when your vault loads.
- **Auto Commit & Push**: Automatically stages, commits, and pushes your changes when files are saved, when you exit Obsidian, or when triggered manually.
- **Idle Sync**: Automatically syncs your vault after you have been inactive/idle for a configured duration.
- **Status Bar Indicator**: Displays real-time sync states directly in the status bar (e.g. `syncing...`, `last synced Xm ago`, `offline`, `failed`).
- **Mobile Compatibility Ready**: Replaced Node-specific modules with standard Web APIs (using Obsidian's native `requestUrl` and `navigator.onLine`) to allow compatibility with future mobile deployments.

## Installation

### Manual Installation
1. Clone this repository into your vault's plugins folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/
   git clone git@github.com:2zcory/auto-git-sync.git
   ```
2. Navigate into the plugin directory and install dependencies:
   ```bash
   cd auto-git-sync
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Open Obsidian, navigate to **Settings → Community plugins**, and enable **Auto Git Sync**.

## Settings

Open **Settings → Git sync** in Obsidian to configure the following options:

- **Idle sync**: Toggle to enable or disable automatic synchronization when you are idle.
- **Idle sync interval**: The period of inactivity (e.g., 15s, 30s, 1m, 5m, etc.) required before triggering a sync.

## Development

- `npm run dev`: Build and watch for changes. Changes compile instantly to `main.js`.
- `npm run build`: Production build and minification.
- `npm run lint`: Run ESLint to verify code quality and style guides.

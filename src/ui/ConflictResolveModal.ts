import { App, ButtonComponent, Modal, Setting, TFile } from "obsidian";

export class ConflictResolveModal extends Modal {
    private conflictedFiles: string[];
    private resolutions: Record<string, 'local' | 'remote' | 'manual' | null> = {};
    private onResolve: (resolutions: Record<string, 'local' | 'remote' | 'manual'>) => void;
    private onAbort: () => void;
    private continueBtn: ButtonComponent | null = null;

    constructor(
        app: App,
        conflictedFiles: string[],
        onResolve: (resolutions: Record<string, 'local' | 'remote' | 'manual'>) => void,
        onAbort: () => void
    ) {
        super(app);
        this.conflictedFiles = conflictedFiles;
        this.onResolve = onResolve;
        this.onAbort = onAbort;

        for (const file of conflictedFiles) {
            this.resolutions[file] = null;
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "Git sync conflict" });
        contentEl.createEl("p", {
            text: "Conflicts detected between local changes and remote changes. Please select a resolution for each file below:",
        });

        const listEl = contentEl.createDiv({ cls: "git-conflict-list" });

        this.conflictedFiles.forEach((filePath) => {
            const fileRow = new Setting(listEl)
                .setName(filePath)
                .setDesc("Chưa chọn giải pháp (vui lòng chọn một)");

            const updateRowDesc = () => {
                const choice = this.resolutions[filePath];
                if (choice === 'local') {
                    fileRow.setDesc("Lựa chọn: giữ bản local của đại ca");
                } else if (choice === 'remote') {
                    fileRow.setDesc("Lựa chọn: giữ bản remote");
                } else if (choice === 'manual') {
                    fileRow.setDesc("Lựa chọn: tự sửa tay");
                } else {
                    fileRow.setDesc("Chưa chọn giải pháp (vui lòng chọn một)");
                }
            };

            fileRow.addButton((btn) => {
                btn.setButtonText("Keep local")
                    .setTooltip("Giữ nội dung hiện tại trên máy này")
                    .onClick(() => {
                        this.resolutions[filePath] = 'local';
                        updateRowDesc();
                        this.updateActionButtons();
                    });
            });

            fileRow.addButton((btn) => {
                btn.setButtonText("Keep remote")
                    .setTooltip("Lấy nội dung mới từ server")
                    .onClick(() => {
                        this.resolutions[filePath] = 'remote';
                        updateRowDesc();
                        this.updateActionButtons();
                    });
            });

            fileRow.addButton((btn) => {
                btn.setButtonText("Tự sửa tay")
                    .setTooltip("Mở file và sửa dấu xung đột trực tiếp")
                    .onClick(() => {
                        this.resolutions[filePath] = 'manual';
                        updateRowDesc();
                        this.updateActionButtons();

                        const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
                        if (abstractFile instanceof TFile) {
                            const leaf = this.app.workspace.getLeaf(false);
                            if (leaf) {
                                void leaf.openFile(abstractFile);
                            }
                        }
                        this.close();
                    });
            });
        });

        const actionsEl = contentEl.createDiv({ cls: "git-conflict-actions" });

        new Setting(actionsEl).addButton((btn) => {
            btn.setButtonText("Hủy đồng bộ (abort)")
                .setWarning()
                .onClick(() => {
                    this.onAbort();
                    this.close();
                });
        });

        new Setting(actionsEl).addButton((btn) => {
            this.continueBtn = btn;
            btn.setButtonText("Xác nhận và tiếp tục")
                .setCta()
                .onClick(() => {
                    const finalResolutions: Record<string, 'local' | 'remote' | 'manual'> = {};
                    let allResolved = true;
                    for (const file of this.conflictedFiles) {
                        const choice = this.resolutions[file];
                        if (!choice) {
                            allResolved = false;
                            break;
                        }
                        finalResolutions[file] = choice;
                    }

                    if (allResolved) {
                        this.onResolve(finalResolutions);
                        this.close();
                    }
                });
        });
        
        this.updateActionButtons();
    }

    private updateActionButtons() {
        if (!this.continueBtn) return;
        const allResolved = this.conflictedFiles.every(file => this.resolutions[file] !== null);
        this.continueBtn.setDisabled(!allResolved);
    }
}

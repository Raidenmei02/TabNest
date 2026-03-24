"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveService = void 0;
const vscode = __importStar(require("vscode"));
const tabs_1 = require("../core/tabs");
const settings_1 = require("../config/settings");
class MoveService {
    groupService;
    constructor(groupService) {
        this.groupService = groupService;
    }
    async moveActiveEditorToGroup() {
        const activeGroup = vscode.window.tabGroups.activeTabGroup;
        const activeTab = activeGroup.activeTab;
        if (!activeTab) {
            void vscode.window.showInformationMessage("No active editor to move.");
            return;
        }
        const uri = (0, tabs_1.getTabUri)(activeTab.input);
        if (!uri) {
            void vscode.window.showWarningMessage("Active editor type is not supported for moving.");
            return;
        }
        const targetGroupIndex = await this.pickTargetGroup();
        if (!targetGroupIndex) {
            return;
        }
        const targetGroup = await this.groupService.ensureGroupIndex(targetGroupIndex);
        await this.groupService.assignUri(uri, targetGroup.id);
    }
    async moveOpenEditorToGroup(target) {
        const uri = target?.uri ?? (await this.pickOpenEditor())?.uri;
        if (!uri) {
            return;
        }
        const targetGroupIndex = await this.pickTargetGroup();
        if (!targetGroupIndex) {
            return;
        }
        const targetGroup = await this.groupService.ensureGroupIndex(targetGroupIndex);
        await this.groupService.assignUri(uri, targetGroup.id);
    }
    async removeOpenEditorFromGroup(target) {
        const uri = target?.uri ?? (await this.pickOpenEditor())?.uri;
        if (!uri) {
            return;
        }
        await this.groupService.assignUri(uri, "ungrouped");
    }
    async assignUrisToGroup(uris, groupId) {
        await this.groupService.assignUris(uris, groupId);
    }
    async addGroup() {
        const name = await vscode.window.showInputBox({
            title: "Add TabNest Group",
            prompt: "Enter group name",
            placeHolder: "e.g. API, Frontend, Research"
        });
        if (!name) {
            return undefined;
        }
        try {
            return await this.groupService.addGroup(name);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(message);
            return undefined;
        }
    }
    async deleteGroup(target) {
        const group = target ?? (await this.pickGroupForDelete());
        if (!group) {
            return;
        }
        if (group.builtIn || group.groupId === "ungrouped") {
            void vscode.window.showInformationMessage("Built-in group cannot be deleted.");
            return;
        }
        if ((0, settings_1.getConfirmDeleteGroup)()) {
            const confirmed = await vscode.window.showWarningMessage(`Delete group "${group.groupName}"? Files in it will move to Ungrouped.`, { modal: true }, "Delete", "Delete and don't ask again");
            if (!confirmed) {
                return;
            }
            if (confirmed === "Delete and don't ask again") {
                await (0, settings_1.setConfirmDeleteGroup)(false);
            }
        }
        const ok = await this.groupService.deleteGroup(group.groupId);
        if (!ok) {
            void vscode.window.showWarningMessage("Group was not deleted.");
        }
    }
    async renameGroup(target) {
        const group = target ?? (await this.pickGroupForRename());
        if (!group) {
            return;
        }
        if (group.builtIn || group.groupId === "ungrouped") {
            void vscode.window.showInformationMessage("Built-in group cannot be renamed.");
            return;
        }
        const nextName = await vscode.window.showInputBox({
            title: "Rename TabNest Group",
            prompt: "Enter new group name",
            value: group.groupName,
            placeHolder: "e.g. API, Frontend, Research"
        });
        if (nextName === undefined) {
            return;
        }
        try {
            await this.groupService.renameGroup(group.groupId, nextName);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(message);
        }
    }
    async pickTargetGroup() {
        const groups = this.groupService.getGroups();
        const options = [];
        for (let i = 1; i <= groups.length; i += 1) {
            options.push({
                label: `${i}. ${groups[i - 1].name}`
            });
        }
        options.push({ label: `${groups.length + 1}. Create New Group...`, description: "create" });
        const picked = await vscode.window.showQuickPick(options, {
            title: "Move to group",
            placeHolder: "Select target logical group"
        });
        if (!picked) {
            return undefined;
        }
        const selected = parseGroupPick(picked.label, groups);
        if (selected?.type === "existing") {
            return selected.index;
        }
        if (selected?.type === "create") {
            const before = this.groupService.getGroups().length;
            const created = await this.addGroup();
            if (!created) {
                return undefined;
            }
            const after = this.groupService.getGroups();
            const index = after.findIndex((group) => group.id === created.id);
            if (index >= 0) {
                return index + 1;
            }
            return before + 1;
        }
        return undefined;
    }
    async pickOpenEditor() {
        const items = [];
        const seen = new Set();
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                const uri = (0, tabs_1.getTabUri)(tab.input);
                if (!uri) {
                    continue;
                }
                const key = uri.toString();
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                items.push({
                    label: (0, tabs_1.tabLabel)(tab.label, uri),
                    description: "Open editor",
                    detail: (0, tabs_1.getMatchTarget)(uri),
                    uri
                });
            }
        }
        if (items.length === 0) {
            void vscode.window.showInformationMessage("No movable open editors found.");
            return undefined;
        }
        const picked = await vscode.window.showQuickPick(items, {
            title: "Select open editor",
            placeHolder: "Choose an open editor to move"
        });
        if (!picked) {
            return undefined;
        }
        return {
            uri: picked.uri
        };
    }
    async pickGroupForDelete() {
        const groups = this.groupService.getGroups().filter((group) => !group.builtIn);
        if (groups.length === 0) {
            void vscode.window.showInformationMessage("No custom groups to delete.");
            return undefined;
        }
        const picked = await vscode.window.showQuickPick(groups.map((group) => ({
            label: group.name,
            description: group.id,
            groupId: group.id
        })), {
            title: "Delete group",
            placeHolder: "Select a group to delete"
        });
        if (!picked) {
            return undefined;
        }
        return {
            type: "group",
            groupId: picked.groupId,
            groupName: picked.label,
            builtIn: false,
            id: `group:${picked.groupId}`
        };
    }
    async pickGroupForRename() {
        const groups = this.groupService.getGroups().filter((group) => !group.builtIn);
        if (groups.length === 0) {
            void vscode.window.showInformationMessage("No custom groups to rename.");
            return undefined;
        }
        const picked = await vscode.window.showQuickPick(groups.map((group) => ({
            label: group.name,
            description: group.id,
            groupId: group.id
        })), {
            title: "Rename group",
            placeHolder: "Select a group to rename"
        });
        if (!picked) {
            return undefined;
        }
        return {
            type: "group",
            groupId: picked.groupId,
            groupName: picked.label,
            builtIn: false,
            id: `group:${picked.groupId}`
        };
    }
}
exports.MoveService = MoveService;
function parseGroupPick(label, groups) {
    if (label.includes("Create New Group")) {
        return { type: "create" };
    }
    const matched = /^(\d+)\.\s/.exec(label);
    if (!matched) {
        return undefined;
    }
    const value = Number(matched[1]);
    if (!Number.isInteger(value) || value < 1 || value > groups.length) {
        return undefined;
    }
    return { type: "existing", index: value };
}
//# sourceMappingURL=move-service.js.map
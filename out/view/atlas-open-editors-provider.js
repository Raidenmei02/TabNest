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
exports.AtlasOpenEditorsProvider = void 0;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../constants");
const tabs_1 = require("../core/tabs");
class AtlasOpenEditorsProvider {
    dropMimeTypes = [constants_1.TREE_MIME, "text/uri-list"];
    dragMimeTypes = [constants_1.TREE_MIME];
    moveService;
    groupService;
    emitter = new vscode.EventEmitter();
    tabsSub;
    groupsSub;
    assignmentSub;
    onDidChangeTreeData = this.emitter.event;
    constructor(moveService, groupService) {
        this.moveService = moveService;
        this.groupService = groupService;
        this.tabsSub = vscode.window.tabGroups.onDidChangeTabs(() => this.refresh());
        this.groupsSub = vscode.window.tabGroups.onDidChangeTabGroups(() => this.refresh());
        this.assignmentSub = this.groupService.onDidChange(() => this.refresh());
    }
    dispose() {
        this.tabsSub.dispose();
        this.groupsSub.dispose();
        this.assignmentSub.dispose();
        this.emitter.dispose();
    }
    refresh() {
        this.emitter.fire(undefined);
    }
    getTreeItem(element) {
        if (element.type === "group") {
            const item = new vscode.TreeItem(element.groupName, vscode.TreeItemCollapsibleState.Expanded);
            item.id = element.id;
            item.description = element.groupId === "ungrouped" ? "default" : undefined;
            item.contextValue = element.builtIn ? "atlasGroupBuiltIn" : "atlasGroupCustom";
            return item;
        }
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.id = element.id;
        item.resourceUri = element.uri;
        item.description = undefined;
        item.contextValue = "atlasEditor";
        item.command = {
            command: "vscode.open",
            title: "Open",
            arguments: [element.uri]
        };
        return item;
    }
    getChildren(element) {
        if (!element) {
            return this.groupService.getGroups().map((group) => ({
                type: "group",
                groupId: group.id,
                groupName: group.name,
                builtIn: group.builtIn,
                id: `group:${group.id}`
            }));
        }
        if (element.type !== "group") {
            return [];
        }
        const seen = new Set(); // de-dup same file opened in multiple editors
        const result = [];
        for (const tabGroup of vscode.window.tabGroups.all) {
            for (const tab of tabGroup.tabs) {
                const uri = (0, tabs_1.getTabUri)(tab.input);
                if (!uri) {
                    continue;
                }
                const key = uri.toString();
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                if (this.groupService.getAssignedGroupId(uri) !== element.groupId) {
                    continue;
                }
                result.push({
                    type: "editor",
                    uri,
                    groupId: element.groupId,
                    label: (0, tabs_1.tabLabel)(tab.label, uri),
                    id: `editor:${element.groupId}:${uri.toString()}`
                });
            }
        }
        return result;
    }
    async handleDrag(source, dataTransfer) {
        const payload = source
            .filter((node) => node.type === "editor")
            .map((node) => node.uri.toString());
        if (payload.length === 0) {
            return;
        }
        dataTransfer.set(constants_1.TREE_MIME, new vscode.DataTransferItem(JSON.stringify(payload)));
    }
    async handleDrop(target, dataTransfer) {
        if (!target || target.type !== "group") {
            return;
        }
        const treePayload = dataTransfer.get(constants_1.TREE_MIME);
        if (treePayload) {
            const raw = await treePayload.asString();
            const entries = parseTreePayload(raw);
            await this.moveService.assignUrisToGroup(entries, target.groupId);
            this.refresh();
            return;
        }
        const uriList = dataTransfer.get("text/uri-list");
        if (uriList) {
            const raw = await uriList.asString();
            const uris = parseUriList(raw);
            await this.moveService.assignUrisToGroup(uris, target.groupId);
            for (const uri of uris) {
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
                }
                catch {
                    // ignore non-openable URI
                }
            }
            this.refresh();
        }
    }
}
exports.AtlasOpenEditorsProvider = AtlasOpenEditorsProvider;
function parseTreePayload(raw) {
    try {
        const parsed = JSON.parse(raw);
        return parsed.flatMap((item) => {
            if (typeof item !== "string") {
                return [];
            }
            return [vscode.Uri.parse(item)];
        });
    }
    catch {
        return [];
    }
}
function parseUriList(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => !!line && !line.startsWith("#"))
        .flatMap((line) => {
        try {
            return [vscode.Uri.parse(line)];
        }
        catch {
            return [];
        }
    });
}
//# sourceMappingURL=atlas-open-editors-provider.js.map
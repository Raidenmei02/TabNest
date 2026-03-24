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
exports.TabNestOpenEditorsProvider = void 0;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../constants");
const tabs_1 = require("../core/tabs");
class TabNestOpenEditorsProvider {
    static COLLAPSED_GROUPS_KEY = "tabNest.collapsedGroups.v1";
    dropMimeTypes = [constants_1.TREE_MIME, "text/uri-list"];
    dragMimeTypes = [constants_1.TREE_MIME];
    moveService;
    groupService;
    emitter = new vscode.EventEmitter();
    tabsSub;
    groupsSub;
    assignmentSub;
    collapsedGroupIds = new Set();
    state;
    searchQuery = "";
    searchTerms = [];
    onDidChangeTreeData = this.emitter.event;
    constructor(moveService, groupService, state) {
        this.moveService = moveService;
        this.groupService = groupService;
        this.state = state;
        const stored = this.state.get(TabNestOpenEditorsProvider.COLLAPSED_GROUPS_KEY, []);
        for (const groupId of stored) {
            if (typeof groupId === "string" && groupId) {
                this.collapsedGroupIds.add(groupId);
            }
        }
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
    setGroupCollapsed(groupId, collapsed) {
        if (!groupId) {
            return;
        }
        if (collapsed) {
            this.collapsedGroupIds.add(groupId);
        }
        else {
            this.collapsedGroupIds.delete(groupId);
        }
        void this.state.update(TabNestOpenEditorsProvider.COLLAPSED_GROUPS_KEY, Array.from(this.collapsedGroupIds));
    }
    setSearchQuery(query) {
        this.searchQuery = query.trim();
        this.searchTerms = this.searchQuery
            .toLowerCase()
            .split(/\s+/)
            .filter((item) => !!item);
        this.refresh();
    }
    clearSearch() {
        this.setSearchQuery("");
    }
    getSearchQuery() {
        return this.searchQuery;
    }
    getTreeItem(element) {
        if (element.type === "group") {
            const collapsibleState = this.collapsedGroupIds.has(element.groupId)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded;
            const item = new vscode.TreeItem(element.groupName, collapsibleState);
            item.id = element.id;
            item.description = element.groupId === "ungrouped" ? "default" : undefined;
            item.contextValue = element.builtIn ? "tabNestGroupBuiltIn" : "tabNestGroupCustom";
            return item;
        }
        if (element.type === "folder") {
            const item = new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.Collapsed);
            item.id = element.id;
            item.description = element.folderPath;
            item.contextValue = "tabNestFolder";
            return item;
        }
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.id = element.id;
        item.resourceUri = element.uri;
        item.description = vscode.workspace.asRelativePath(element.uri, false);
        item.tooltip = element.uri.fsPath || element.uri.toString();
        item.contextValue = "tabNestEditor";
        item.command = {
            command: "vscode.open",
            title: "Open",
            arguments: [element.uri]
        };
        return item;
    }
    getChildren(element) {
        if (!element) {
            const groups = this.groupService.getGroups().map((group) => ({
                type: "group",
                groupId: group.id,
                groupName: group.name,
                builtIn: group.builtIn,
                id: `group:${group.id}`
            }));
            if (this.searchTerms.length === 0) {
                return groups;
            }
            return groups.filter((group) => {
                if (this.matchesGroup(group.groupName)) {
                    return true;
                }
                return this.pickCandidateEditors(group.groupId, false).length > 0;
            });
        }
        if (element.type === "folder") {
            const editors = this.pickCandidateEditors(element.groupId, false);
            return this.getFolderChildren(element.groupId, element.folderPath, editors);
        }
        if (element.type !== "group") {
            return [];
        }
        const editors = this.pickCandidateEditors(element.groupId, this.matchesGroup(element.groupName));
        return this.getFolderChildren(element.groupId, "", editors);
    }
    pickCandidateEditors(groupId, includeAllWhenSearching) {
        if (this.searchTerms.length === 0 || includeAllWhenSearching) {
            return this.collectGroupEditors(groupId);
        }
        return this.collectGroupEditors(groupId).filter((editor) => this.matchesEditor(editor.label, editor.uri));
    }
    getFolderChildren(groupId, folderPath, editors) {
        const folderNames = new Set();
        const directEditors = [];
        for (const editor of editors) {
            const segments = this.getFolderSegments(editor.uri);
            if (folderPath) {
                const prefix = `${folderPath}/`;
                if (!segments.join("/").startsWith(prefix) && segments.join("/") !== folderPath) {
                    continue;
                }
            }
            const level = folderPath ? folderPath.split("/").filter((item) => !!item).length : 0;
            if (segments.length <= level) {
                directEditors.push(editor);
                continue;
            }
            const nextName = segments[level];
            if (nextName) {
                folderNames.add(nextName);
            }
        }
        const folders = Array.from(folderNames)
            .sort((a, b) => a.localeCompare(b))
            .map((name) => {
            const nextPath = folderPath ? `${folderPath}/${name}` : name;
            return {
                type: "folder",
                groupId,
                folderName: name,
                folderPath: nextPath,
                id: `folder:${groupId}:${nextPath}`
            };
        });
        const sortedEditors = directEditors.sort((a, b) => a.label.localeCompare(b.label));
        return [...folders, ...sortedEditors];
    }
    getFolderSegments(uri) {
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        const normalized = relativePath.replace(/\\/g, "/");
        const parts = normalized.split("/").filter((item) => !!item);
        if (parts.length <= 1) {
            return [];
        }
        return parts.slice(0, -1);
    }
    collectGroupEditors(groupId) {
        const result = [];
        const seen = new Set(); // de-dup same file opened in multiple editors
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
                if (this.groupService.getAssignedGroupId(uri) !== groupId) {
                    continue;
                }
                result.push({
                    type: "editor",
                    uri,
                    groupId,
                    label: (0, tabs_1.tabLabel)(tab.label, uri),
                    id: `editor:${groupId}:${uri.toString()}`
                });
            }
        }
        return result;
    }
    matchesGroup(groupName) {
        if (this.searchTerms.length === 0) {
            return true;
        }
        const value = groupName.toLowerCase();
        return this.searchTerms.every((term) => value.includes(term));
    }
    matchesEditor(label, uri) {
        if (this.searchTerms.length === 0) {
            return true;
        }
        const haystack = `${label}\n${uri.fsPath}\n${uri.path}\n${uri.toString()}`.toLowerCase();
        return this.searchTerms.every((term) => haystack.includes(term));
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
        if (!target || (target.type !== "group" && target.type !== "folder")) {
            return;
        }
        const targetGroupId = target.groupId;
        const treePayload = dataTransfer.get(constants_1.TREE_MIME);
        if (treePayload) {
            const raw = await treePayload.asString();
            const entries = parseTreePayload(raw);
            await this.moveService.assignUrisToGroup(entries, targetGroupId);
            this.refresh();
            return;
        }
        const uriList = dataTransfer.get("text/uri-list");
        if (uriList) {
            const raw = await uriList.asString();
            const uris = parseUriList(raw);
            await this.moveService.assignUrisToGroup(uris, targetGroupId);
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
exports.TabNestOpenEditorsProvider = TabNestOpenEditorsProvider;
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
//# sourceMappingURL=tabnest-open-editors-provider.js.map
import * as vscode from "vscode";
import { TREE_MIME } from "../constants";
import { getTabUri, tabLabel } from "../core/tabs";
import { MoveService } from "../services/move-service";
import { GroupService } from "../services/group-service";
import { TabNestNode, EditorNode, GroupNode, FolderNode } from "../types";

export class TabNestOpenEditorsProvider
  implements vscode.TreeDataProvider<TabNestNode>, vscode.TreeDragAndDropController<TabNestNode>, vscode.Disposable
{
  private static readonly COLLAPSED_GROUPS_KEY = "tabNest.collapsedGroups.v1";

  public readonly dropMimeTypes = [TREE_MIME, "text/uri-list"];
  public readonly dragMimeTypes = [TREE_MIME];

  private readonly moveService: MoveService;
  private readonly groupService: GroupService;
  private readonly emitter = new vscode.EventEmitter<TabNestNode | undefined>();
  private readonly tabsSub: vscode.Disposable;
  private readonly groupsSub: vscode.Disposable;
  private readonly assignmentSub: vscode.Disposable;
  private readonly collapsedGroupIds = new Set<string>();
  private readonly state: vscode.Memento;
  private searchQuery = "";
  private searchTerms: string[] = [];

  public readonly onDidChangeTreeData = this.emitter.event;

  constructor(moveService: MoveService, groupService: GroupService, state: vscode.Memento) {
    this.moveService = moveService;
    this.groupService = groupService;
    this.state = state;
    const stored = this.state.get<string[]>(TabNestOpenEditorsProvider.COLLAPSED_GROUPS_KEY, []);
    for (const groupId of stored) {
      if (typeof groupId === "string" && groupId) {
        this.collapsedGroupIds.add(groupId);
      }
    }
    this.tabsSub = vscode.window.tabGroups.onDidChangeTabs(() => this.refresh());
    this.groupsSub = vscode.window.tabGroups.onDidChangeTabGroups(() => this.refresh());
    this.assignmentSub = this.groupService.onDidChange(() => this.refresh());
  }

  dispose(): void {
    this.tabsSub.dispose();
    this.groupsSub.dispose();
    this.assignmentSub.dispose();
    this.emitter.dispose();
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  setGroupCollapsed(groupId: string, collapsed: boolean): void {
    if (!groupId) {
      return;
    }

    if (collapsed) {
      this.collapsedGroupIds.add(groupId);
    } else {
      this.collapsedGroupIds.delete(groupId);
    }

    void this.state.update(TabNestOpenEditorsProvider.COLLAPSED_GROUPS_KEY, Array.from(this.collapsedGroupIds));
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.trim();
    this.searchTerms = this.searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((item) => !!item);
    this.refresh();
  }

  clearSearch(): void {
    this.setSearchQuery("");
  }

  getSearchQuery(): string {
    return this.searchQuery;
  }

  getTreeItem(element: TabNestNode): vscode.TreeItem {
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

  getChildren(element?: TabNestNode): TabNestNode[] {
    if (!element) {
      const groups: GroupNode[] = this.groupService.getGroups().map((group) => ({
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

  private pickCandidateEditors(groupId: string, includeAllWhenSearching: boolean): EditorNode[] {
    if (this.searchTerms.length === 0 || includeAllWhenSearching) {
      return this.collectGroupEditors(groupId);
    }

    return this.collectGroupEditors(groupId).filter((editor) => this.matchesEditor(editor.label, editor.uri));
  }

  private getFolderChildren(groupId: string, folderPath: string, editors: EditorNode[]): TabNestNode[] {
    const folderNames = new Set<string>();
    const directEditors: EditorNode[] = [];

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

    const folders: FolderNode[] = Array.from(folderNames)
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

  private getFolderSegments(uri: vscode.Uri): string[] {
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    const normalized = relativePath.replace(/\\/g, "/");
    const parts = normalized.split("/").filter((item) => !!item);
    if (parts.length <= 1) {
      return [];
    }

    return parts.slice(0, -1);
  }

  private collectGroupEditors(groupId: string): EditorNode[] {
    const result: EditorNode[] = [];

    const seen = new Set<string>(); // de-dup same file opened in multiple editors

    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const uri = getTabUri(tab.input);
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
          label: tabLabel(tab.label, uri),
          id: `editor:${groupId}:${uri.toString()}`
        });
      }
    }

    return result;
  }

  private matchesGroup(groupName: string): boolean {
    if (this.searchTerms.length === 0) {
      return true;
    }

    const value = groupName.toLowerCase();
    return this.searchTerms.every((term) => value.includes(term));
  }

  private matchesEditor(label: string, uri: vscode.Uri): boolean {
    if (this.searchTerms.length === 0) {
      return true;
    }

    const haystack = `${label}\n${uri.fsPath}\n${uri.path}\n${uri.toString()}`.toLowerCase();
    return this.searchTerms.every((term) => haystack.includes(term));
  }

  async handleDrag(source: readonly TabNestNode[], dataTransfer: vscode.DataTransfer): Promise<void> {
    const payload = source
      .filter((node): node is EditorNode => node.type === "editor")
      .map((node) => node.uri.toString());

    if (payload.length === 0) {
      return;
    }

    dataTransfer.set(TREE_MIME, new vscode.DataTransferItem(JSON.stringify(payload)));
  }

  async handleDrop(target: TabNestNode | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    if (!target || (target.type !== "group" && target.type !== "folder")) {
      return;
    }
    const targetGroupId = target.groupId;

    const treePayload = dataTransfer.get(TREE_MIME);
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
        } catch {
          // ignore non-openable URI
        }
      }
      this.refresh();
    }
  }
}

function parseTreePayload(raw: string): vscode.Uri[] {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.flatMap((item) => {
      if (typeof item !== "string") {
        return [];
      }

      return [vscode.Uri.parse(item)];
    });
  } catch {
    return [];
  }
}

function parseUriList(text: string): vscode.Uri[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !!line && !line.startsWith("#"))
    .flatMap((line) => {
      try {
        return [vscode.Uri.parse(line)];
      } catch {
        return [];
      }
    });
}

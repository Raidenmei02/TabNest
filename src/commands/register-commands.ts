import * as vscode from "vscode";
import { COMMANDS } from "../constants";
import { MoveService } from "../services/move-service";
import { OrganizerService } from "../services/organizer-service";
import { GroupNode, TabNestNode } from "../types";
import { TabNestOpenEditorsProvider } from "../view/tabnest-open-editors-provider";

export function registerCommands(
  context: vscode.ExtensionContext,
  organizerService: OrganizerService,
  moveService: MoveService,
  openEditorsProvider: TabNestOpenEditorsProvider,
  setViewDescription: (value: string | undefined) => void,
  getSelectedNode: () => TabNestNode | undefined
): void {
  const organizeNow = vscode.commands.registerCommand(COMMANDS.organizeNow, async () => {
    await organizerService.organizeNow();
  });
  const aiOrganizeNow = vscode.commands.registerCommand(COMMANDS.aiOrganizeNow, async () => {
    await organizerService.organizeNow({ forceAi: true });
  });

  const moveActiveToGroup = vscode.commands.registerCommand(COMMANDS.moveActiveToGroup, async () => {
    await moveService.moveActiveEditorToGroup();
  });

  const moveOpenToGroup = vscode.commands.registerCommand(COMMANDS.moveOpenToGroup, async (target?: { uri: vscode.Uri }) => {
    await moveService.moveOpenEditorToGroup(target);
  });
  const removeOpenFromGroup = vscode.commands.registerCommand(
    COMMANDS.removeOpenFromGroup,
    async (target?: { uri: vscode.Uri }) => {
      await moveService.removeOpenEditorFromGroup(target);
    }
  );
  const addGroup = vscode.commands.registerCommand(COMMANDS.addGroup, async () => {
    await moveService.addGroup();
  });
  const renameGroup = vscode.commands.registerCommand(COMMANDS.renameGroup, async (target?: GroupNode) => {
    const selected = getSelectedNode();
    const selectedGroup = selected?.type === "group" ? selected : undefined;
    const resolved = target ?? selectedGroup;
    if (!resolved || resolved.builtIn || resolved.groupId === "ungrouped") {
      return;
    }

    await moveService.renameGroup(resolved);
  });
  const deleteGroup = vscode.commands.registerCommand(COMMANDS.deleteGroup, async (target?: GroupNode) => {
    await moveService.deleteGroup(target);
  });
  const searchOpenEditors = vscode.commands.registerCommand(COMMANDS.searchOpenEditors, async () => {
    const value = await vscode.window.showInputBox({
      title: "Search TabNest Open Editors",
      prompt: "Match by filename or file path. Use spaces for multiple keywords.",
      placeHolder: "Example: test auth src/services",
      value: openEditorsProvider.getSearchQuery()
    });
    if (value === undefined) {
      return;
    }

    openEditorsProvider.setSearchQuery(value);
    const query = openEditorsProvider.getSearchQuery();
    setViewDescription(query ? `search: ${query}` : undefined);
  });
  const clearSearch = vscode.commands.registerCommand(COMMANDS.clearSearch, () => {
    openEditorsProvider.clearSearch();
    setViewDescription(undefined);
  });

  context.subscriptions.push(
    organizeNow,
    aiOrganizeNow,
    moveActiveToGroup,
    moveOpenToGroup,
    removeOpenFromGroup,
    addGroup,
    renameGroup,
    deleteGroup,
    searchOpenEditors,
    clearSearch
  );
}

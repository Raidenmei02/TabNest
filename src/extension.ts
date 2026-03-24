import * as vscode from "vscode";
import { TREE_VIEW_ID } from "./constants";
import { registerCommands } from "./commands/register-commands";
import { AutoOrganizeController } from "./services/auto-organize-controller";
import { AiClassifierService } from "./services/ai-classifier-service";
import { GroupService } from "./services/group-service";
import { MoveService } from "./services/move-service";
import { OrganizerService } from "./services/organizer-service";
import { TabNestOpenEditorsProvider } from "./view/tabnest-open-editors-provider";

export function activate(context: vscode.ExtensionContext): void {
  const groupService = new GroupService(context);
  const aiClassifier = new AiClassifierService();
  const organizerService = new OrganizerService(groupService, aiClassifier);
  const moveService = new MoveService(groupService);

  const tabNestProvider = new TabNestOpenEditorsProvider(moveService, groupService, context.workspaceState);
  const tabNestView = vscode.window.createTreeView(TREE_VIEW_ID, {
    treeDataProvider: tabNestProvider,
    dragAndDropController: tabNestProvider,
    showCollapseAll: true
  });
  const setViewDescription = (value: string | undefined): void => {
    tabNestView.description = value;
  };
  const getSelectedNode = () => tabNestView.selection[0];

  registerCommands(context, organizerService, moveService, tabNestProvider, setViewDescription, getSelectedNode);

  const onCollapse = tabNestView.onDidCollapseElement((event) => {
    if (event.element.type === "group") {
      tabNestProvider.setGroupCollapsed(event.element.groupId, true);
    }
  });
  const onExpand = tabNestView.onDidExpandElement((event) => {
    if (event.element.type === "group") {
      tabNestProvider.setGroupCollapsed(event.element.groupId, false);
    }
  });

  const autoOrganize = new AutoOrganizeController(async () => {
    await organizerService.organizeNow();
  });

  context.subscriptions.push(groupService, organizerService, tabNestProvider, tabNestView, onCollapse, onExpand, autoOrganize);
}

export function deactivate(): void {
  // no-op
}

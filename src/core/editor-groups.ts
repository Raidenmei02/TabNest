import * as vscode from "vscode";

export function toViewColumn(groupIndexOneBased: number): vscode.ViewColumn | undefined {
  if (!Number.isInteger(groupIndexOneBased) || groupIndexOneBased < 1) {
    return undefined;
  }

  return groupIndexOneBased as vscode.ViewColumn;
}

export async function ensureGroupCount(targetCount: number): Promise<void> {
  if (!Number.isInteger(targetCount) || targetCount < 1) {
    return;
  }

  while (vscode.window.tabGroups.all.length < targetCount) {
    await vscode.commands.executeCommand("workbench.action.newGroupRight");
  }
}

export async function revealTabDocument(uri: vscode.Uri, sourceColumn: vscode.ViewColumn): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    viewColumn: sourceColumn,
    preserveFocus: true,
    preview: false
  });
}

export async function moveEditorBySteps(from: vscode.ViewColumn, to: vscode.ViewColumn): Promise<void> {
  const delta = to - from;
  if (delta === 0) {
    return;
  }

  const command = delta > 0 ? "workbench.action.moveEditorToNextGroup" : "workbench.action.moveEditorToPreviousGroup";
  const steps = Math.abs(delta);

  for (let i = 0; i < steps; i += 1) {
    await vscode.commands.executeCommand(command);
  }
}

export async function moveUriToGroup(
  uri: vscode.Uri,
  sourceColumn: vscode.ViewColumn,
  targetColumn: vscode.ViewColumn,
  targetGroupIndex: number
): Promise<void> {
  await ensureGroupCount(targetGroupIndex);
  await revealTabDocument(uri, sourceColumn);
  await moveEditorBySteps(sourceColumn, targetColumn);
}

export async function openUrisInGroup(targetGroupIndex: number, uris: vscode.Uri[]): Promise<void> {
  const targetColumn = toViewColumn(targetGroupIndex);
  if (!targetColumn) {
    return;
  }

  await ensureGroupCount(targetGroupIndex);

  for (const uri of uris) {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: targetColumn,
      preserveFocus: true,
      preview: false
    });
  }
}

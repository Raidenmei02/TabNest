import * as vscode from "vscode";

export function getTabUri(input: unknown): vscode.Uri | undefined {
  if (input instanceof vscode.TabInputText) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputTextDiff) {
    return input.modified;
  }
  if (input instanceof vscode.TabInputNotebook) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputNotebookDiff) {
    return input.modified;
  }
  if (input instanceof vscode.TabInputCustom) {
    return input.uri;
  }
  return undefined;
}

export function getMatchTarget(uri: vscode.Uri): string {
  const relativePath = vscode.workspace.asRelativePath(uri, false);
  if (relativePath !== uri.toString()) {
    return relativePath;
  }

  if (uri.scheme === "untitled") {
    return `untitled:${uri.path}`;
  }

  return `${uri.scheme}:${uri.path}`;
}

export function tabLabel(tabLabelText: string, uri: vscode.Uri): string {
  return tabLabelText || uri.path.split("/").pop() || uri.toString();
}

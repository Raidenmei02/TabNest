import * as vscode from "vscode";

export type RuleConfig = {
  name: string;
  regex: string;
  targetGroup: number;
};

export type Rule = {
  name: string;
  re: RegExp;
  targetGroup: number;
};

export type OpenEditorPick = {
  uri: vscode.Uri;
};

export type GroupNode = {
  type: "group";
  groupId: string;
  groupName: string;
  builtIn?: boolean;
  id: string;
};

export type EditorNode = {
  type: "editor";
  uri: vscode.Uri;
  groupId: string;
  label: string;
  id: string;
};

export type FolderNode = {
  type: "folder";
  groupId: string;
  folderName: string;
  folderPath: string;
  id: string;
};

export type TabNestNode = GroupNode | FolderNode | EditorNode;

export type LogicalGroup = {
  id: string;
  name: string;
  builtIn?: boolean;
};

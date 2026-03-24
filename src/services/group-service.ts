import * as vscode from "vscode";
import { LogicalGroup } from "../types";

const GROUPS_KEY = "tabNest.groups.v1";
const ASSIGNMENTS_KEY = "tabNest.assignments.v1";
const LEGACY_GROUPS_KEY = "atlasOrganizer.groups.v1";
const LEGACY_ASSIGNMENTS_KEY = "atlasOrganizer.assignments.v1";
const UNGROUPED_ID = "ungrouped";

export class GroupService implements vscode.Disposable {
  private readonly state: vscode.Memento;
  private readonly emitter = new vscode.EventEmitter<void>();

  public readonly onDidChange = this.emitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.state = context.workspaceState;
  }

  dispose(): void {
    this.emitter.dispose();
  }

  getGroups(): LogicalGroup[] {
    return [this.getUngrouped(), ...this.getCustomGroups()];
  }

  async addGroup(name: string): Promise<LogicalGroup> {
    const value = name.trim();
    if (!value) {
      throw new Error("Group name cannot be empty.");
    }

    const groups = this.getCustomGroups();
    const created: LogicalGroup = {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: value
    };

    groups.push(created);
    await this.state.update(GROUPS_KEY, groups);
    this.emitter.fire();
    return created;
  }

  async ensureGroupByName(name: string): Promise<LogicalGroup> {
    const value = name.trim();
    if (!value) {
      throw new Error("Group name cannot be empty.");
    }

    const existing = this
      .getCustomGroups()
      .find((group) => group.name.trim().toLowerCase() === value.toLowerCase());
    if (existing) {
      return existing;
    }

    return this.addGroup(value);
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    if (!groupId || groupId === UNGROUPED_ID) {
      return false;
    }

    const groups = this.getCustomGroups();
    const nextGroups = groups.filter((group) => group.id !== groupId);
    if (nextGroups.length === groups.length) {
      return false;
    }

    const assignments = this.getAssignments();
    for (const [uriKey, assigned] of Object.entries(assignments)) {
      if (assigned === groupId) {
        delete assignments[uriKey];
      }
    }

    await this.state.update(GROUPS_KEY, nextGroups);
    await this.state.update(ASSIGNMENTS_KEY, assignments);
    this.emitter.fire();
    return true;
  }

  async renameGroup(groupId: string, name: string): Promise<LogicalGroup | undefined> {
    if (!groupId || groupId === UNGROUPED_ID) {
      return undefined;
    }

    const value = name.trim();
    if (!value) {
      throw new Error("Group name cannot be empty.");
    }

    const groups = this.getCustomGroups();
    const targetIndex = groups.findIndex((group) => group.id === groupId);
    if (targetIndex < 0) {
      return undefined;
    }

    const duplicated = groups.some(
      (group, index) => index !== targetIndex && group.name.trim().toLowerCase() === value.toLowerCase()
    );
    if (duplicated) {
      throw new Error(`Group name "${value}" already exists.`);
    }

    const next: LogicalGroup = {
      ...groups[targetIndex],
      name: value
    };
    groups[targetIndex] = next;
    await this.state.update(GROUPS_KEY, groups);
    this.emitter.fire();
    return next;
  }

  async ensureGroupIndex(index: number, suggestedName?: string): Promise<LogicalGroup> {
    if (!Number.isInteger(index) || index < 1) {
      return this.getUngrouped();
    }

    if (index === 1) {
      return this.getUngrouped();
    }

    const groups = this.getCustomGroups();
    const originalLength = groups.length;
    while (groups.length < index - 1) {
      const nextIndex = groups.length + 2;
      groups.push({
        id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${nextIndex}`,
        name: nextIndex === index && suggestedName ? suggestedName : `Group ${nextIndex}`
      });
    }

    if (groups.length !== originalLength) {
      await this.state.update(GROUPS_KEY, groups);
      this.emitter.fire();
    }
    return groups[index - 2];
  }

  getAssignedGroupId(uri: vscode.Uri): string {
    const assignments = this.getAssignments();
    const groupId = assignments[uri.toString()];
    if (!groupId) {
      return UNGROUPED_ID;
    }

    const exists = this.getGroups().some((group) => group.id === groupId);
    return exists ? groupId : UNGROUPED_ID;
  }

  async assignUri(uri: vscode.Uri, groupId: string): Promise<void> {
    const groups = this.getGroups();
    const normalized = groups.some((group) => group.id === groupId) ? groupId : UNGROUPED_ID;

    const assignments = this.getAssignments();
    const key = uri.toString();

    if (normalized === UNGROUPED_ID) {
      delete assignments[key];
    } else {
      assignments[key] = normalized;
    }

    await this.state.update(ASSIGNMENTS_KEY, assignments);
    this.emitter.fire();
  }

  async assignUris(uris: vscode.Uri[], groupId: string): Promise<void> {
    const groups = this.getGroups();
    const normalized = groups.some((group) => group.id === groupId) ? groupId : UNGROUPED_ID;
    const assignments = this.getAssignments();

    for (const uri of uris) {
      const key = uri.toString();
      if (normalized === UNGROUPED_ID) {
        delete assignments[key];
      } else {
        assignments[key] = normalized;
      }
    }

    await this.state.update(ASSIGNMENTS_KEY, assignments);
    this.emitter.fire();
  }

  private getUngrouped(): LogicalGroup {
    return {
      id: UNGROUPED_ID,
      name: "Ungrouped",
      builtIn: true
    };
  }

  private getCustomGroups(): LogicalGroup[] {
    const primary = this.state.get<LogicalGroup[] | undefined>(GROUPS_KEY);
    const groups = primary ?? this.state.get<LogicalGroup[]>(LEGACY_GROUPS_KEY, []);
    if (primary === undefined && groups.length > 0) {
      void this.state.update(GROUPS_KEY, groups);
    }
    return groups.filter((item) => !!item && typeof item.id === "string" && typeof item.name === "string");
  }

  private getAssignments(): Record<string, string> {
    const primary = this.state.get<Record<string, string> | undefined>(ASSIGNMENTS_KEY);
    const value = primary ?? this.state.get<Record<string, string>>(LEGACY_ASSIGNMENTS_KEY, {});
    if (primary === undefined && Object.keys(value).length > 0) {
      void this.state.update(ASSIGNMENTS_KEY, value);
    }
    return { ...value };
  }
}

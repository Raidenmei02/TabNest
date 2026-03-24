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
exports.GroupService = void 0;
const vscode = __importStar(require("vscode"));
const GROUPS_KEY = "tabNest.groups.v1";
const ASSIGNMENTS_KEY = "tabNest.assignments.v1";
const LEGACY_GROUPS_KEY = "atlasOrganizer.groups.v1";
const LEGACY_ASSIGNMENTS_KEY = "atlasOrganizer.assignments.v1";
const UNGROUPED_ID = "ungrouped";
class GroupService {
    state;
    emitter = new vscode.EventEmitter();
    onDidChange = this.emitter.event;
    constructor(context) {
        this.state = context.workspaceState;
    }
    dispose() {
        this.emitter.dispose();
    }
    getGroups() {
        return [this.getUngrouped(), ...this.getCustomGroups()];
    }
    async addGroup(name) {
        const value = name.trim();
        if (!value) {
            throw new Error("Group name cannot be empty.");
        }
        const groups = this.getCustomGroups();
        const created = {
            id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: value
        };
        groups.push(created);
        await this.state.update(GROUPS_KEY, groups);
        this.emitter.fire();
        return created;
    }
    async ensureGroupByName(name) {
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
    async deleteGroup(groupId) {
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
    async renameGroup(groupId, name) {
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
        const duplicated = groups.some((group, index) => index !== targetIndex && group.name.trim().toLowerCase() === value.toLowerCase());
        if (duplicated) {
            throw new Error(`Group name "${value}" already exists.`);
        }
        const next = {
            ...groups[targetIndex],
            name: value
        };
        groups[targetIndex] = next;
        await this.state.update(GROUPS_KEY, groups);
        this.emitter.fire();
        return next;
    }
    async ensureGroupIndex(index, suggestedName) {
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
    getAssignedGroupId(uri) {
        const assignments = this.getAssignments();
        const groupId = assignments[uri.toString()];
        if (!groupId) {
            return UNGROUPED_ID;
        }
        const exists = this.getGroups().some((group) => group.id === groupId);
        return exists ? groupId : UNGROUPED_ID;
    }
    async assignUri(uri, groupId) {
        const groups = this.getGroups();
        const normalized = groups.some((group) => group.id === groupId) ? groupId : UNGROUPED_ID;
        const assignments = this.getAssignments();
        const key = uri.toString();
        if (normalized === UNGROUPED_ID) {
            delete assignments[key];
        }
        else {
            assignments[key] = normalized;
        }
        await this.state.update(ASSIGNMENTS_KEY, assignments);
        this.emitter.fire();
    }
    async assignUris(uris, groupId) {
        const groups = this.getGroups();
        const normalized = groups.some((group) => group.id === groupId) ? groupId : UNGROUPED_ID;
        const assignments = this.getAssignments();
        for (const uri of uris) {
            const key = uri.toString();
            if (normalized === UNGROUPED_ID) {
                delete assignments[key];
            }
            else {
                assignments[key] = normalized;
            }
        }
        await this.state.update(ASSIGNMENTS_KEY, assignments);
        this.emitter.fire();
    }
    getUngrouped() {
        return {
            id: UNGROUPED_ID,
            name: "Ungrouped",
            builtIn: true
        };
    }
    getCustomGroups() {
        const primary = this.state.get(GROUPS_KEY);
        const groups = primary ?? this.state.get(LEGACY_GROUPS_KEY, []);
        if (primary === undefined && groups.length > 0) {
            void this.state.update(GROUPS_KEY, groups);
        }
        return groups.filter((item) => !!item && typeof item.id === "string" && typeof item.name === "string");
    }
    getAssignments() {
        const primary = this.state.get(ASSIGNMENTS_KEY);
        const value = primary ?? this.state.get(LEGACY_ASSIGNMENTS_KEY, {});
        if (primary === undefined && Object.keys(value).length > 0) {
            void this.state.update(ASSIGNMENTS_KEY, value);
        }
        return { ...value };
    }
}
exports.GroupService = GroupService;
//# sourceMappingURL=group-service.js.map
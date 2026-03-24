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
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../constants");
function registerCommands(context, organizerService, moveService, openEditorsProvider, setViewDescription, getSelectedNode) {
    const organizeNow = vscode.commands.registerCommand(constants_1.COMMANDS.organizeNow, async () => {
        await organizerService.organizeNow();
    });
    const aiOrganizeNow = vscode.commands.registerCommand(constants_1.COMMANDS.aiOrganizeNow, async () => {
        await organizerService.organizeNow({ forceAi: true });
    });
    const moveActiveToGroup = vscode.commands.registerCommand(constants_1.COMMANDS.moveActiveToGroup, async () => {
        await moveService.moveActiveEditorToGroup();
    });
    const moveOpenToGroup = vscode.commands.registerCommand(constants_1.COMMANDS.moveOpenToGroup, async (target) => {
        await moveService.moveOpenEditorToGroup(target);
    });
    const removeOpenFromGroup = vscode.commands.registerCommand(constants_1.COMMANDS.removeOpenFromGroup, async (target) => {
        await moveService.removeOpenEditorFromGroup(target);
    });
    const addGroup = vscode.commands.registerCommand(constants_1.COMMANDS.addGroup, async () => {
        await moveService.addGroup();
    });
    const renameGroup = vscode.commands.registerCommand(constants_1.COMMANDS.renameGroup, async (target) => {
        const selected = getSelectedNode();
        const selectedGroup = selected?.type === "group" ? selected : undefined;
        const resolved = target ?? selectedGroup;
        if (!resolved || resolved.builtIn || resolved.groupId === "ungrouped") {
            return;
        }
        await moveService.renameGroup(resolved);
    });
    const deleteGroup = vscode.commands.registerCommand(constants_1.COMMANDS.deleteGroup, async (target) => {
        await moveService.deleteGroup(target);
    });
    const searchOpenEditors = vscode.commands.registerCommand(constants_1.COMMANDS.searchOpenEditors, async () => {
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
    const clearSearch = vscode.commands.registerCommand(constants_1.COMMANDS.clearSearch, () => {
        openEditorsProvider.clearSearch();
        setViewDescription(undefined);
    });
    context.subscriptions.push(organizeNow, aiOrganizeNow, moveActiveToGroup, moveOpenToGroup, removeOpenFromGroup, addGroup, renameGroup, deleteGroup, searchOpenEditors, clearSearch);
}
//# sourceMappingURL=register-commands.js.map
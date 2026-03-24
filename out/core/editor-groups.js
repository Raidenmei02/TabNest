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
exports.toViewColumn = toViewColumn;
exports.ensureGroupCount = ensureGroupCount;
exports.revealTabDocument = revealTabDocument;
exports.moveEditorBySteps = moveEditorBySteps;
exports.moveUriToGroup = moveUriToGroup;
exports.openUrisInGroup = openUrisInGroup;
const vscode = __importStar(require("vscode"));
function toViewColumn(groupIndexOneBased) {
    if (!Number.isInteger(groupIndexOneBased) || groupIndexOneBased < 1) {
        return undefined;
    }
    return groupIndexOneBased;
}
async function ensureGroupCount(targetCount) {
    if (!Number.isInteger(targetCount) || targetCount < 1) {
        return;
    }
    while (vscode.window.tabGroups.all.length < targetCount) {
        await vscode.commands.executeCommand("workbench.action.newGroupRight");
    }
}
async function revealTabDocument(uri, sourceColumn) {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
        viewColumn: sourceColumn,
        preserveFocus: true,
        preview: false
    });
}
async function moveEditorBySteps(from, to) {
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
async function moveUriToGroup(uri, sourceColumn, targetColumn, targetGroupIndex) {
    await ensureGroupCount(targetGroupIndex);
    await revealTabDocument(uri, sourceColumn);
    await moveEditorBySteps(sourceColumn, targetColumn);
}
async function openUrisInGroup(targetGroupIndex, uris) {
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
//# sourceMappingURL=editor-groups.js.map
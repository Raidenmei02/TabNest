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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const constants_1 = require("./constants");
const register_commands_1 = require("./commands/register-commands");
const auto_organize_controller_1 = require("./services/auto-organize-controller");
const ai_classifier_service_1 = require("./services/ai-classifier-service");
const group_service_1 = require("./services/group-service");
const move_service_1 = require("./services/move-service");
const organizer_service_1 = require("./services/organizer-service");
const tabnest_open_editors_provider_1 = require("./view/tabnest-open-editors-provider");
function activate(context) {
    const groupService = new group_service_1.GroupService(context);
    const aiClassifier = new ai_classifier_service_1.AiClassifierService();
    const organizerService = new organizer_service_1.OrganizerService(groupService, aiClassifier);
    const moveService = new move_service_1.MoveService(groupService);
    const tabNestProvider = new tabnest_open_editors_provider_1.TabNestOpenEditorsProvider(moveService, groupService, context.workspaceState);
    const tabNestView = vscode.window.createTreeView(constants_1.TREE_VIEW_ID, {
        treeDataProvider: tabNestProvider,
        dragAndDropController: tabNestProvider,
        showCollapseAll: true
    });
    const setViewDescription = (value) => {
        tabNestView.description = value;
    };
    const getSelectedNode = () => tabNestView.selection[0];
    (0, register_commands_1.registerCommands)(context, organizerService, moveService, tabNestProvider, setViewDescription, getSelectedNode);
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
    const autoOrganize = new auto_organize_controller_1.AutoOrganizeController(async () => {
        await organizerService.organizeNow();
    });
    context.subscriptions.push(groupService, organizerService, tabNestProvider, tabNestView, onCollapse, onExpand, autoOrganize);
}
function deactivate() {
    // no-op
}
//# sourceMappingURL=extension.js.map
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
exports.AutoOrganizeController = void 0;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../constants");
const settings_1 = require("../config/settings");
const debounce_1 = require("../utils/debounce");
class AutoOrganizeController {
    organizeFn;
    configSub;
    tabSub;
    constructor(organizeFn) {
        this.organizeFn = organizeFn;
        this.tabSub = this.bindTabListener();
        this.configSub = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(`${constants_1.EXTENSION_SECTION}.debounceMs`) ||
                event.affectsConfiguration(`${constants_1.EXTENSION_SECTION}.autoOrganize`)) {
                this.rebind();
            }
        });
    }
    dispose() {
        this.tabSub?.dispose();
        this.configSub.dispose();
    }
    rebind() {
        this.tabSub?.dispose();
        this.tabSub = this.bindTabListener();
    }
    bindTabListener() {
        const handler = (0, debounce_1.debounce)(async () => {
            if (!(0, settings_1.getAutoOrganize)()) {
                return;
            }
            await this.organizeFn();
        }, (0, settings_1.getDebounceMs)());
        return vscode.window.tabGroups.onDidChangeTabs(handler);
    }
}
exports.AutoOrganizeController = AutoOrganizeController;
//# sourceMappingURL=auto-organize-controller.js.map
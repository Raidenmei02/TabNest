"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRules = loadRules;
const settings_1 = require("../config/settings");
function loadRules() {
    if ((0, settings_1.getStrategy)() === "preset") {
        return getPresetRules();
    }
    return (0, settings_1.getCustomRules)()
        .filter((item) => !!item && typeof item.regex === "string" && typeof item.targetGroup === "number")
        .flatMap((item) => {
        try {
            return [{ name: item.name, re: new RegExp(item.regex), targetGroup: item.targetGroup }];
        }
        catch {
            return [];
        }
    });
}
function getPresetRules() {
    return [
        {
            name: "Tests",
            re: /(^|\/)(test|tests|__tests__|spec|specs)(\/|$)|\.(test|spec)\.[^.]+$/i,
            targetGroup: 2
        },
        {
            name: "Docs",
            re: /(^|\/)(doc|docs|guide|guides|design|adr)(\/|$)|\.(md|mdx|rst|txt)$/i,
            targetGroup: 3
        },
        {
            name: "Temp",
            re: /^untitled:|(^|\/)(tmp|temp|scratch|drafts?)(\/|$)|\.(tmp|log)$/i,
            targetGroup: 4
        }
    ];
}
//# sourceMappingURL=rules.js.map
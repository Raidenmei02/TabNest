import { getCustomRules, getStrategy } from "../config/settings";
import { Rule } from "../types";

export function loadRules(): Rule[] {
  if (getStrategy() === "preset") {
    return getPresetRules();
  }

  return getCustomRules()
    .filter((item) => !!item && typeof item.regex === "string" && typeof item.targetGroup === "number")
    .flatMap((item) => {
      try {
        return [{ name: item.name, re: new RegExp(item.regex), targetGroup: item.targetGroup } satisfies Rule];
      } catch {
        return [];
      }
    });
}

function getPresetRules(): Rule[] {
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

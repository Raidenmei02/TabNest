export const EXTENSION_SECTION = "tabNest";
export const TREE_VIEW_ID = "tabNest.openEditors";
export const TREE_MIME = "application/vnd.code.tree.tabNest.openEditors";

export const COMMANDS = {
  organizeNow: "tabNest.organizeNow",
  aiOrganizeNow: "tabNest.aiOrganizeNow",
  moveActiveToGroup: "tabNest.moveActiveToGroup",
  moveOpenToGroup: "tabNest.moveOpenToGroup",
  removeOpenFromGroup: "tabNest.removeOpenFromGroup",
  addGroup: "tabNest.addGroup",
  renameGroup: "tabNest.renameGroup",
  deleteGroup: "tabNest.deleteGroup",
  searchOpenEditors: "tabNest.searchOpenEditors",
  clearSearch: "tabNest.clearSearch"
} as const;

import * as vscode from "vscode";
import { EXTENSION_SECTION } from "../constants";
import { getAutoOrganize, getDebounceMs } from "../config/settings";
import { debounce } from "../utils/debounce";

export class AutoOrganizeController implements vscode.Disposable {
  private readonly organizeFn: () => Promise<void>;
  private readonly configSub: vscode.Disposable;
  private tabSub: vscode.Disposable | undefined;

  constructor(organizeFn: () => Promise<void>) {
    this.organizeFn = organizeFn;
    this.tabSub = this.bindTabListener();

    this.configSub = vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(`${EXTENSION_SECTION}.debounceMs`) ||
        event.affectsConfiguration(`${EXTENSION_SECTION}.autoOrganize`)
      ) {
        this.rebind();
      }
    });
  }

  dispose(): void {
    this.tabSub?.dispose();
    this.configSub.dispose();
  }

  private rebind(): void {
    this.tabSub?.dispose();
    this.tabSub = this.bindTabListener();
  }

  private bindTabListener(): vscode.Disposable {
    const handler = debounce(async () => {
      if (!getAutoOrganize()) {
        return;
      }

      await this.organizeFn();
    }, getDebounceMs());

    return vscode.window.tabGroups.onDidChangeTabs(handler);
  }
}

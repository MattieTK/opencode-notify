import type { Notifier, NotificationOptions, NotificationResult } from "./types";
import { MacOSNotifier } from "./macos";
import { LinuxNotifier } from "./linux";
import { WindowsNotifier } from "./windows";

export type { NotificationOptions, NotificationResult, NotificationAction } from "./types";

/**
 * Platform notification dispatcher.
 * Selects the appropriate notifier for the current platform.
 */
export class NotificationDispatcher {
  private notifier: Notifier | null = null;
  private initialised = false;

  async initialise(): Promise<boolean> {
    if (this.initialised) {
      return this.notifier !== null;
    }

    this.initialised = true;
    const platform = process.platform;

    if (platform === "darwin") {
      const macos = new MacOSNotifier();
      if (await macos.isAvailable()) {
        this.notifier = macos;
        return true;
      }
    }

    if (platform === "linux") {
      const linux = new LinuxNotifier();
      if (await linux.isAvailable()) {
        this.notifier = linux;
        return true;
      }
    }

    if (platform === "win32") {
      const windows = new WindowsNotifier();
      if (await windows.isAvailable()) {
        this.notifier = windows;
        return true;
      }
    }

    console.warn(
      `[opencode-notify] No notification backend available for platform: ${platform}`
    );
    return false;
  }

  async notify(options: NotificationOptions): Promise<NotificationResult> {
    if (!this.notifier) {
      const available = await this.initialise();
      if (!available || !this.notifier) {
        return { action: "dismissed", activated: false };
      }
    }

    return this.notifier.notify(options);
  }

  /**
   * Show a permission request notification with Accept/Always/Reject buttons.
   */
  async showPermissionRequest(
    tool: string,
    command: string,
    sound?: string,
    activateBundleId?: string
  ): Promise<NotificationResult> {
    return this.notify({
      title: "Opencode Permission Request",
      subtitle: tool,
      message: command.length > 100 ? command.slice(0, 100) + "…" : command,
      sound,
      actions: ["Accept", "Always", "Reject", "Dismiss"],
      activateBundleId,
    });
  }

  /**
   * Show a session completion notification.
   */
  async showSessionComplete(
    message: string,
    sound?: string,
    activateBundleId?: string
  ): Promise<void> {
    await this.notify({
      title: "Opencode",
      message,
      sound,
      activateBundleId,
    });
  }

  /**
   * Show an error notification.
   */
  async showError(
    message: string,
    sound?: string,
    activateBundleId?: string
  ): Promise<void> {
    await this.notify({
      title: "Opencode Error",
      message,
      sound,
      activateBundleId,
    });
  }

  /**
   * Show a question notification (from AskUserQuestion tool).
   * Returns the result so the caller can activate the terminal.
   */
  async showQuestion(
    question: string,
    sound?: string,
    activateBundleId?: string
  ): Promise<NotificationResult> {
    return this.notify({
      title: "Opencode Question",
      message: question,
      sound,
      actions: ["View", "Dismiss"],
      activateBundleId,
    });
  }
}

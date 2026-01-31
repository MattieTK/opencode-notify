import { loadConfig, isQuietHours, type Config } from "./config";
import { detectTerminal, isTerminalFocused, focusTerminal } from "./terminal";
import { NotificationDispatcher, type NotificationAction } from "./notify";
import { replyToPermission } from "./permission";

interface PluginContext {
  on(event: string, handler: (data: unknown) => void): void;
  getApiBaseUrl?(): string;
}

interface PermissionEvent {
  requestId: string;
  tool: string;
  command?: string;
  description?: string;
  isChildSession?: boolean;
}

interface SessionEvent {
  message?: string;
  error?: string;
  isChildSession?: boolean;
}

interface ToolEvent {
  tool: string;
  args?: {
    question?: string;
  };
  isChildSession?: boolean;
}

/**
 * Opencode Notify Plugin
 *
 * Provides native OS notifications with actionable buttons
 * when Opencode needs user input.
 */
export default function opencodeNotifyPlugin(context: PluginContext): void {
  const config = loadConfig();
  const terminal = detectTerminal(config.terminal);
  const dispatcher = new NotificationDispatcher();

  // Initialise the notification backend
  dispatcher.initialise().then((available) => {
    if (!available) {
      console.warn(
        "[opencode-notify] No notification backend available. " +
          "Install alerter (macOS), ensure D-Bus is available (Linux), " +
          "or install powertoast (Windows)."
      );
    }
  });

  const apiBaseUrl = context.getApiBaseUrl?.() ?? "http://localhost:3000";

  // Permission requests – show notification with Accept/Always/Reject
  context.on("permission.updated", async (data: unknown) => {
    const event = data as PermissionEvent;

    if (shouldSuppress(config, event.isChildSession)) {
      return;
    }

    if (isTerminalFocused(terminal)) {
      return;
    }

    const command = event.command ?? event.description ?? "Permission requested";
    const result = await dispatcher.showPermissionRequest(
      event.tool,
      command,
      config.sounds.permission
    );

    if (result.activated) {
      const sent = await replyToPermission(
        event.requestId,
        result.action as NotificationAction,
        apiBaseUrl
      );

      if (sent) {
        focusTerminal(terminal);
      }
    }
  });

  // Session idle – notify that Opencode is waiting
  context.on("session.idle", async (data: unknown) => {
    const event = data as SessionEvent;

    if (shouldSuppress(config, event.isChildSession)) {
      return;
    }

    if (isTerminalFocused(terminal)) {
      return;
    }

    const message = event.message ?? "Session complete";
    await dispatcher.showSessionComplete(message, config.sounds.complete);
  });

  // Session error – notify of errors
  context.on("session.error", async (data: unknown) => {
    const event = data as SessionEvent;

    if (shouldSuppress(config, event.isChildSession)) {
      return;
    }

    if (isTerminalFocused(terminal)) {
      return;
    }

    const message = event.error ?? "An error occurred";
    await dispatcher.showError(message, config.sounds.error);
  });

  // AskUserQuestion tool – notify when Opencode asks a question
  context.on("tool.execute.before", async (data: unknown) => {
    const event = data as ToolEvent;

    if (event.tool !== "AskUserQuestion") {
      return;
    }

    if (shouldSuppress(config, event.isChildSession)) {
      return;
    }

    if (isTerminalFocused(terminal)) {
      return;
    }

    const question = event.args?.question ?? "Opencode has a question for you";
    await dispatcher.showQuestion(question, config.sounds.permission);
  });
}

function shouldSuppress(config: Config, isChildSession?: boolean): boolean {
  // Suppress during quiet hours
  if (isQuietHours(config)) {
    return true;
  }

  // Suppress child session notifications unless configured
  if (isChildSession && !config.notifyChildSessions) {
    return true;
  }

  return false;
}

// Export types for consumers
export type { Config } from "./config";
export type { NotificationOptions, NotificationResult } from "./notify";

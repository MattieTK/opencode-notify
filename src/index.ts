import type { Plugin } from "@opencode-ai/plugin";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig, isQuietHours, type Config } from "./config";
import { detectTerminal, isTerminalFocused, focusTerminal } from "./terminal";
import { NotificationDispatcher } from "./notify";

// Debug logging to file (TUI hides console output)
const LOG_FILE = join(homedir(), ".opencode-notify.log");
function log(message: string): void {
  const timestamp = new Date().toISOString();
  appendFileSync(LOG_FILE, `${timestamp} ${message}\n`);
}

// Log immediately when module is loaded
log("Module loaded");

/**
 * Opencode Notify Plugin
 *
 * Provides native OS notifications with actionable buttons
 * when Opencode needs user input.
 */
export const opencodeNotifyPlugin: Plugin = async ({ client }) => {
  const config = loadConfig();
  const terminal = detectTerminal(config.terminal);
  const dispatcher = new NotificationDispatcher();

  // Track tool calls we've already shown notifications for
  const notifiedToolCalls = new Set<string>();

  // Only show one notification at a time - user will focus app after first one
  let isShowingNotification = false;

  // Track whether we've already notified for idle state (reset when agent becomes active)
  let hasNotifiedIdle = false;

  // Initialise the notification backend
  const available = await dispatcher.initialise(config);
  if (!available) {
    log("No notification backend available for this platform.");
  }

  log("Initialised");

  return {
    // NOTE: The permission.ask hook is defined in the SDK types but opencode
    // does NOT call it. Instead, opencode fires a "permission.asked" EVENT.
    // We keep this hook for future compatibility if opencode starts using it.
    "permission.ask": async (input, output) => {
      log("HOOK CALLED: permission.ask");
      // Agent is active, reset idle notification state
      hasNotifiedIdle = false;

      const patterns = Array.isArray(input.pattern)
        ? input.pattern.join(", ")
        : input.pattern ?? "";

      log(`permission.ask: id=${input.id}, type=${input.type}, pattern=${patterns}`);

      if (shouldSuppress(config, false)) {
        log(` Suppressed by config`);
        // Leave status as "ask" to let the terminal handle it
        return;
      }

      if (isTerminalFocused(terminal)) {
        log(` Terminal is focused, skipping`);
        // Leave status as "ask" to let the terminal handle it
        return;
      }

      if (isShowingNotification) {
        log(` Already showing a notification, skipping`);
        return;
      }

      const message = patterns || input.title || "Permission requested";

      log(`Showing permission notification: ${input.type} - ${message}`);
      isShowingNotification = true;

      try {
        const result = await dispatcher.showPermissionRequest(
          input.type,
          message,
          config.sounds.permission,
          terminal.bundleId
        );

        console.log(
          `[opencode-notify] Permission result: action=${result.action}, activated=${result.activated}`
        );

        const action = result.action.toLowerCase();

        if (action === "accept") {
          output.status = "allow";
        } else if (action === "always") {
          // The hook only supports "allow" for one-time approval
          // For "always", we allow once and focus terminal for user to confirm persistence
          output.status = "allow";
          if (config.focusAfterAction) {
            focusTerminal(terminal);
          }
        } else if (action === "reject") {
          output.status = "deny";
        }
        // For "dismissed" or unknown, leave status as "ask" (default)

        // Focus terminal if config allows and action was approved
        if (
          result.activated &&
          config.focusAfterAction &&
          (action === "accept" || action === "always")
        ) {
          focusTerminal(terminal);
        }
      } finally {
        isShowingNotification = false;
      }
    },

    // Handle events from the opencode event stream
    event: async ({ event }) => {
      log(`EVENT RECEIVED: ${event.type}`);

      // Handle permission.asked event
      // NOTE: This is what opencode actually fires for permission requests.
      // The permission.ask HOOK is not called - only this EVENT is fired.
      // Cast to string because permission.asked isn't in SDK types yet.
      const eventType = event.type as string;
      if (eventType === "permission.asked") {
        hasNotifiedIdle = false;

        const props = (event as { properties: unknown }).properties as {
          id?: string;
          sessionID?: string;
          permission?: string;
          patterns?: string[];
          metadata?: Record<string, unknown>;
        };

        log(`permission.asked: id=${props.id}, permission=${props.permission}, patterns=${props.patterns?.join(", ")}`);

        if (shouldSuppress(config, false)) {
          log("Suppressed by config");
          return;
        }

        if (isTerminalFocused(terminal)) {
          log("Terminal is focused, skipping");
          return;
        }

        if (isShowingNotification) {
          log("Already showing a notification, skipping");
          return;
        }

        const permissionType = props.permission ?? "Permission";
        const patterns = props.patterns?.join(", ") ?? "";
        const message = patterns || "Permission requested";

        log(`Showing permission notification: ${permissionType} - ${message}`);
        isShowingNotification = true;

        try {
          log("Calling dispatcher.showPermissionRequest...");
          const result = await dispatcher.showPermissionRequest(
            permissionType,
            message,
            config.sounds.permission,
            terminal.bundleId
          );

          log(`Permission result: action=${result.action}, activated=${result.activated}`);

          // Map notification action to permission response
          const action = result.action.toLowerCase();
          let reply: "once" | "always" | "reject" | null = null;

          if (action === "accept") {
            reply = "once";
          } else if (action === "always") {
            reply = "always";
          } else if (action === "reject") {
            reply = "reject";
          }

          // Send permission reply via SDK client
          if (reply && props.id && props.sessionID) {
            try {
              log(`Sending permission reply: ${reply} for ${props.id} (session: ${props.sessionID})`);
              await client.postSessionIdPermissionsPermissionId({
                path: {
                  id: props.sessionID,
                  permissionID: props.id,
                },
                body: {
                  response: reply,
                },
              });
              log(`Permission reply sent successfully`);
            } catch (replyErr) {
              log(`Error sending permission reply: ${replyErr}`);
            }
          }

          // Focus terminal if config allows and action was not dismiss
          // "view" means user clicked notification body to open terminal
          if (result.activated && config.focusAfterAction && action !== "dismissed") {
            focusTerminal(terminal);
          }
        } catch (err) {
          log(`Error showing notification: ${err}`);
        } finally {
          isShowingNotification = false;
        }
        return;
      }

      switch (event.type) {
        case "message.part.updated": {
          // Agent is active, reset idle notification state
          hasNotifiedIdle = false;

          // Tool call parts come through this event
          const props = event.properties as {
            part?: {
              id?: string;
              type?: string;
              tool?: string;
              state?: { status?: string };
              input?: { questions?: Array<{ question?: string }> };
            };
          };

          const part = props.part;

          if (
            part?.type === "tool" &&
            part?.tool?.toLowerCase() === "askuserquestion" &&
            part?.state?.status === "pending"
          ) {
            const callId = part.id ?? `part-AskUserQuestion-${Date.now()}`;
            if (notifiedToolCalls.has(callId)) {
              log(` Already notified for question: ${callId}`);
              return;
            }
            notifiedToolCalls.add(callId);

            log(` message.part.updated: AskUserQuestion detected, id=${callId}`);

            if (shouldSuppress(config, false)) {
              log(` Suppressed by config`);
              return;
            }

            if (isTerminalFocused(terminal)) {
              log(` Terminal is focused, skipping`);
              return;
            }

            if (isShowingNotification) {
              log(` Already showing a notification, skipping`);
              return;
            }

            const firstQuestion = part.input?.questions?.[0]?.question;
            const message = firstQuestion ?? "Opencode has a question for you";

            log(` Showing question notification: ${message.slice(0, 50)}...`);
            isShowingNotification = true;

            try {
              const result = await dispatcher.showQuestion(
                message,
                config.sounds.permission,
                terminal.bundleId
              );

              log(` Question result: action=${result.action}, activated=${result.activated}`);

              // Focus terminal if config allows and action was not dismiss
              if (result.activated && config.focusAfterAction && result.action.toLowerCase() !== "dismiss") {
                focusTerminal(terminal);
              }
            } finally {
              isShowingNotification = false;
            }
          }
          break;
        }

        case "message.updated": {
          // Agent is active, reset idle notification state
          hasNotifiedIdle = false;

          // Check for AskUserQuestion tool calls in assistant messages
          const info = event.properties.info;

          if (info.role !== "assistant") {
            return;
          }

          // Look for pending AskUserQuestion tool calls
          const parts = (info as { parts?: unknown[] }).parts;

          if (!Array.isArray(parts) || parts.length === 0) {
            return;
          }

          for (const part of parts) {
            const p = part as {
              type?: string;
              tool?: string;
              state?: { status?: string };
              input?: { questions?: Array<{ question?: string }> };
              id?: string;
            };

            if (
              p.type === "tool" &&
              p.tool?.toLowerCase() === "askuserquestion" &&
              p.state?.status === "pending"
            ) {
              // Avoid duplicate notifications for the same tool call
              const callId = p.id ?? `${info.id}-AskUserQuestion`;
              if (notifiedToolCalls.has(callId)) {
                log(` Already notified for question: ${callId}`);
                return;
              }
              notifiedToolCalls.add(callId);

              log(` message.updated: AskUserQuestion detected, id=${callId}`);

              if (shouldSuppress(config, false)) {
                log(` Suppressed by config`);
                return;
              }

              if (isTerminalFocused(terminal)) {
                log(` Terminal is focused, skipping`);
                return;
              }

              if (isShowingNotification) {
                log(` Already showing a notification, skipping`);
                return;
              }

              const firstQuestion = p.input?.questions?.[0]?.question;
              const message = firstQuestion ?? "Opencode has a question for you";

              log(` Showing question notification: ${message.slice(0, 50)}...`);
              isShowingNotification = true;

              try {
                const result = await dispatcher.showQuestion(
                  message,
                  config.sounds.permission,
                  terminal.bundleId
                );

                log(` Question result: action=${result.action}, activated=${result.activated}`);

                // Focus terminal if config allows and action was not dismiss
                if (result.activated && config.focusAfterAction && result.action.toLowerCase() !== "dismiss") {
                  focusTerminal(terminal);
                }
              } finally {
                isShowingNotification = false;
              }
              return;
            }
          }
          break;
        }

        case "permission.updated": {
          // Fallback notification if permission.ask hook doesn't trigger
          // Shows notification and focuses terminal for user to respond there
          hasNotifiedIdle = false;

          const props = event.properties;

          console.log(
            `[opencode-notify] permission.updated: id=${props.id}, type=${props.type}`
          );

          if (shouldSuppress(config, false)) {
            log(` Suppressed by config`);
            return;
          }

          if (isTerminalFocused(terminal)) {
            log(` Terminal is focused, skipping`);
            return;
          }

          if (isShowingNotification) {
            log(` Already showing a notification, skipping`);
            return;
          }

          const command = props.title ?? "Permission requested";
          console.log(
            `[opencode-notify] Showing permission.updated notification: ${props.type} - ${command}`
          );
          isShowingNotification = true;

          try {
            const result = await dispatcher.showPermissionRequest(
              props.type,
              command,
              config.sounds.permission,
              terminal.bundleId
            );

            console.log(
              `[opencode-notify] Permission result: action=${result.action}, activated=${result.activated}`
            );

            // Focus terminal so user can respond to the permission there
            // (No HTTP reply needed - user responds directly in terminal)
            if (config.focusAfterAction && result.action.toLowerCase() !== "dismiss") {
              focusTerminal(terminal);
            }
          } finally {
            isShowingNotification = false;
          }
          break;
        }

        case "session.error": {
          const props = event.properties;

          if (shouldSuppress(config, false)) {
            return;
          }

          if (isTerminalFocused(terminal)) {
            return;
          }

          // Extract message from the error union type
          const errorData = props.error?.data as { message?: string } | undefined;
          const message = errorData?.message ?? "An error occurred";
          await dispatcher.showError(
            message,
            config.sounds.error,
            terminal.bundleId
          );
          break;
        }

        case "session.idle": {
          if (!config.notifyOnIdle) {
            return;
          }

          if (hasNotifiedIdle) {
            return;
          }

          if (shouldSuppress(config, false)) {
            return;
          }

          if (isTerminalFocused(terminal)) {
            return;
          }

          hasNotifiedIdle = true;
          await dispatcher.showSessionComplete(
            "Agent has stopped and is waiting for input",
            config.sounds.permission,
            terminal.bundleId
          );
          break;
        }
      }
    },

    // Handle AskUserQuestion tool calls (fallback if message.part.updated doesn't trigger)
    "tool.execute.before": async (input, output) => {
      log(`HOOK CALLED: tool.execute.before - ${input.tool}`);
      // Agent is active, reset idle notification state
      hasNotifiedIdle = false;

      if (input.tool.toLowerCase() !== "askuserquestion") {
        return;
      }

      const callId = input.callID ?? `tool-${Date.now()}`;
      log(` tool.execute.before: AskUserQuestion, callID=${callId}`);

      // Check if already notified
      if (notifiedToolCalls.has(callId)) {
        log(` Already notified for question: ${callId}`);
        return;
      }
      notifiedToolCalls.add(callId);

      if (shouldSuppress(config, false)) {
        log(` Suppressed by config`);
        return;
      }

      if (isTerminalFocused(terminal)) {
        log(` Terminal is focused, skipping`);
        return;
      }

      if (isShowingNotification) {
        log(` Already showing a notification, skipping`);
        return;
      }

      // Extract question text from tool arguments
      const args = output.args as {
        questions?: Array<{ question?: string }>;
      } | undefined;

      const firstQuestion = args?.questions?.[0]?.question;
      const message = firstQuestion ?? "Opencode has a question for you";

      log(` Showing question notification (tool.execute.before): ${message.slice(0, 50)}...`);
      isShowingNotification = true;

      try {
        const result = await dispatcher.showQuestion(
          message,
          config.sounds.permission,
          terminal.bundleId
        );

        log(` Question result: action=${result.action}, activated=${result.activated}`);

        // Focus terminal if config allows and action was not dismiss
        if (result.activated && config.focusAfterAction && result.action.toLowerCase() !== "dismiss") {
          focusTerminal(terminal);
        }
      } finally {
        isShowingNotification = false;
      }
    },
  };
};

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

// Default export for opencode plugin loading
export default opencodeNotifyPlugin;

// Export types for consumers
export type { Config } from "./config";
export type { NotificationOptions, NotificationResult } from "./notify";

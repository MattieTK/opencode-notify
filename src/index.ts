import type { Plugin } from "@opencode-ai/plugin";
import { loadConfig, isQuietHours, type Config } from "./config";
import { detectTerminal, isTerminalFocused, focusTerminal } from "./terminal";
import { NotificationDispatcher, type NotificationAction } from "./notify";
import { replyToPermission } from "./permission";

/**
 * Opencode Notify Plugin
 *
 * Provides native OS notifications with actionable buttons
 * when Opencode needs user input.
 */
export const opencodeNotifyPlugin: Plugin = async ({ serverUrl }) => {
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
  const available = await dispatcher.initialise();
  if (!available) {
    console.warn(
      "[opencode-notify] No notification backend available for this platform."
    );
  }

  const apiBaseUrl = serverUrl.toString().replace(/\/$/, "");
  console.log(`[opencode-notify] Initialised, API base URL: ${apiBaseUrl}`);

  return {
    // Handle events from the opencode event stream
    event: async ({ event }) => {
      const eventType = event.type as string;

      // Handle permission.asked (not in SDK types yet)
      if (eventType === "permission.asked") {
        // Agent is active, reset idle notification state
        hasNotifiedIdle = false;

        const props = event.properties as {
          id?: string;
          sessionID?: string;
          permission?: string;
          patterns?: string[];
          metadata?: Record<string, unknown>;
        };

        console.log(`[opencode-notify] permission.asked: id=${props.id}, permission=${props.permission}, patterns=${props.patterns?.join(", ")}`);

        if (shouldSuppress(config, false)) {
          console.log(`[opencode-notify] Suppressed by config`);
          return;
        }

        if (isTerminalFocused(terminal)) {
          console.log(`[opencode-notify] Terminal is focused, skipping`);
          return;
        }

        if (isShowingNotification) {
          console.log(`[opencode-notify] Already showing a notification, skipping`);
          return;
        }

        // Build descriptive notification text
        const permissionType = props.permission ?? "Permission";
        const patterns = props.patterns?.join(", ") ?? "";
        const message = patterns || "Permission requested";

        console.log(`[opencode-notify] Showing permission notification: ${permissionType} - ${message}`);
        isShowingNotification = true;

        try {
          const result = await dispatcher.showPermissionRequest(
            permissionType,
            message,
            config.sounds.permission,
            terminal.bundleId
          );

          console.log(`[opencode-notify] Permission result: action=${result.action}, activated=${result.activated}`);

          // Send reply for any action (accept, always, reject) - not just activated ones
          const action = result.action.toLowerCase();
          if (props.id && props.sessionID && (action === "accept" || action === "always" || action === "reject")) {
            const sent = await replyToPermission(
              props.sessionID,
              props.id,
              result.action as NotificationAction,
              apiBaseUrl
            );

            console.log(`[opencode-notify] Permission reply sent: ${sent}`);

            // Focus terminal if config allows and action was approved
            if (sent && result.activated && config.focusAfterAction) {
              focusTerminal(terminal);
            }
          }
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
              console.log(`[opencode-notify] Already notified for question: ${callId}`);
              return;
            }
            notifiedToolCalls.add(callId);

            console.log(`[opencode-notify] message.part.updated: AskUserQuestion detected, id=${callId}`);

            if (shouldSuppress(config, false)) {
              console.log(`[opencode-notify] Suppressed by config`);
              return;
            }

            if (isTerminalFocused(terminal)) {
              console.log(`[opencode-notify] Terminal is focused, skipping`);
              return;
            }

            if (isShowingNotification) {
              console.log(`[opencode-notify] Already showing a notification, skipping`);
              return;
            }

            const firstQuestion = part.input?.questions?.[0]?.question;
            const message = firstQuestion ?? "Opencode has a question for you";

            console.log(`[opencode-notify] Showing question notification: ${message.slice(0, 50)}...`);
            isShowingNotification = true;

            try {
              const result = await dispatcher.showQuestion(
                message,
                config.sounds.permission,
                terminal.bundleId
              );

              console.log(`[opencode-notify] Question result: action=${result.action}, activated=${result.activated}`);

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
                console.log(`[opencode-notify] Already notified for question: ${callId}`);
                return;
              }
              notifiedToolCalls.add(callId);

              console.log(`[opencode-notify] message.updated: AskUserQuestion detected, id=${callId}`);

              if (shouldSuppress(config, false)) {
                console.log(`[opencode-notify] Suppressed by config`);
                return;
              }

              if (isTerminalFocused(terminal)) {
                console.log(`[opencode-notify] Terminal is focused, skipping`);
                return;
              }

              if (isShowingNotification) {
                console.log(`[opencode-notify] Already showing a notification, skipping`);
                return;
              }

              const firstQuestion = p.input?.questions?.[0]?.question;
              const message = firstQuestion ?? "Opencode has a question for you";

              console.log(`[opencode-notify] Showing question notification: ${message.slice(0, 50)}...`);
              isShowingNotification = true;

              try {
                const result = await dispatcher.showQuestion(
                  message,
                  config.sounds.permission,
                  terminal.bundleId
                );

                console.log(`[opencode-notify] Question result: action=${result.action}, activated=${result.activated}`);

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
          // Agent is active, reset idle notification state
          hasNotifiedIdle = false;

          // Also handled above for permission.asked
          const props = event.properties;

          console.log(`[opencode-notify] permission.updated: id=${props.id}, type=${props.type}`);

          if (shouldSuppress(config, false)) {
            console.log(`[opencode-notify] Suppressed by config`);
            return;
          }

          if (isTerminalFocused(terminal)) {
            console.log(`[opencode-notify] Terminal is focused, skipping`);
            return;
          }

          if (isShowingNotification) {
            console.log(`[opencode-notify] Already showing a notification, skipping`);
            return;
          }

          const command = props.title ?? "Permission requested";
          console.log(`[opencode-notify] Showing permission.updated notification: ${props.type} - ${command}`);
          isShowingNotification = true;

          try {
            const result = await dispatcher.showPermissionRequest(
              props.type,
              command,
              config.sounds.permission,
              terminal.bundleId
            );

            console.log(`[opencode-notify] Permission result: action=${result.action}, activated=${result.activated}`);

            const action = result.action.toLowerCase();
            if (props.sessionID && props.id && (action === "accept" || action === "always" || action === "reject")) {
              const sent = await replyToPermission(
                props.sessionID,
                props.id,
                result.action as NotificationAction,
                apiBaseUrl
              );

              console.log(`[opencode-notify] Permission reply sent: ${sent}`);

              // Focus terminal if config allows and action was approved
              if (sent && result.activated && config.focusAfterAction) {
                focusTerminal(terminal);
              }
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
      // Agent is active, reset idle notification state
      hasNotifiedIdle = false;

      if (input.tool.toLowerCase() !== "askuserquestion") {
        return;
      }

      const callId = input.callID ?? `tool-${Date.now()}`;
      console.log(`[opencode-notify] tool.execute.before: AskUserQuestion, callID=${callId}`);

      // Check if already notified
      if (notifiedToolCalls.has(callId)) {
        console.log(`[opencode-notify] Already notified for question: ${callId}`);
        return;
      }
      notifiedToolCalls.add(callId);

      if (shouldSuppress(config, false)) {
        console.log(`[opencode-notify] Suppressed by config`);
        return;
      }

      if (isTerminalFocused(terminal)) {
        console.log(`[opencode-notify] Terminal is focused, skipping`);
        return;
      }

      if (isShowingNotification) {
        console.log(`[opencode-notify] Already showing a notification, skipping`);
        return;
      }

      // Extract question text from tool arguments
      const args = output.args as {
        questions?: Array<{ question?: string }>;
      } | undefined;

      const firstQuestion = args?.questions?.[0]?.question;
      const message = firstQuestion ?? "Opencode has a question for you";

      console.log(`[opencode-notify] Showing question notification (tool.execute.before): ${message.slice(0, 50)}...`);
      isShowingNotification = true;

      try {
        const result = await dispatcher.showQuestion(
          message,
          config.sounds.permission,
          terminal.bundleId
        );

        console.log(`[opencode-notify] Question result: action=${result.action}, activated=${result.activated}`);

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

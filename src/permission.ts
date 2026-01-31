import type { NotificationAction } from "./notify";

interface PermissionReplyPayload {
  allow: boolean;
  remember?: "session" | "forever";
}

/**
 * Respond to a permission request via the Opencode API.
 */
export async function replyToPermission(
  requestId: string,
  action: NotificationAction,
  baseUrl: string = "http://localhost:3000"
): Promise<boolean> {
  const payload = actionToPayload(action);

  if (payload === null) {
    // Dismissed or unknown action – don't send a response
    return false;
  }

  try {
    const response = await fetch(
      `${baseUrl}/permission/${requestId}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("[opencode-notify] Failed to reply to permission:", error);
    return false;
  }
}

function actionToPayload(action: NotificationAction): PermissionReplyPayload | null {
  switch (action) {
    case "accept":
      return { allow: true };
    case "always":
      return { allow: true, remember: "forever" };
    case "reject":
      return { allow: false };
    case "dismissed":
    default:
      return null;
  }
}

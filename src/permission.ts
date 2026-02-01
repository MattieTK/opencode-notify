import type { NotificationAction } from "./notify";

type PermissionResponse = "once" | "always" | "reject";

/**
 * Respond to a permission request via the Opencode API.
 */
export async function replyToPermission(
  sessionId: string,
  permissionId: string,
  action: NotificationAction,
  baseUrl: string = "http://localhost:3000"
): Promise<boolean> {
  const response = actionToResponse(action);

  if (response === null) {
    // Dismissed or unknown action – don't send a response
    return false;
  }

  const url = `${baseUrl}/session/${sessionId}/permissions/${permissionId}`;
  const payload = { response };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (error) {
    console.error("[opencode-notify] Failed to reply to permission:", error);
    return false;
  }
}

function actionToResponse(action: NotificationAction): PermissionResponse | null {
  switch (action.toLowerCase()) {
    case "accept":
      return "once";
    case "always":
      return "always";
    case "reject":
      return "reject";
    case "dismissed":
    default:
      return null;
  }
}

export type NotificationAction = "accept" | "always" | "reject" | "focus" | "dismissed";

export interface NotificationOptions {
  title: string;
  message: string;
  subtitle?: string;
  sound?: string;
  actions?: string[];
  timeout?: number;
  /** macOS bundle ID to activate when notification is clicked */
  activateBundleId?: string;
}

export interface NotificationResult {
  action: NotificationAction | string;
  activated: boolean;
}

export interface Notifier {
  notify(options: NotificationOptions): Promise<NotificationResult>;
  isAvailable(): Promise<boolean>;
}

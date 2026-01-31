export type NotificationAction = "accept" | "always" | "reject" | "dismissed";

export interface NotificationOptions {
  title: string;
  message: string;
  subtitle?: string;
  sound?: string;
  actions?: string[];
  timeout?: number;
}

export interface NotificationResult {
  action: NotificationAction | string;
  activated: boolean;
}

export interface Notifier {
  notify(options: NotificationOptions): Promise<NotificationResult>;
  isAvailable(): Promise<boolean>;
}

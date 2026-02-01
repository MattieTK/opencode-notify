import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SoundConfig {
  permission: string;
  error: string;
}

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // HH:MM format
  end: string;
}

export interface Config {
  sounds: SoundConfig;
  quietHours: QuietHoursConfig;
  notifyChildSessions: boolean;
  terminal: string | null;
  focusAfterAction: boolean;
  notifyOnIdle: boolean;
}

const DEFAULT_CONFIG: Config = {
  sounds: {
    permission: "Submarine",
    error: "Basso",
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
  notifyChildSessions: false,
  terminal: null,
  focusAfterAction: true,
  notifyOnIdle: false,
};

function getConfigPath(): string {
  return join(homedir(), ".config", "opencode", "opencode-notify.json");
}

export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const contents = readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(contents) as Partial<Config>;
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      sounds: { ...DEFAULT_CONFIG.sounds, ...userConfig.sounds },
      quietHours: { ...DEFAULT_CONFIG.quietHours, ...userConfig.quietHours },
    };
  } catch {
    console.warn("[opencode-notify] Failed to parse config, using defaults");
    return DEFAULT_CONFIG;
  }
}

function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours, minutes };
}

export function isQuietHours(config: Config): boolean {
  if (!config.quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const start = parseTime(config.quietHours.start);
  const end = parseTime(config.quietHours.end);

  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  // Handle overnight quiet hours (e.g., 22:00 – 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

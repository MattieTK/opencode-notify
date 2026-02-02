# opencode-notify

System popups with actionable buttons for Opencode. When Opencode needs permission or has a question, you'll receive a popup you can respond to directly – no need to switch back to the terminal.

## Features

- **Actionable buttons** – Accept, Always, Reject, or Dismiss permission requests directly from popups
- **Cross-platform** – Works on macOS (no dependencies), Linux, and Windows
- **Terminal focus detection** – Suppresses popups when your terminal is already focused
- **Quiet hours** – Optionally silence alerts during specified times
- **Child session control** – Choose whether to notify for subagent sessions
- **Auto-focus** – Optionally focus your terminal after responding to a popup
- **Idle alerts** – Optionally alert when the agent stops without requesting input

## Installation

Add the plugin to your Opencode configuration file (`~/.config/opencode/config.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-notify"]
}
```

The plugin is installed automatically via Bun at startup.

### Platform Dependencies

#### macOS

No additional dependencies. The plugin bundles a Swift app that displays notifications.

By default, the plugin uses native macOS Notification Centre banners. These appear in Notification Centre, respect Do Not Disturb, and show the app name as "OpenCode Request".

Optionally, set `nativeMacNotifications: false` to use modal alert dialogs instead. Modal dialogs support multiple action buttons (Accept/Always/Reject) and bypass Do Not Disturb, but don't appear in Notification Centre.

#### Linux

For action button support, install D-Bus development libraries:

```bash
# Debian/Ubuntu
sudo apt install libdbus-1-dev

# Fedora
sudo dnf install dbus-devel
```

The plugin will fall back to `notify-send` if D-Bus isn't available, but actions won't work.

#### Windows

Requires Windows 10 version 1709 or later. No additional dependencies needed.

## Configuration

Create `~/.config/opencode/opencode-notify.json`:

```json
{
  "sounds": {
    "permission": "Submarine",
    "error": "Basso"
  },
  "quietHours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  },
  "notifyChildSessions": false,
  "terminal": null,
  "focusAfterAction": true,
  "notifyOnIdle": false,
  "nativeMacNotifications": true
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sounds.permission` | string | `"Submarine"` | Sound for permission requests and questions |
| `sounds.error` | string | `"Basso"` | Sound for errors |
| `quietHours.enabled` | boolean | `false` | Enable quiet hours |
| `quietHours.start` | string | `"22:00"` | Quiet hours start (HH:MM) |
| `quietHours.end` | string | `"08:00"` | Quiet hours end (HH:MM) |
| `notifyChildSessions` | boolean | `false` | Notify for subagent sessions |
| `terminal` | string \| null | `null` | Override terminal detection |
| `focusAfterAction` | boolean | `true` | Focus terminal after responding to a popup |
| `notifyOnIdle` | boolean | `false` | Notify when the agent stops without requesting input |
| `nativeMacNotifications` | boolean | `true` | Use macOS Notification Centre instead of modal dialogs (macOS only) |

### Terminal Detection

The plugin auto-detects these terminals:

- Ghostty
- Kitty
- iTerm2
- WezTerm
- Apple Terminal
- Alacritty
- Hyper
- Windows Terminal

Set `terminal` in config to override if detection fails.

## How It Works

The plugin hooks into Opencode events:

1. **Permission requests** → Shows popup with Accept/Always/Reject/Dismiss buttons
2. **Questions** → Shows popup when Opencode asks a question (AskUserQuestion tool) with View/Dismiss buttons
3. **Session errors** → Shows error popup
4. **Session idle** → Optionally shows popup when the agent stops without requesting input (disabled by default, enable with `notifyOnIdle`). Only fires once per idle period – resets when the agent becomes active again.

When you click a button on a permission popup, the plugin:
1. Sends your response to Opencode via its API
2. Focuses your terminal window (if `focusAfterAction` is enabled)

## Comparison with Similar Plugins

| Feature | mohak34/opencode-notifier | This Plugin |
|---------|---------------------------|-------------|
| Action buttons | No | Yes |
| macOS notifications | osascript | CFUserNotification or Notification Centre |
| Linux notifications | notify-send | D-Bus |
| Windows notifications | node-notifier | powertoast |
| Permission response | Manual in terminal | Click button |
| Terminal focus detection | No | Yes |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## Licence

MIT

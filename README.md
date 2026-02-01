# opencode-notify

Native OS notifications with actionable buttons for Opencode. When Opencode needs permission or has a question, you'll receive a notification you can respond to directly – no need to switch back to the terminal.

## Features

- **Actionable buttons** – Accept, Always, Reject, or Dismiss permission requests directly from notifications
- **Cross-platform** – Works on macOS (no dependencies), Linux, and Windows
- **Terminal focus detection** – Suppresses notifications when your terminal is already focused
- **Quiet hours** – Optionally silence notifications during specified times
- **Child session control** – Choose whether to notify for subagent sessions
- **Auto-focus** – Optionally focus your terminal after responding to a notification
- **Idle notifications** – Optionally notify when the agent stops without requesting input

## Installation

```bash
# Install the plugin
opencode plugin add opencode-notify
```

### Platform Dependencies

#### macOS

No additional dependencies. The plugin bundles a native Swift app that uses CFUserNotification for alert dialogs.

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
  "notifyOnIdle": false
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
| `focusAfterAction` | boolean | `true` | Focus terminal after responding to a notification |
| `notifyOnIdle` | boolean | `false` | Notify when the agent stops without requesting input |

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

1. **Permission requests** → Shows notification with Accept/Always/Reject/Dismiss buttons
2. **Questions** → Notifies when Opencode asks a question (AskUserQuestion tool) with View/Dismiss buttons
3. **Session errors** → Notifies of errors
4. **Session idle** → Optionally notifies when the agent stops without requesting input (disabled by default, enable with `notifyOnIdle`). Only fires once per idle period – resets when the agent becomes active again.

When you click a button on a permission notification, the plugin:
1. Sends your response to Opencode via its API
2. Focuses your terminal window (if `focusAfterAction` is enabled)

## Comparison with Similar Plugins

| Feature | mohak34/opencode-notifier | This Plugin |
|---------|---------------------------|-------------|
| Action buttons | No | Yes |
| macOS notifications | osascript | CFUserNotification (bundled) |
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

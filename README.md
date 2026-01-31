# opencode-notify

Native OS notifications with actionable buttons for Opencode. When Opencode needs permission or has a question, you'll receive a notification you can respond to directly – no need to switch back to the terminal.

## Features

- **Actionable buttons** – Accept, Always, or Reject permission requests directly from notifications
- **Cross-platform** – Works on macOS, Linux, and Windows
- **Terminal focus detection** – Suppresses notifications when your terminal is already focused
- **Quiet hours** – Optionally silence notifications during specified times
- **Child session control** – Choose whether to notify for subagent sessions

## Installation

```bash
# Install the plugin
opencode plugin add opencode-notify
```

### Platform Dependencies

#### macOS

Install [alerter](https://github.com/vjeantet/alerter) for interactive notifications:

```bash
brew install alerter
```

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
    "complete": "Glass",
    "error": "Basso"
  },
  "quietHours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  },
  "notifyChildSessions": false,
  "terminal": null
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sounds.permission` | string | `"Submarine"` | Sound for permission requests |
| `sounds.complete` | string | `"Glass"` | Sound for session completion |
| `sounds.error` | string | `"Basso"` | Sound for errors |
| `quietHours.enabled` | boolean | `false` | Enable quiet hours |
| `quietHours.start` | string | `"22:00"` | Quiet hours start (HH:MM) |
| `quietHours.end` | string | `"08:00"` | Quiet hours end (HH:MM) |
| `notifyChildSessions` | boolean | `false` | Notify for subagent sessions |
| `terminal` | string \| null | `null` | Override terminal detection |

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

1. **Permission requests** → Shows notification with Accept/Always/Reject buttons
2. **Session idle** → Notifies when Opencode finishes and is waiting
3. **Session errors** → Notifies of errors
4. **Questions** → Notifies when Opencode asks a question (AskUserQuestion tool)

When you click a button on a permission notification, the plugin:
1. Sends your response to Opencode via its API
2. Focuses your terminal window

## Comparison with Similar Plugins

| Feature | mohak34/opencode-notifier | This Plugin |
|---------|---------------------------|-------------|
| Action buttons | No | Yes |
| macOS notifications | osascript | alerter |
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

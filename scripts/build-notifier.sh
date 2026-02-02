#!/bin/bash
# Build the macOS notification app bundle
# Only runs on macOS, skipped on other platforms

set -e

# Skip if not on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "Skipping native build (not on macOS)"
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_ROOT/dist"
APP_DIR="$DIST_DIR/OpenCodeNotifier.app"
SWIFT_SRC="$PROJECT_ROOT/src/native/notify.swift"

echo "Building OpenCodeNotifier.app..."

# Create app bundle structure
mkdir -p "$APP_DIR/Contents/MacOS"

# Compile for arm64
swiftc -O -target arm64-apple-macosx11.0 "$SWIFT_SRC" -o /tmp/opencode-notifier-arm64 2>/dev/null

# Compile for x86_64
swiftc -O -target x86_64-apple-macosx11.0 "$SWIFT_SRC" -o /tmp/opencode-notifier-x86_64 2>/dev/null

# Create universal binary
lipo -create /tmp/opencode-notifier-arm64 /tmp/opencode-notifier-x86_64 \
    -output "$APP_DIR/Contents/MacOS/opencode-notifier"

chmod +x "$APP_DIR/Contents/MacOS/opencode-notifier"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>opencode-notifier</string>
    <key>CFBundleIdentifier</key>
    <string>dev.opencode.notifier</string>
    <key>CFBundleName</key>
    <string>OpenCode Request</string>
    <key>CFBundleDisplayName</key>
    <string>OpenCode Request</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSUserNotificationAlertStyle</key>
    <string>alert</string>
</dict>
</plist>
EOF

# Skip explicit codesign - linker's automatic ad-hoc signing is sufficient
# and explicit signing can cause issues on modern macOS
# codesign --force --deep --sign - "$APP_DIR"

# Clean up
rm -f /tmp/opencode-notifier-arm64 /tmp/opencode-notifier-x86_64

echo "Built: $APP_DIR"

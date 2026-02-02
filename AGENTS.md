# Agent Notes

Lessons learned during development that may help future agents working on this codebase.

## macOS Code Signing

**Do not explicitly ad-hoc sign binaries with `codesign --force --deep --sign -`.**

On modern macOS (11+), explicitly ad-hoc signed binaries can be killed by system security (SIGKILL, exit code 137), while binaries with only the automatic linker-provided ad-hoc signature run without issue.

The Swift compiler automatically produces linker-signed binaries (`flags=adhoc,linker-signed`). This is sufficient for execution. Adding an explicit `codesign` step overwrites this with a different signature that macOS treats more suspiciously.

If you see binaries being killed immediately on execution with no error output, check whether explicit code signing is being applied and try removing it.

## macOS Notification APIs

- **UNUserNotificationCenter** (modern API): Requires proper Apple Developer signing. Ad-hoc signed apps will crash with `bundleProxyForCurrentProcess is nil`.

- **NSUserNotificationCenter** (legacy API, deprecated in macOS 11): Works with linker-signed binaries. Still functional on current macOS versions despite deprecation warnings.

- **CFUserNotification**: Low-level API for modal dialogs. Works from any process context including daemons. No signing requirements beyond basic ad-hoc.

For command-line notification tools, NSUserNotificationCenter is the pragmatic choice for Notification Centre banners, while CFUserNotification works for modal dialogs.

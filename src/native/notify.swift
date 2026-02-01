import Foundation
import Cocoa

// MARK: - Argument Parsing

struct NotificationArgs {
    var title: String = "Notification"
    var message: String = ""
    var subtitle: String?
    var sound: String?
    var actions: [String] = []
    var timeout: TimeInterval = 0
    var bundleId: String?
    var json: Bool = false
}

func parseArgs() -> NotificationArgs {
    var args = NotificationArgs()
    let argv = CommandLine.arguments
    var i = 1

    while i < argv.count {
        switch argv[i] {
        case "-title":
            i += 1
            if i < argv.count { args.title = argv[i] }
        case "-message":
            i += 1
            if i < argv.count { args.message = argv[i] }
        case "-subtitle":
            i += 1
            if i < argv.count { args.subtitle = argv[i] }
        case "-sound":
            i += 1
            if i < argv.count { args.sound = argv[i] }
        case "-actions":
            i += 1
            if i < argv.count {
                args.actions = argv[i].components(separatedBy: ",")
            }
        case "-timeout":
            i += 1
            if i < argv.count { args.timeout = TimeInterval(argv[i]) ?? 0 }
        case "-sender":
            i += 1
            if i < argv.count { args.bundleId = argv[i] }
        case "-json":
            args.json = true
        case "-help", "--help":
            printUsage()
            exit(0)
        default:
            break
        }
        i += 1
    }

    return args
}

func printUsage() {
    print("""
    opencode-notifier - macOS alert dialogs

    Usage: opencode-notifier [options]

    Options:
      -title <string>      Alert title
      -message <string>    Alert message body
      -subtitle <string>   Alert informative text
      -sound <string>      Sound name (e.g., "default", "Ping")
      -actions <a,b,c>     Comma-separated button labels (max 3)
      -timeout <seconds>   Auto-dismiss timeout (0 = wait forever)
      -sender <bundleId>   App to activate after action
      -json                Output result as JSON
      -help                Show this help

    Exit codes:
      0 - Primary action button clicked
      1 - Dismissed, timed out, or other button clicked
      2 - Error occurred
    """)
}

// MARK: - Output

func outputResult(action: String, activated: Bool, json: Bool) {
    if json {
        let result: [String: Any] = [
            "action": action,
            "activated": activated
        ]
        if let jsonData = try? JSONSerialization.data(withJSONObject: result),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
        }
    } else {
        print(action)
    }
    fflush(stdout)
}

// MARK: - Main

func main() {
    let args = parseArgs()

    if args.message.isEmpty {
        fputs("Error: -message is required\n", stderr)
        exit(2)
    }

    // Build the message with optional subtitle
    var fullMessage = args.message
    if let subtitle = args.subtitle {
        fullMessage = "\(subtitle)\n\n\(args.message)"
    }

    // Build dictionary for CFUserNotification
    var dict: [String: Any] = [
        kCFUserNotificationAlertHeaderKey as String: args.title,
        kCFUserNotificationAlertMessageKey as String: fullMessage
    ]

    // Default button (rightmost) - first action
    if !args.actions.isEmpty {
        dict[kCFUserNotificationDefaultButtonTitleKey as String] = args.actions[0]
    }

    // Alternate button (leftmost) - last action
    if args.actions.count > 1 {
        dict[kCFUserNotificationAlternateButtonTitleKey as String] = args.actions[args.actions.count - 1]
    }

    // Other button (middle) - second action
    if args.actions.count > 2 {
        dict[kCFUserNotificationOtherButtonTitleKey as String] = args.actions[1]
    }

    // Play sound
    if let sound = args.sound {
        if sound == "default" {
            NSSound.beep()
        } else if let soundObj = NSSound(named: sound) {
            soundObj.play()
        }
    }

    let cfDict = dict as CFDictionary
    var error: Int32 = 0
    let timeout = args.timeout > 0 ? args.timeout : 0

    // Create and display the alert
    guard let notification = CFUserNotificationCreate(
        kCFAllocatorDefault,
        timeout,
        kCFUserNotificationPlainAlertLevel,
        &error,
        cfDict
    ) else {
        fputs("Error creating notification: \(error)\n", stderr)
        outputResult(action: "error", activated: false, json: args.json)
        exit(2)
    }

    // Wait for response
    var responseFlags: CFOptionFlags = 0
    let result = CFUserNotificationReceiveResponse(
        notification,
        timeout,
        &responseFlags
    )

    // Handle timeout
    if result != 0 {
        outputResult(action: "timeout", activated: false, json: args.json)

        // Activate sender app if specified
        if let bundleId = args.bundleId {
            activateApp(bundleId: bundleId)
        }
        exit(1)
    }

    // Determine which button was clicked
    let buttonPressed = responseFlags & 0x3

    var action: String
    var activated = true

    switch buttonPressed {
    case kCFUserNotificationDefaultResponse:
        // Default button (first action, rightmost)
        action = args.actions.isEmpty ? "clicked" : args.actions[0].lowercased()
    case kCFUserNotificationAlternateResponse:
        // Alternate button (last action, leftmost)
        action = args.actions.count > 1 ? args.actions[args.actions.count - 1].lowercased() : "alternate"
        // Reject/Cancel actions don't activate
        if action == "reject" || action == "cancel" {
            activated = false
        }
    case kCFUserNotificationOtherResponse:
        // Other button (second action, middle)
        action = args.actions.count > 2 ? args.actions[1].lowercased() : "other"
    case kCFUserNotificationCancelResponse:
        action = "dismissed"
        activated = false
    default:
        action = "unknown"
        activated = false
    }

    // Activate sender app if specified and action was taken
    if activated, let bundleId = args.bundleId {
        activateApp(bundleId: bundleId)
    }

    outputResult(action: action, activated: activated, json: args.json)
    exit(activated ? 0 : 1)
}

func activateApp(bundleId: String) {
    if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) {
        NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
    }
}

main()

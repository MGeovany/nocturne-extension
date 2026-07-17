//
//  ViewController.swift
//  Nocturne
//
//  Created by Marlon Castro on 19/6/26.
//

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "dev.thefndrs.nocturne.Extension"

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show(\(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show(\(state.isEnabled), false)")
                }
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard (message.body as? String) == "open-preferences" else {
            return
        }

        openSafariExtensionPreferences()
    }

    private var isOpeningPreferences = false

    private func openSafariExtensionPreferences() {
        guard !isOpeningPreferences else { return }
        isOpeningPreferences = true

        var finished = false
        let finishOnce: (Error?) -> Void = { [weak self] error in
            guard !finished else { return }
            finished = true

            if error == nil {
                NSApplication.shared.terminate(nil)
            } else {
                self?.presentPreferencesFallback()
            }
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            DispatchQueue.main.async {
                finishOnce(error)
            }
        }

        // On some systems the completion handler above is never invoked,
        // which would leave the button doing nothing. Fall back after a
        // short grace period so the user always gets a response.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            finishOnce(NSError(domain: "dev.thefndrs.nocturne", code: -1))
        }
    }

    private func presentPreferencesFallback() {
        isOpeningPreferences = false

        let alert = NSAlert()
        alert.messageText = "Safari Settings Could Not Be Opened Automatically"
        if #available(macOS 13, *) {
            alert.informativeText = "Open Safari, choose Safari > Settings > Extensions, then turn on Nocturne."
        } else {
            alert.informativeText = "Open Safari, choose Safari > Preferences > Extensions, then turn on Nocturne."
        }
        alert.addButton(withTitle: "Open Safari")
        alert.addButton(withTitle: "Cancel")

        guard alert.runModal() == .alertFirstButtonReturn else { return }

        guard let safariURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") else {
            presentSafariLaunchFailure()
            return
        }
        NSWorkspace.shared.openApplication(at: safariURL, configuration: NSWorkspace.OpenConfiguration()) { [weak self] application, error in
            DispatchQueue.main.async {
                if application != nil, error == nil {
                    NSApplication.shared.terminate(nil)
                } else {
                    self?.presentSafariLaunchFailure()
                }
            }
        }
    }

    private func presentSafariLaunchFailure() {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Safari Could Not Be Opened"
        if #available(macOS 13, *) {
            alert.informativeText = "Please open Safari manually, then choose Safari > Settings > Extensions and turn on Nocturne."
        } else {
            alert.informativeText = "Please open Safari manually, then choose Safari > Preferences > Extensions and turn on Nocturne."
        }
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

}

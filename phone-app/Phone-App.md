App: Protego (for now)
Android application (Android Studio)

The goal of this application is to prevent scam texts from reaching people's phones. The primary function isn't in the app screen / UI itself; it's in its background functionality.

Example (without app):

- Scam company sends user a text
- User clicks on link in text
- User gets scammed

With app:

- Scam company sends user a text
- Protego sees the text, and runs scam checks on it
- If deemed a scam, Protego will delete the message and send a notification "Scam message blocked! Check it out here"
- User can click it and see the message, why it was flagged, and it will send the scam to the hornet's nest via Spacetime.

Notes:

If it's not possible to delete the text, it should do anything to have it not affect the user's view / alert them that this message is scammy before the user clicks on it. Figure this out.

Solution:
Notification + Warn: Can read incoming message notifications (SMS and RCS) and dismiss them, but the message stays in the inbox.
Use a NotificationListenerService. When a message arrives, scan it. If it’s a scam, call cancelNotification() to hide the original alert and post your own high-priority “Scam message blocked!” notification, warning the user before they click. Use DNS filtering via VpnService: a local VPN that blocks known-bad domains, so the link won’t load even if tapped.

Figure out how to check whether its a scam or not using your own intelligence.
Solution:
Heuristics (free, instant): urgency words (“act now,” “account suspended”), shortened URLs (bit.ly), lookalike domains (paypa1-secure.com), unknown sender, odd short codes, and requests for gift cards, crypto, or payment.

URL reputation: Google Safe Browsing API (free tier), URLhaus, PhishTank, or VirusTotal. You can also check domain age via RDAP, since brand-new domains are a big red flag.

LLM classification: send the message (and the URL findings) to the Claude API with a prompt asking for JSON like {"is_scam": true, "confidence": 0.92, "category": "package delivery", "reasons": [...]}. The reasons field powers your “why it was flagged” screen. Only call it when the heuristics are inconclusive, to save cost.

Privacy note: you’d be sending message text to a server. Mention that in your privacy policy, or redact phone numbers and names first. Gemini Nano or ML Kit are on-device options if you want it fully private.

When explaining why its a scam, assume the user is a T-Mobole user, and show "Since you're a T-Mobile user, here are some services you have access to so you can prevent this later: ..."

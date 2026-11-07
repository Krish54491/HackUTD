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

Figure out how to check whether its a scam or not using your own intelligence.

When explaining why its a scam, assume the user is a T-Mobole user, and show "Since you're a T-Mobile user, here are some services you have access to so you can prevent this later: ..."
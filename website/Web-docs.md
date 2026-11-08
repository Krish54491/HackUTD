# Tango - Website

## Important

- Backend functions must be shared with the web extension and mobile app.
- Majority of the backend must be built on Spacetime.
- The screens below are design mockups for the planned website.
- the grey circles are palceholders, leave them as placeholders for now
- follow the mockups exactly as is to build the frontend.
- As for the languages, use React, Tailwind and typescript as the main languages
- the
  Protection settings
  Help & resources
  in the sidebar is also static, clicking it will do nothing.
- By default, the user should be signed out. adn the account should have a pink button with sign in
  - once clicked the user should automatically be logged in as the account in the screenshots. we are not setting up login or an actual database so we dont need an actual database.
- clicking tango at the top left brings user to the overview page
- clicking personal protection on the top left will do nothing.
- clicking the logo at the top left brings user to the overview page (once actual logo is in there so not in this stage)

## General

The main site is a personal protection dashboard. Users can see scams Tango has prevented, review previous scam attempts, find relevant T-Mobile services, and compare hornets defeated on a community leaderboard.

The sidebar includes Overview, T-Mobile services, Leaderboard, Protection settings, and Help & resources. A Check a website button lets users submit a URL to the shared backend and view its security report, using the same checks as the web extension.

The footer
tango.                                                                              Privacy   ·   Help center   ·   Protection settings
is static, as in clicking it will not do anything, it is just there for show. 

## Main Dashboard

Shows the user's protection activity for the selected date range:

- Total scams prevented, displayed as hornets defeated.
- Comparison with the previous period and an all-time total.
- Breakdown by scam category, such as phishing, fake scholarships, shopping scams, and impersonation.
- A log of prevented scams.
- Recommended T-Mobile services based on previous scam attempts.
- A preview of the leaderboard with the user's position highlighted.
- clicking export log downloads the log
- clicking the leaderboard leads to the leaderboards tab

Each prevented scam counts as one hornet defeated.

![Tango main dashboard with protection totals, scam history, service recommendations, and leaderboard preview](image/Web-docs/1794106735698.png)

## Scam Prevention Log

Shows the user's history of scams prevented through Tango. Each entry includes:

- Date and time.
- Attempted scam or website.
- Scam category.
- Action taken, such as blocking navigation or dismissing a scam notification.
- Outcome.

Users can search the log, filter by category and date, move between pages, and export their history. Selecting an entry should show why it was flagged and suggested steps to prevent similar attempts.

## T-Mobile Services

Shows T-Mobile services that help users prevent scams, with recommendations personalized by their previous scam attempts. Explain why each recommendation is relevant and provide a link to learn more or set it up.

The dashboard mockup includes Scam Shield, Scam ID, and Scam Block. The dedicated services mockup also explores Link Guard, Identity Watch, Family Scam Alerts, and Payment Pause. These four are proposed concepts and should be labeled as concepts rather than existing T-Mobile services, because the actual backend will have different services and clicking them or the explore conceptwill lead to actual services page (probably in backend)

![Tango T-Mobile services page with link safety, identity awareness, family alerts, and payment safety concepts](image/Web-docs/1794106761688.png)

## Hornets Defeated / Leaderboard

Ranks participating users by the number of scams prevented. Show the user's total hornets defeated and current community position, with their row highlighted.

- Support all-time, past 30 days, and past week views.
- Allow searching by alias.
- Show each user's rank, alias, and hornets defeated
- Participation is opt-in. Only the alias and score appear publicly; real names and scam history stay private.
- Users can change their alias or leave the leaderboard through privacy settings.

![Tango leaderboard showing community ranks, hornets defeated, and the user's highlighted position](image/Web-docs/1794106785550.png)

## Frontend / Non-Functional extras

- Match the mockups' pink accents, light dashboard background, cards, and sidebar navigation.
- Replace gray placeholder circles with the corresponding Tango icons or character assets.
- Keep the current user's leaderboard row visually distinct.
- Include links to privacy information, help, and protection settings.

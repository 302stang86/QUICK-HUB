# FDEC Quick Hub

Static employee hub (GitHub Pages) with Firebase for sign-in and data. Firestore security rules are in `firestore.rules`.

## SwitchBack TD (`switchback/index.html`)

A single-file tower defense game, opened from the "SwitchBack TD" card on the hub. It runs without any setup; the online leaderboard needs the three items below, done once in the Firebase console for project `fire-defense-itm-reports`. The web settings are already filled in at `FIREBASE_CONFIG` in the game file.

1. Authentication > Sign-in method > turn on Anonymous. Players never see a sign-in screen; each browser gets a private ID so the rules can limit abuse.
2. Firestore Database > Rules: publish the contents of `firestore.rules`. It carries the `leaderboard` rules, and it stops anonymous players from reading any hub data (`signedIn()` excludes anonymous sessions).
3. Firestore Database > Indexes > Composite > Add: collection `leaderboard`, fields `wave` Descending and `createdAt` Ascending. The first time the game loads, the browser console also shows a one-click link that creates it. It takes a minute or two to build; until then the menu shows "Couldn't load the leaderboard."

Behavior and limits:
- One entry per browser (document ID is the anonymous user ID). A new score replaces the old one only when it is higher.
- Names are 3 to 12 letters, numbers, spaces, dots, dashes or underscores. The menu shows the top 10.
- The browser reports the score, so the board is friendly competition. The rules cap waves at 1 to 1000 and stop lowering or deleting scores, but cannot verify a wave was really reached.
- To remove a name, delete its document in Firestore (Data > leaderboard).

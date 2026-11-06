# GitHub + Firebase setup

## 1. Keep the source and deployment material separate

The download has a `Fire-Defense-Game` source folder and a `private-deployment` folder. Only the game project belongs in the new repository. The private-deployment folder contains merged rules for your existing operational Firebase project.

The public web Firebase configuration is already copied from the `fdec-auth.js` you supplied. Do not add service-account JSON, passwords, payroll data, employee records, or the full hub ZIP to this repository.

## 2. Prepare Unity

Follow README.md to create a fresh Unity 6 LTS 2D project and import the source. Save the generated Warehouse scene. The Editor test mode is local only and is not employee authentication.

In **File > Build Profiles**, switch the active platform to **Web**, then choose **Fire Defense > Build Website**. It uses the FDEC template and writes to `docs/`. Do not upload just the C# script and expect a playable browser game; Unity must compile the WebAssembly build first.

The menu sets compression to Disabled because GitHub Pages does not let this project configure Content-Encoding response headers. Do not enable Web multithreading or add third-party packages until the baseline works on phones. Use the generated build, including its loader, framework, .wasm, .data, template modules and `.nojekyll` file.

## 3. Add the game rules to the existing Firebase project

Project: **fire-defense-itm-reports**.

1. In Firebase Console, open Firestore Database > Rules.
2. Save a copy of the currently deployed rules before replacing anything.
3. Compare the current rules to the rules you uploaded. If those have not changed, the supplied `private-deployment/firestore.merged.rules` is the complete merged file.
4. If the live rules have changed since your upload, insert only `firebase/game.rules.fragment` inside the existing `match /databases/{database}/documents` block. Keep the hub's existing `signedIn()` helper. Place the game block before the final deny-all match.
5. Validate and publish the merged rules when ready to enable the game.

**Never deploy `firebase/game-only.rules` to the existing FDEC project.** It deliberately contains only a minimal employee read rule plus game rules for isolated emulator testing. The included firebase.json points at that test rules file. Do not run `firebase deploy` from this kit against production.

The new paths are `fdGameProfiles` and `fdGameLeaderboard`. The existing `leaderboard` collection used by SwitchBack is unchanged. Employee profiles, ITM reports, time sheets and other hub rules are preserved byte-for-byte in the prepared merged rules apart from the inserted game block.

Game access requires a non-anonymous account and a `users/{uid}` document with `status: approved` and role `new`, `tech`, `temp`, `manager` or `admin`. The game does not use admin-email bypasses: an admin should have an approved profile too. Approval must be managed through the existing hub, not inside the game.

## 4. Create the leaderboard index

Firestore Database > Indexes > Composite > Add:

| Field | Order |
| --- | --- |
| room | Descending |
| score | Descending |
| elapsedMs | Ascending |

Collection ID: `fdGameLeaderboard`. Query scope: Collection.

Wait for the index to finish building. An index JSON file is included for reference; do not replace a broader production indexes file with this single-index file.

## 5. Create the GitHub repository

Suggested name: **fdec-fire-defense-game**.

GitHub Free supports Pages from a public repository. The game source/build can be public while Firestore data stays employee-restricted. Firebase rules enforce data access; public distribution cannot make the downloadable game code secret or prevent someone modifying it locally.

1. Create an empty public repository. Do not initialize a conflicting README.
2. In the actual Unity project root (with Assets, Packages and ProjectSettings), copy in this kit's README, SETUP, tests, firebase files, package.json and .gitignore.
3. Commit the source, Unity `.meta` files, generated scene, ProjectSettings, Packages manifest/lock file, and tested `docs/` build. Do not commit Unity Library, Temp or node_modules.
4. Push to the new repository.
5. In GitHub repository Settings > Pages, choose **Deploy from a branch**, branch **main**, folder **/docs**.
6. Open the Pages URL GitHub provides after the deployment finishes.

For a large build, keep individual files below GitHub's normal 100 MiB file limit and the published site below the documented Pages site size limit. This prototype is intentionally small, but check the actual Unity output before committing. No Unity cloud-build service or GitHub build action is required; compile locally.

No remote repository was created or pushed during preparation because no repository URL or GitHub connection was supplied.

## 6. Authentication and the existing FDEC hub

In Firebase Authentication > Settings > Authorized domains, add the hostname serving the game, if it is not already listed. Keep existing domains.

The browser bridge uses the same Firebase project, SDK version and named app (`fdec`) as the provided hub. If both Pages repositories are under the **same hostname**, browser auth persistence can be reused. A different hostname has a separate browser session: employees sign in again using the same existing account. No passwords, tokens or UIDs should be passed in URL parameters.

The game has existing-account email/password sign-in only. It does not offer self-registration or change employee approval. Password help remains in the existing hub. A denied or pending employee must not be able to use the game cloud collections even if they bypass the visual sign-in screen.

After testing, add the GitHub-provided game URL to an employee hub card. The hub ZIP has not been modified. A card can use a normal link; do not embed the game in an iframe, which complicates mobile input and auth storage. The Firestore gate remains the enforcement point.

## 7. Spark usage

No Cloud Functions, Cloud Storage, paid verification server or Realtime Database is required by this kit. Assets are served by Pages; Firebase handles existing-account authentication, small profile documents and the leaderboard.

Firestore's documented free quota currently includes 50,000 document reads/day, 20,000 writes/day and 1 GiB stored data. **The game shares that project quota with the employee hub.** Reads for security-rule checks and profile listeners also contribute; transaction retries can add reads.

The game reads a profile on launch, watches the employee approval document, saves at room completion/purchases/defeat, and queries only the top 20 on demand with a 60-second client cache. It does not write per shot or per frame. Keep an eye on the project's Usage page rather than assuming the Spark tier has unlimited capacity.

## 8. Test before giving employees the link

- Compile and run the generated scene in Unity with zero console errors.
- Test the web build locally over HTTP, then on the real Pages hostname.
- Sign in as approved employee, pending employee, denied employee, and a signed-out visitor.
- Verify another employee cannot read your private profile or overwrite your score.
- Complete a room, buy an upgrade, reload and verify persistence.
- Lose a run: room progress restarts; permanent credits/equipment remain.
- Open two tabs: a stale save should fail with a reload message instead of overwriting progress.
- Disconnect during a save, reconnect, and use Retry save. Do not close the tab until acknowledged.
- Test iPhone Safari and Android Chrome in landscape, plus keyboard/mouse on PC.
- Verify phone rotate, background/resume, special button and left drag work together.
- Remove employee approval during play: the gate must block the game and writes must be denied.
- Verify leaderboard order with ties and no unintended access to SwitchBack data.

This is an initial playable source implementation with placeholder 2D art. Treat the first Unity/browser/device pass as acceptance testing, not as a formality.

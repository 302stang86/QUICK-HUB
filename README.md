# Fire Defense — Warehouse Response

Unity C# source and Firebase integration kit, version 0.2.0. Website-first, single-player, landscape, isometric 2D. Restricted cloud access for approved FDEC employees. **This source kit has not been compiled in Unity and is not a playable web build yet.**

## Included gameplay

- Firefighter with generated turnout gear, helmet, air tank, hose/nozzle, and simple depth-sorted isometric sprites.
- Warehouse floor and decorative storage pallets. The pallets do not block movement.
- Auto-aiming water shots while moving, normalized keyboard movement, and left-side touch drag.
- Ember enemies and charging flame enemies starting in room 3.
- Room-by-room progression, 30 rooms by default, contact damage, health, and restart after defeat.
- Permanent credit purchases: nozzle damage/fire rate, foam burst, water cannon blast. Upgrades change nozzle color; this is an early visual treatment, not finished illustrated artwork.
- Unlimited basic hose shots, limited special charges per room, and a five-second special cooldown.
- Enemy defeat rewards 5/8 credits. Clearing a room rewards 25 + room × 5. Run death keeps credits and purchases but restarts room progress.
- Profile saves and best-run leaderboard, restricted by employee approval in Firestore.

## Quick start in Unity

1. Install Unity 6 LTS with **Web Build Support** using Unity Hub. Use a version with mobile Web support; this kit targets the Unity 6 API family, not Unity 2022/2023 mobile browser builds.
2. Create a fresh **2D** Unity project. Copy this kit's `Assets` folder into the new project's `Assets` folder. Copy the other repository files to the project root. Keep the Unity project's generated `Packages` and `ProjectSettings` folders.
3. Let Unity finish importing. Choose **Fire Defense > Create Warehouse Scene**.
4. Press Play. Editor/native builds use a separate local test profile in PlayerPrefs; Firebase is used by the browser build.
5. Change tunables on the FireDefenseGame component outside Play mode. Leave Max Rooms at or below 30 unless you also update rules and JavaScript validation. Restart a run after changing health settings.
6. In **File > Build Profiles**, switch the active platform to **Web**, then choose **Fire Defense > Build Website**. This builds into `docs/` using the FDEC web template and disables build compression for static hosting compatibility.
7. Test through an HTTP server, not a file:// URL. See SETUP.md for Firebase and hosting steps.

## Controls

- PC: WASD or arrow keys, Space for the special. Click-and-drag on the left side also works.
- Phone/tablet: drag the left portion of the screen; tap Special on the right.
- Hose aims and fires automatically while moving or standing.
- Pause is in the upper-right. Leaving the app pauses it; tap Resume when returning.
- Portrait orientation pauses combat and asks the player to rotate the device.

## Repository layout

- `Assets/FireDefense`: Unity game and Editor setup/build menu.
- `Assets/Plugins/WebGL/FDEC.jslib`: Unity-to-browser bridge.
- `Assets/WebGLTemplates/FDEC`: Firebase employee sign-in, launcher, leaderboard and browser save logic.
- `firebase/game.rules.fragment`: additive rules for the existing Firebase project.
- `firebase/game-only.rules`: **emulator-only** complete rules; do not deploy over the employee hub rules.
- `firebase/firestore.indexes.json`: leaderboard composite index.
- `tests`: ranking/input validation tests and Firestore emulator access tests.
- `docs`: build destination for GitHub Pages; initially contains only a build-required notice.

The outer package also includes `private-deployment/firestore.merged.rules`. That is your supplied hub rules with the game block added. Keep that operational file outside the public game repository. No original hub pages or employee files are included in the game source.

## Cloud model

- Existing `users/{uid}`: approval and role, read by the gate and by security rules. Game never creates or edits employee profiles.
- `fdGameProfiles/{uid}`: private nickname, credits, nozzle/foam/cannon levels, revision and save ID.
- `fdGameLeaderboard/{uid}`: one best result per employee: nickname, rooms cleared, score, active elapsed milliseconds, server timestamp.
- Ranking: rooms cleared descending, score descending, time ascending. Only approved employees can query the top 20. Time includes active combat, excludes pause/shop/loading.
- Nicknames are chosen on initial profile creation and stay fixed in this prototype. A nickname change feature is not included.
- Saves use a transaction for progress and an improved best result. Revision checks prevent stale tabs overwriting progress; save IDs make retrying the same payload idempotent.
- A failed save blocks purchases and room transitions until retry succeeds. Closing a tab before saving can lose uncommitted progress. Combat does not stream data to Firestore.

## Tests and known limits

`npm test` runs dependency-free Node tests for ranking, nickname validation, save ranges and profile defaults. `npm ci` then `npm run test:rules` runs emulator-only Firestore access tests (Java required).

See VALIDATION.md for the checks actually run. Unity compilation, WebAssembly linking, browser interaction, iOS/Android testing and production Firebase access must be verified before release. This package has not been pushed to GitHub or deployed to Firebase.

Generated character/enemy shapes are placeholder artwork. No animation rig, audio, obstacles, rescue objectives, ranged enemies, bosses, randomized room layouts, or professional illustration assets are included yet. Foam/cannon are radial bursts in this version, not separate aimable weapons. Native mobile Firebase integration is not included: native/Editor testing is local only; the Firebase bridge is for the selected website-first release.

The leaderboard and economy are client-reported friendly competition. Rules restrict access and data shape, but do not prove a run occurred or that credits were earned. This matches the selected casual leaderboard approach.

## References

- Unity browser support: https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/intro/browsercompatibility
- Unity web templates: https://docs.unity.cn/Manual/webgl-templates.html
- Firebase transactions: https://firebase.google.com/docs/firestore/manage-data/transactions
- Firestore free quota: https://firebase.google.com/docs/firestore/quotas
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

# Validation record — v0.2.0

Completed in the preparation environment:

- 7 Node tests passed: room/score/time ranking, exact ties, nickname validation, save ranges and new-player defaults.
- 7 Firestore Emulator tests passed using the full supplied hub rules plus the game fragment: employee approval, private profiles, bounded employee-only leaderboard queries, schema validation/revisions, monotonic leaderboard results, atomic profile/run saves, approval revocation and protection against cross-user writes/forged names.
- The earlier isolated game-only emulator suite also passed its original 5 tests.
- Browser bridge and test JavaScript passed Node syntax checks.
- Confirmed merged rules reconstruct the exact uploaded rules when the new game block is removed.
- Runtime generated source/assets, scene creation menu and build instructions reviewed together.

Not executed:

- Unity C# compilation or Editor Play mode (Unity and a C# compiler are not installed here).
- WebAssembly linking, loader-to-Unity callbacks, visual/rendering QA or mobile touch interaction.
- A deployed browser build, real Firebase sign-in/save or iOS/Android/PC acceptance testing.
- GitHub repository creation, push, Pages publication, index creation or production rules deployment.

Only demo-fdec-game was used for emulator testing; no production database writes were performed.

To reproduce pure model tests: npm test.
To reproduce isolated access tests: npm ci, then npm run test:rules (Java required).
To test the supplied merged rules on macOS/Linux from this project folder:
FDEC_RULES_FILE=../private-deployment/firestore.merged.rules npm run test:rules

The dev dependencies preserve the hub's Firebase 10.12.2 version for compatibility. The installed Firebase CLI dependency family reports Node 18/20/22 support in one transitive package; prefer Node 22 for reproducing the emulator tooling. Tests here passed on Node 24 despite that warning. Production browser SDK imports do not use this Node tooling.

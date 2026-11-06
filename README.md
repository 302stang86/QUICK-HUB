# FDEC Quick Hub

Employee portal hosted on GitHub Pages, with Firebase for employee sign-in and application data. The hub opens from the root `index.html`.

## Fire Defense browser game

The retired Unity source, WebGL template, build placeholder, and Unity setup documents have been removed. The replacement browser game runs from the `fire-defense/` folder and opens from the **Fire Defense** card beside **SwitchBack TD**. It requires no Unity installation or build. Keep GitHub Pages configured for the existing root folder so the employee hub stays at its current address.

The browser game uses the existing approved employee accounts and separate `fdGameProfiles` and `fdGameLeaderboard` collections. `firebase/game.rules.fragment` contains the game rules to merge into the full operational rules. `firebase/firestore.indexes.json` defines its leaderboard index. Neither file deploys automatically or replaces existing live rules.

## Firestore emulator tests

The game access tests are retained in `tests/rules.test.mjs`. With Node.js, Java, and the development dependencies installed, run:

```sh
npm ci
npm test
```

The test command starts an isolated `demo-fdec-game` Firestore emulator using `firebase.emulator.json`. `firebase/game-only.rules` is a test-only ruleset; never deploy it over the employee hub's full production rules. There is deliberately no default `firebase.json` in this repository.

## Existing games

SwitchBack remains in `switchback/index.html`. Its separate public, anonymous leaderboard is unchanged. Tank Battle and Gladiator Duel retain their existing root-level game files. Removing the Unity files does not change these applications, employee records, or deployed Firebase rules.

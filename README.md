# Fire Defense Battle Royal — iPhone-first prototype

## Play
Host the contents of `dist/` on an HTTPS static host, or extract the downloadable ZIP and open `index.html` to try local practice. Keep the supplied files together. No dependencies or asset downloads are needed. Home Screen installation and offline caching need HTTPS hosting, not a local file URL.

## Adaptive layout
- Portrait lobby: large mode cards, 1v1/2v2 selector, fixed Start Practice button and bottom navigation.
- Landscape arenas: safe-area-aware HUD and controls, no page scrolling or gesture-driven zoom inside the game.
- On narrow portrait screens, a rotate prompt covers the arena. Rotating to portrait during a round pauses it; resume explicitly after turning sideways. If rotation is locked on iPhone, disable Portrait Orientation Lock in Control Center.
- Browser orientation-lock and screen-wake-lock APIs are used only when available. Unsupported or denied requests do not block play. No haptics support is promised.

## Touch controls
Tank Battle: left stick moves, right stick aims and fires while dragged away from center. The two sticks track independent pointers; release/cancel stops the corresponding action.
Gladiator Duel: left stick moves; right-hand buttons strike, hold block, dodge and heavy attack. Facing assists toward the nearest living enemy for touch play. Heavy attacks and dodges use stamina. Desktop keyboard/mouse fallback remains available (WASD/arrows, click, Shift block, Space tank fire/gladiator dodge, E heavy, P pause).

## Both match formats
1v1 practice has one bot opponent. 2v2 practice has a bot teammate and two bot opponents, shared team health display, elimination, no friendly fire and team results. An eliminated player watches their surviving teammate. Time-limit ties draw; otherwise the team with more remaining health wins.

## PWA
Safari > Share > Add to Home Screen. The manifest uses adaptive (`any`) orientation and standalone display. PNG icons and Apple metadata are included. A service worker caches only known game assets; HTML must contain the app marker and non-redirected successful response, so sign-in gates are not stored as the game. Offline practice is available only after required pages/assets have been successfully visited/cached. On the private hosted preview, initial access still requires the owner's ChatGPT sign-in.

## Not connected
Live iPhone-versus-iPhone play, Firebase registration, profiles, friends, queues, ready checks, disconnect handling, upgrades and competitive points are not implemented. These actions explain their pending state. No passwords are collected and no competitive progress is awarded. Guest practice exists for prototype review. Production registered-player gating remains the next stage.

## Checks
`node tests/combat.cjs` — cover, cooldowns, projectiles, melee, block, stamina, dodges, collisions and result handling.
`node tests/teams.cjs` — team rosters, elimination, surviving ally, results, no friendly fire.
`node tests/touch.cjs` — independently held pointers, cancellation, release and pause input cleanup.

Responsive UI was checked in Chromium at 393×852 and 852×393. Physical iPhone Safari/PWA installation, wake lock and offline behavior still need device testing. No real-device or live-network test is claimed.

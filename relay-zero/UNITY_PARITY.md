# Web release 3.3 — Unity presentation parity

The existing Babylon.js website now follows the Unity port's menu, HUD, typography and rounded procedural models. Reference: `relay-zero-unity` in GitHub `sseung973/Codex`, commit `9526212`.

- Port the Unity 1280 × 720 menu and HUD arrangement, Korean labels, Noto Sans Korean and Barlow Condensed fonts. Keep browser fullscreen/audio controls and existing online room flows.
- Round world, robot, commander, remote-player and weapon render meshes. Share identical GPU geometry; retain original collision and picking meshes so visual rounding cannot change combat hitboxes.
- Use assault robots as respawning practice targets and place them on reachable, unobstructed navigation cells.
- Match normal ADS crosshair and sniper scope behavior; compensate weapon projection for camera FOV changes without a second render pass.
- Cancel outgoing reloads on primary replacement, fix waypoint height/gravity handling, wrap network yaw, and synchronize broken shield visuals.
- Keep removed explosive power cells and E-operated doors/deployable cover removed. Mission interactions and ordinary static cover remain.

This is a browser implementation of the Unity presentation, not a Unity WebGL binary. Both versions currently use procedural models; no Asset Store packs were downloaded or applied. Font licenses are included in `public/fonts`.

Validation: 88 automated tests passed, including six parity regressions; production TypeScript/Vite build passed. NullEngine CPU benchmark completed with 0, 4 and 12 bots. These checks do not establish GPU frame rate or pixel equality. Interactive browser/Unity screenshot comparison was unavailable in this environment and remains unverified.

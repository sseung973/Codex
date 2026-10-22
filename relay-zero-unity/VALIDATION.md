# Validation — 2026-10-22

## Executed in this environment

1. All runtime C# sources compiled with Roslyn 4.11 (`csc` from .NET SDK 8.0.426), C# 9, real UnityEngine.Modules 2021.3.33 and UnityEngine.UI 2018.3.5.1 reference assemblies. No compile errors. Validation references and compiler downloads are not shipped in the project. This does not validate Unity 6's actual import, native runtime or shaders.
2. `Rules.cs` + `Tests/Program.cs`: **62 checks passed**. Covers reload conservation, upgrades, all four difficulties through five waves, intermission and reinforcement totals, objectives, endless continuation, replay/rate rejection, slab hits and exported geometry.
3. Existing `relay-zero/server/rooms.test.mjs`: **3 tests passed**.
4. The actual C# `RoomSocket` class from `RoomSocket.cs` was compiled unchanged and run as a .NET console integration harness against the local, unmodified Node room server. **Duel and co-op both passed** with two real ClientWebSocket peers. Covers the Origin header accepted by the existing server, create/join, ready, the loaded/start barrier, begin, pose, shot, a complete state packet and damage events. This does not exercise the Unity game loop, Unity's JsonUtility or a browser opponent.
5. After removing explosive power cells and E-operated temporary barriers/cover from the web version, `npm run build` passed and all **82 web tests passed**. Removed feature tests were replaced by preserved objective/spawn route checks, while batching and minimap tests retain their remaining coverage.
6. The Unity data export was regenerated after device removal. No power-cell, barrier or control meshes/signs/data are included. Ordinary map cover, EMP, robot explosions, objective terminals and co-op revival remain.

## Requires a licensed Unity Editor

- Open the project with Unity 6 LTS, run `RELAY ZERO → Validate Exported Content`, then `Run Play Mode Smoke Check`.
- Playthrough on every map/difficulty; player and AI collision on ramps; frame pacing; visual quality; weapon handling; font import; generated shader compilation.
- Build Windows, macOS or Linux and run the executable.
- End-to-end two Unity clients and Unity↔web 1vs1/co-op with damage, respawn, shields, revival and disconnects over the hosted Render service.

Unity Editor is not installed here. These checks are pending; no executable build or gameplay screenshot is represented as verified.

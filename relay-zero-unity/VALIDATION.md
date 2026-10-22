# Validation — 2026-10-22

## Unity bug-fix update (`3.2.0-unity.2`)

Executed for this update:

- Recompiled all 13 runtime C# files against the real Unity reference assemblies described below: no errors. Parsed all 16 runtime/Editor C# sources with Roslyn C# 9: no syntax errors. Editor API compilation remains pending.
- Independent game rules/content: **62 checks passed**.
- `python Tests/audit_presentation.py`: **18 models, 21,780 triangles, 809 runtime string literals, 8 alpha PNGs, 3 shader resource paths and 57 unique asset GUIDs passed**. Checks finite geometry, normalized normals, valid indices, non-degenerate/outward triangles and font table coverage. This is a static asset audit, not an image or shader execution test.
- Room server: **3 tests passed**. The unchanged native `RoomSocket` transport passed real two-client **duel and co-op** exchanges against the local room server again. Unity `OnlineSession` gameplay and JsonUtility are not executed by this console test.
- Built and unpacked the code-only `Updates/RelayZero-Fixes.unitypackage`; each packaged source and asset GUID was verified against its repository file. It includes 19 C#/shader assets and does not change project settings or import Store art. The archive structure was verified here; importing it into Unity is pending.

Expanded `RELAY ZERO → Run Play Mode Smoke Check` now covers Korean/symbol font coverage across all UI pages, slider geometry, safe target cells on all maps, world text shader availability, native hitscan/shields, commander role isolation and fixed warning position, exposed weak points, shop reload cancellation, prefab fitting under parent rotation, and Unity-serialized online state/removed replicas/broken shield/peer heartbeat/rejoin reset. **These Editor checks are provided but have not been executed in this environment.**

The user reported that the previous project opened and ran in Unity 6.3 LTS. This does not establish that this update's rendering, gameplay or builds have passed in that Editor. See [patch installation and remaining validation](Updates/README.md).

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

## Asset Store visual integration update

The runtime includes optional visual prefab mappings, visual-only prefab admission checks, preserved gameplay colliders/hit zones, and cached rounded render meshes. Runtime source was compiled against real Unity reference assemblies. Editor preparation, generic URP/HDRP-to-Standard material copies, mesh smoke checks and prefab alignment still require Unity Editor. No Asset Store package has been acquired, imported, installed or visually verified in this environment. See ASSET_STORE_SETUP.md for the checked free candidates.

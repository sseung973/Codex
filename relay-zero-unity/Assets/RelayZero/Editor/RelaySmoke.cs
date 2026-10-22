using System;
using System.Reflection;
using UnityEditor;
using UnityEngine;

namespace RelayZero.Editor
{
    // Runs in an installed Unity Editor; it is not a substitute for a full playthrough.
    [InitializeOnLoad]
    public static class RelaySmoke
    {
        const string Key = "relay-zero-smoke-pending";
        static double deadline;
        static int stage;
        static RelaySmoke()
        {
            EditorApplication.update += Tick;
        }

        [MenuItem("RELAY ZERO/Run Play Mode Smoke Check")]
        public static void Run()
        {
            if (EditorApplication.isPlaying)
            {
                Debug.LogWarning("Stop Play Mode before starting the smoke check.");
                return;
            }

            RelayBuild.Open();
            stage = 0;
            deadline = EditorApplication.timeSinceStartup + 30;
            SessionState.SetBool(Key, true);
            EditorApplication.isPlaying = true;
        }

        static void Require(bool ok, string message)
        {
            if (!ok)
                throw new Exception("RELAY ZERO smoke: " + message);
        }

        static void CheckVisualMeshes()
        {
            var source = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var parent = new GameObject("Visual smoke target");
            parent.transform.position = new Vector3(80, 80, 80);
            Mesh softened = null;
            try
            {
                var mesh = source.GetComponent<MeshFilter>().sharedMesh;
                var before = mesh.vertices;
                softened = SoftMesh.Create(mesh, .06f);
                Require(softened != mesh && softened.vertexCount > mesh.vertexCount, "box receives real rounded render geometry");
                Require((softened.bounds.min - mesh.bounds.min).sqrMagnitude < .000001f && (softened.bounds.max - mesh.bounds.max).sqrMagnitude < .000001f, "rounded bounds preserve gameplay footprint");
                var vertices = softened.vertices;
                var normals = softened.normals;
                var indices = softened.triangles;
                for (int i = 0; i < vertices.Length; i++)
                    Require(Mathf.Abs(normals[i].magnitude - 1) < .001f, "rounded normals remain normalized");
                for (int i = 0; i < indices.Length; i += 3)
                    Require(Vector3.Cross(vertices[indices[i + 1]] - vertices[indices[i]], vertices[indices[i + 2]] - vertices[indices[i]]).sqrMagnitude > 1e-12f, "rounded triangles are non-degenerate");
                Require(mesh.vertices.Length == before.Length && mesh.vertices[0] == before[0], "source collision mesh is unchanged");
                var entry = new VisualReplacement
                {
                    key = "smoke",
                    prefab = source
                };
                var art = VisualOverrides.Attach(entry, parent.transform, new Bounds(Vector3.up, Vector3.one * 2), 0);
                Require(art, "a visual-only prefab can be attached");
                foreach (var collider in art.GetComponentsInChildren<Collider>(true))
                    Require(!collider.enabled, "imported art does not add gameplay collisions");
                var firstScale = art.transform.GetChild(0).localScale;
                parent.transform.rotation = Quaternion.Euler(26, 47, 13);
                var rotated = VisualOverrides.Attach(entry, parent.transform, new Bounds(Vector3.up, Vector3.one * 2), 0);
                Require((rotated.transform.GetChild(0).localScale - firstScale).sqrMagnitude < .00001f, "imported model fitting is independent of camera or bot rotation");
            }
            finally
            {
                if (softened && softened != source.GetComponent<MeshFilter>().sharedMesh)
                    UnityEngine.Object.Destroy(softened);
                UnityEngine.Object.Destroy(source);
                UnityEngine.Object.Destroy(parent);
            }
        }

        static void CheckUI(RelayGame game)
        {
            game.UI.Toast("한글 알림 · 목표를 점령해");
            game.UI.Hit(true, true);
            game.UI.Damage(game.Player.Feet + Vector3.forward, 12);
            game.UI.Paint();
            var canvas = UnityEngine.Object.FindObjectOfType<Canvas>();
            Require(canvas, "HUD canvas exists");
            foreach (var label in canvas.GetComponentsInChildren<UnityEngine.UI.Text>(true))
                Require(Data.Supports(label.font, label.text), "font covers every glyph: " + label.text);
            foreach (var slider in canvas.GetComponentsInChildren<UnityEngine.UI.Slider>(true))
            {
                Require(slider.fillRect.sizeDelta.sqrMagnitude < .00001f, "slider fill has no additive width or height");
                Require(slider.handleRect.pivot == new Vector2(.5f, .5f), "slider handle pivots at its center");
            }
            game.UI.ResetFeedback();
        }

        static void CheckCombat(RelayGame game)
        {
            var defender = game.CreateBot("smoke-defender", "defender", new Vector3(0, 0, -9), 1);
            float hp = defender.Health;
            defender.Hit(120, false, true, false, 0);
            Require(defender.Health == hp && defender.Shield == 0, "shield damage does not drain robot health");
            foreach (var z in defender.GetComponentsInChildren<HitZone>(true))
                if (z.Shield || z.name.Contains("shield"))
                    Require(!z.gameObject.activeSelf, "all broken shield surfaces disappear");
            var commander = game.CreateBot("smoke-commander", "support", new Vector3(5, 0, -9), 5, false, true);
            Require(commander.Role == "commander", "commander does not inherit a regular robot role");
            var field = typeof(Bot).GetField("warning", BindingFlags.Instance | BindingFlags.NonPublic);
            var warning = (LineRenderer)field.GetValue(commander);
            warning.transform.position = new Vector3(0, .1f, -7);
            Vector3 locked = warning.transform.position;
            commander.transform.position += Vector3.right * 3;
            commander.transform.rotation = Quaternion.Euler(0, 75, 0);
            Require((warning.transform.position - locked).sqrMagnitude < .00001f, "boss warning remains at its fixed world location");
            commander.WeakWindow = 1;
            commander.Tick(.01f);
            bool exposed = false;
            foreach (var z in commander.GetComponentsInChildren<HitZone>(true))
                if (z.Weak)
                    exposed |= z.gameObject.activeSelf;
            Require(exposed, "commander weak point becomes visible");

            game.Guns.Equip("ar7");
            var old = game.Guns.Current;
            old.Ammo = 1;
            old.StartReload();
            game.Guns.Equip("s24");
            Require(old.Reload == 0 && game.Guns.Current.Spec.id == "s24", "shop replacement cancels the former weapon reload");
        }

        static void CheckMap(RelayGame game)
        {
            Require(game.Bots.Count == 3, "three practice targets on " + game.MapId);
            foreach (var bot in game.Bots)
            {
                Physics.SyncTransforms();
                var p = bot.transform.position;
                Require(!Physics.Raycast(p + Vector3.up * 7, Vector3.down, 6.7f, Geometry.WorldMask), "practice target occupies an unblocked navigation cell");
            }
            foreach (var sign in game.World.GetComponentsInChildren<WorldSign>())
            {
                var renderer = sign.GetComponent<Renderer>();
                Require(renderer.sharedMaterial.shader.name == "RelayZero/WorldText" && renderer.sharedMaterial.shader.isSupported, "world text uses its supported depth-tested shader");
                Require(sign.transform.localScale.x > 0 && sign.transform.localScale.x < 10, "world text has a finite fitted scale");
            }
            CheckUI(game);
        }

        static void CheckOnlineState(RelayGame game)
        {
            var session = new OnlineSession(game) { Active = true, Host = false };
            var apply = typeof(OnlineSession).GetMethod("Apply", BindingFlags.Instance | BindingFlags.NonPublic);
            var receive = typeof(OnlineSession).GetMethod("Message", BindingFlags.Instance | BindingFlags.NonPublic);
            var peerClock = typeof(OnlineSession).GetField("lastMessage", BindingFlags.Instance | BindingFlags.NonPublic);
            try
            {
                var state = new NetState
                {
                    hp = new[] { 100f, 100f }, scores = new int[2], epochs = new int[2],
                    respawn = new float[2], protect = new float[2], wave = 1,
                    enemies = new[] { new NetBot { id = "smoke-replica", role = "defender", p = new[] { 0f, 0f, -9f }, hp = 50, max = 100, shield = 0 } }
                };
                // Exercise Unity's actual serializer, not a substitute JSON library.
                var decoded = JsonUtility.FromJson<NetState>(JsonUtility.ToJson(state));
                apply.Invoke(session, new object[] { decoded });
                Require(game.Bots.Count == 1 && game.Bots[0].Health == 50, "co-op state reconstructs a robot through JsonUtility");
                foreach (var z in game.Bots[0].GetComponentsInChildren<HitZone>(true))
                    if (z.Shield || z.name.Contains("shield"))
                        Require(!z.gameObject.activeSelf, "guest sees every broken shield part hidden");
                state.enemies = Array.Empty<NetBot>();
                apply.Invoke(session, new object[] { state });
                Require(game.Bots.Count == 0, "guest removes robots absent from the host state");

                peerClock.SetValue(session, -10f);
                receive.Invoke(session, new object[] { new NetMessage { type = "pong", time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() } });
                Require((float)peerClock.GetValue(session) == -10f, "server heartbeat cannot hide a silent peer");
                receive.Invoke(session, new object[] { new NetMessage { type = "pose", p = new[] { 2f, 0f, 18f } } });
                Require((float)peerClock.GetValue(session) >= 0, "peer pose refreshes peer activity");
                session.Ready = true;
                session.Roster = "old roster";
                session.Leave();
                Require(!session.Ready && session.Host && session.Roster == "", "leaving a room resets readiness, role and roster");
            }
            finally
            {
                session.Leave();
                game.ClearBots();
            }
        }

        static void Tick()
        {
            if (!SessionState.GetBool(Key, false))
                return;
            if (EditorApplication.isPlayingOrWillChangePlaymode && !EditorApplication.isPlaying)
                return;
            if (!EditorApplication.isPlaying)
            {
                stage = 0;
                deadline = EditorApplication.timeSinceStartup + 30;
                return;
            }

            try
            {
                var g = RelayGame.Instance;
                if (!g)
                {
                    if (deadline == 0)
                        deadline = EditorApplication.timeSinceStartup + 30;
                    if (EditorApplication.timeSinceStartup > deadline)
                        throw new Exception("Runtime bootstrap did not initialize");
                    return;
                }

                if (stage == 0)
                {
                    Require(g.Arena != null && g.UI != null && g.Player != null, "runtime, arena and UI exist");
                    g.LoadArena("foundry");
                    g.StartRun(true);
                    stage = 1;
                    deadline = EditorApplication.timeSinceStartup + .25;
                    return;
                }

                if (EditorApplication.timeSinceStartup < deadline)
                    return;
                if (stage == 1)
                {
                    CheckVisualMeshes();
                    CheckMap(g);
                    Physics.SyncTransforms();
                    Require(g.Bots.Count == 3, "three practice targets");
                    Require(Physics.Raycast(new Vector3(0, 2, -17), Vector3.down, 3, Geometry.WorldMask), "floor collision");
                    var b = g.Bots[0];
                    var ray = b.Eye - new Vector3(0, 0, 2);
                    float hp = b.Health;
                    g.Shoot(ray, Vector3.forward, Data.Weapon("p12"), false, 0);
                    Require(b.Health < hp, "native hitscan applies damage");
                    CheckCombat(g);
                    CheckOnlineState(g);
                    g.Pause();
                    Require(g.Paused && !g.Controls, "solo pause disables controls");
                    g.Resume();
                    g.Menu();
                    g.LoadArena("cargo");
                    g.StartRun(true);
                    stage = 2;
                    deadline = EditorApplication.timeSinceStartup + .2;
                    return;
                }

                if (stage == 2)
                {
                    Require(g.Arena.id == "cargo" && g.Navigation.Reachable(Data.V(g.Arena.spawn)).Count > 20, "cargo arena navigation");
                    CheckMap(g);
                    g.LoadArena("nexus");
                    g.StartRun(true);
                    stage = 3;
                    deadline = EditorApplication.timeSinceStartup + .2;
                    return;
                }

                Require(g.Arena.id == "nexus" && g.Arena.mission.Length == 2, "nexus objective anchors");
                CheckMap(g);
                g.Menu();
                SessionState.SetBool(Key, false);
                Debug.Log("RELAY ZERO Unity Play Mode smoke passed: three arenas, spawn clearance, Korean/symbol glyphs, sliders, world signs, hitscan, shields, commander role/warning/weak point, shop reload cancellation, pause, rounded geometry and prefab fitting under rotation.");
                EditorApplication.isPlaying = false;
            }
            catch (Exception e)
            {
                SessionState.SetBool(Key, false);
                Debug.LogException(e);
                EditorApplication.isPlaying = false;
            }
        }
    }
}

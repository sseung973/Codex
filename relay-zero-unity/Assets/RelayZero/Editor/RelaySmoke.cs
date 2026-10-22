using System;
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
            SessionState.SetBool(Key, true);
            EditorApplication.isPlaying = true;
        }

        static void Require(bool ok, string message)
        {
            if (!ok)
                throw new Exception("RELAY ZERO smoke: " + message);
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
                    Physics.SyncTransforms();
                    Require(g.Bots.Count == 3, "three practice targets");
                    Require(Physics.Raycast(new Vector3(0, 2, -17), Vector3.down, 3, Geometry.WorldMask), "floor collision");
                    var b = g.Bots[0];
                    var ray = b.Eye - new Vector3(0, 0, 2);
                    float hp = b.Health;
                    g.Shoot(ray, Vector3.forward, Data.Weapon("p12"), false, 0);
                    Require(b.Health < hp, "native hitscan applies damage");
                    g.Pause();
                    Require(g.Paused && !g.Controls, "solo pause disables controls");
                    g.Resume();
                    g.Menu();
                    g.LoadArena("cargo");
                    stage = 2;
                    deadline = EditorApplication.timeSinceStartup + .2;
                    return;
                }

                if (stage == 2)
                {
                    Require(g.Arena.id == "cargo" && g.Navigation.Reachable(Data.V(g.Arena.spawn)).Count > 20, "cargo arena navigation");
                    g.LoadArena("nexus");
                    stage = 3;
                    deadline = EditorApplication.timeSinceStartup + .2;
                    return;
                }

                Require(g.Arena.id == "nexus" && g.Arena.mission.Length == 2, "nexus objective anchors");
                g.Menu();
                SessionState.SetBool(Key, false);
                Debug.Log("RELAY ZERO Unity Play Mode smoke passed: bootstrap, three maps, practice, floor collision, hitscan and pause/resume.");
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

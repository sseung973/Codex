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
            }
            finally
            {
                if (softened && softened != source.GetComponent<MeshFilter>().sharedMesh)
                    UnityEngine.Object.Destroy(softened);
                UnityEngine.Object.Destroy(source);
                UnityEngine.Object.Destroy(parent);
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
                Debug.Log("RELAY ZERO Unity Play Mode smoke passed: bootstrap, three maps, practice, floor collision, hitscan, pause/resume, rounded geometry and visual-only collision separation.");
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

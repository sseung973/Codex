using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace RelayZero
{
    public static class Geometry
    {
        public const int WorldLayer = 8, TargetLayer = 9, ViewLayer = 10, BotLayer = 11, PlayerLayer = 12;
        public const int WorldMask = 1 << WorldLayer, ShotMask = WorldMask | (1 << TargetLayer);
        class Template
        {
            public ModelData Data;
            public Mesh[] Meshes;
            public Mesh[] RenderMeshes;
            public Material[] Materials;
        }

        static readonly Dictionary<string, Template> Cache = new Dictionary<string, Template>();
        static Template Load(string name)
        {
            Template t;
            if (Cache.TryGetValue(name, out t))
                return t;
            t = new Template
            {
                Data = Data.Read<ModelData>(name)
            };
            t.Meshes = new Mesh[t.Data.parts.Length];
            t.RenderMeshes = new Mesh[t.Data.parts.Length];
            t.Materials = new Material[t.Data.materials.Length];
            for (int i = 0; i < t.Materials.Length; i++)
            {
                var s = t.Data.materials[i];
                var m = new Material(Resources.Load<Shader>(s.unlit ? "RelayUnlit" : "RelaySurface"));
                m.name = s.name;
                m.color = Data.C(s.unlit ? s.emission : s.color);
                if (!s.unlit)
                {
                    m.SetColor("_EmissionColor", Data.C(s.emission));
                    m.SetFloat("_Metallic", s.metallic);
                    m.SetFloat("_Glossiness", 1 - s.roughness);
                }

                t.Materials[i] = m;
            }

            for (int i = 0; i < t.Meshes.Length; i++)
            {
                var p = t.Data.parts[i];
                var v = new Vector3[p.vertices.Length / 3];
                var n = new Vector3[v.Length];
                for (int j = 0; j < v.Length; j++)
                {
                    v[j] = new Vector3(p.vertices[j * 3], p.vertices[j * 3 + 1], p.vertices[j * 3 + 2]);
                    if (p.normals.Length == p.vertices.Length)
                        n[j] = new Vector3(p.normals[j * 3], p.normals[j * 3 + 1], p.normals[j * 3 + 2]);
                }

                var mesh = new Mesh
                {
                    name = p.name,
                    indexFormat = IndexFormat.UInt32
                };
                mesh.vertices = v;
                mesh.triangles = p.triangles;
                if (p.normals.Length == p.vertices.Length)
                    mesh.normals = n;
                else
                    mesh.RecalculateNormals();
                mesh.RecalculateBounds();
                t.Meshes[i] = mesh;
                float radius = name.StartsWith("weapon-") ? .018f : name.StartsWith("robot-") || name.StartsWith("operative-") ? .045f : .06f;
                t.RenderMeshes[i] = VisualOverrides.Soften ? SoftMesh.Create(mesh, radius) : mesh;
            }

            Cache[name] = t;
            return t;
        }

        public static GameObject Model(string name, Transform parent, bool targets = false)
        {
            var t = Load(name);
            var root = new GameObject(name);
            if (parent)
                root.transform.SetParent(parent, false);
            for (int i = 0; i < t.Data.parts.Length; i++)
            {
                var p = t.Data.parts[i];
                var go = new GameObject(p.name);
                go.transform.SetParent(root.transform, false);
                go.layer = targets ? TargetLayer : name.StartsWith("weapon-") ? ViewLayer : 0;
                var filter = go.AddComponent<MeshFilter>();
                filter.sharedMesh = t.RenderMeshes[i];
                var renderer = go.AddComponent<MeshRenderer>();
                renderer.sharedMaterial = t.Materials[p.material];
                renderer.shadowCastingMode = targets ? ShadowCastingMode.On : ShadowCastingMode.Off;
                go.SetActive(p.enabled);
                if (targets)
                {
                    var b = go.AddComponent<BoxCollider>();
                    b.center = t.Meshes[i].bounds.center;
                    b.size = t.Meshes[i].bounds.size;
                    b.isTrigger = true;
                    var zone = go.AddComponent<HitZone>();
                    zone.Head = p.head;
                    zone.Shield = p.shield;
                    zone.Weak = p.weakpoint;
                }
            }

            var profile = VisualOverrides.Current;
            var entry = profile ? VisualOverrides.Find(profile.models, name) : null;
            if (entry != null)
            {
                Bounds bounds = new Bounds();
                bool first = true;
                foreach (var mesh in t.Meshes)
                {
                    if (first)
                    {
                        bounds = mesh.bounds;
                        first = false;
                    }
                    else
                        bounds.Encapsulate(mesh.bounds);
                }

                var art = VisualOverrides.Attach(entry, root.transform, bounds, targets ? 0 : name.StartsWith("weapon-") ? ViewLayer : 0);
                if (art)
                {
                    for (int i = 0; i < t.Data.parts.Length; i++)
                    {
                        var p = t.Data.parts[i];
                        if (p.shield || p.weakpoint || p.name.Contains("shield"))
                            continue;
                        root.transform.GetChild(i).GetComponent<Renderer>().enabled = false;
                    }
                }
            }

            return root;
        }

        public static GameObject Arena(string name)
        {
            var t = Load(name);
            var root = new GameObject("Arena / " + name);
            var owned = root.AddComponent<RuntimeOwnedAssets>();
            var combine = new Dictionary<int, List<CombineInstance>>();
            for (int i = 0; i < t.Data.parts.Length; i++)
            {
                var p = t.Data.parts[i];
                bool replacement = false;
                var profile = VisualOverrides.Current;
                if (p.visible && p.enabled && profile)
                {
                    var entry = VisualOverrides.Find(profile.environment, p.name, name);
                    replacement = VisualOverrides.Attach(entry, root.transform, t.Meshes[i].bounds, 0);
                }

                if (p.visible && p.enabled && !replacement)
                {
                    if (!combine.ContainsKey(p.material))
                        combine[p.material] = new List<CombineInstance>();
                    combine[p.material].Add(new CombineInstance { mesh = t.RenderMeshes[i], transform = Matrix4x4.identity });
                }

                if (p.solid && p.enabled)
                {
                    var go = new GameObject(p.name + " / collider");
                    go.layer = WorldLayer;
                    go.transform.SetParent(root.transform, false);
                    go.AddComponent<MeshCollider>().sharedMesh = t.Meshes[i];
                }
            }

            foreach (var pair in combine)
            {
                var go = new GameObject("Batched / " + t.Data.materials[pair.Key].name);
                go.transform.SetParent(root.transform, false);
                go.layer = WorldLayer;
                var m = new Mesh
                {
                    name = go.name,
                    indexFormat = IndexFormat.UInt32
                };
                m.CombineMeshes(pair.Value.ToArray(), true, true);
                owned.Assets.Add(m);
                go.AddComponent<MeshFilter>().sharedMesh = m;
                go.AddComponent<MeshRenderer>().sharedMaterial = t.Materials[pair.Key];
                go.isStatic = true;
            }

            return root;
        }

        public static GameObject Box(string name, Vector3 position, Vector3 size, Color color, Transform parent, bool solid = true, bool glow = false)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
            g.name = name;
            g.transform.SetParent(parent, false);
            g.transform.localPosition = position;
            g.transform.localScale = size;
            g.layer = solid ? WorldLayer : 0;
            var m = new Material(Resources.Load<Shader>(glow ? "RelayUnlit" : "RelaySurface"));
            m.color = color;
            g.GetComponent<Renderer>().sharedMaterial = m;
            g.AddComponent<RuntimeOwnedAssets>().Assets.Add(m);
            var c = g.GetComponent<Collider>();
            if (!solid)
                UnityEngine.Object.Destroy(c);
            return g;
        }

        public static bool Clear(Vector3 a, Vector3 b)
        {
            Vector3 d = b - a;
            return !Physics.Raycast(a, d.normalized, d.magnitude - .02f, WorldMask, QueryTriggerInteraction.Ignore);
        }

        public static void ClearCache()
        {
            foreach (var t in Cache.Values)
            {
                for (int i = 0; i < t.Meshes.Length; i++)
                {
                    if (t.RenderMeshes[i] != t.Meshes[i])
                        UnityEngine.Object.Destroy(t.RenderMeshes[i]);
                    UnityEngine.Object.Destroy(t.Meshes[i]);
                }

                foreach (var m in t.Materials)
                    UnityEngine.Object.Destroy(m);
            }

            Cache.Clear();
        }
    }

    public class RuntimeOwnedAssets : MonoBehaviour
    {
        public readonly List<UnityEngine.Object> Assets = new List<UnityEngine.Object>();
        void OnDestroy()
        {
            foreach (var asset in Assets)
                if (asset)
                    Destroy(asset);
        }
    }

    public class HitZone : MonoBehaviour
    {
        public Bot Bot;
        public bool Head, Shield, Weak;
    }

    public class GridNavigation
    {
        readonly bool[] blocked = new bool[441];
        public GridNavigation()
        {
            Rebuild();
        }

        public void Rebuild()
        {
            Physics.SyncTransforms();
            for (int k = 0; k < 441; k++)
                blocked[k] = Physics.Raycast(World(k) + Vector3.up * 7, Vector3.down, 6.7f, Geometry.WorldMask, QueryTriggerInteraction.Ignore);
        }

        public Vector3 World(int k)
        {
            return new Vector3((k % 21 - 10) * 2, 0, (k / 21 - 10) * 2);
        }

        public int Cell(Vector3 p)
        {
            return Mathf.Clamp(Mathf.RoundToInt(p.z / 2) + 10, 0, 20) * 21 + Mathf.Clamp(Mathf.RoundToInt(p.x / 2) + 10, 0, 20);
        }

        IEnumerable<int> Neighbors(int k)
        {
            int x = k % 21, z = k / 21;
            if (x > 0)
                yield return k - 1;
            if (x < 20)
                yield return k + 1;
            if (z > 0)
                yield return k - 21;
            if (z < 20)
                yield return k + 21;
        }

        public HashSet<int> Reachable(Vector3 start)
        {
            var result = new HashSet<int>
            {
                Cell(start)
            };
            var queue = new Queue<int>(result);
            while (queue.Count > 0)
            {
                int k = queue.Dequeue();
                foreach (int n in Neighbors(k))
                    if (!blocked[n] && result.Add(n))
                        queue.Enqueue(n);
            }

            return result;
        }

        public List<Vector3> Route(Vector3 from, Vector3 to)
        {
            int start = Cell(from), target = Cell(to);
            if (blocked[target])
            {
                float best = float.PositiveInfinity;
                for (int i = 0; i < 441; i++)
                    if (!blocked[i] && (World(i) - to).sqrMagnitude < best)
                    {
                        best = (World(i) - to).sqrMagnitude;
                        target = i;
                    }
            }

            var queue = new Queue<int>();
            var came = new int[441];
            for (int i = 0; i < 441; i++)
                came[i] = -1;
            queue.Enqueue(start);
            came[start] = start;
            while (queue.Count > 0)
            {
                int k = queue.Dequeue();
                if (k == target)
                {
                    var path = new List<Vector3>();
                    while (k != start)
                    {
                        path.Add(World(k));
                        k = came[k];
                    }

                    path.Reverse();
                    return path;
                }

                foreach (int n in Neighbors(k))
                    if (!blocked[n] && came[n] < 0)
                    {
                        came[n] = k;
                        queue.Enqueue(n);
                    }
            }

            return new List<Vector3>();
        }

        public Vector3 Spawn(Vector3 preferred, Vector3 player, List<Bot> bots, Vector3? other = null)
        {
            float best = float.PositiveInfinity;
            Vector3 result = preferred;
            foreach (int k in Reachable(player))
            {
                var p = World(k);
                if ((p - player).sqrMagnitude < 64 || (other.HasValue && (p - other.Value).sqrMagnitude < 64))
                    continue;
                bool crowd = false;
                foreach (var bot in bots)
                    if (bot.Alive && (bot.transform.position - p).sqrMagnitude < 3)
                    {
                        crowd = true;
                        break;
                    }

                float d = (p - preferred).sqrMagnitude;
                if (!crowd && d < best)
                {
                    best = d;
                    result = p;
                }
            }

            return result;
        }
    }
}

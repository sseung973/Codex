using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace RelayZero
{
    // Cached render geometry only; original collision meshes and hit bounds stay intact.
    public static class SoftMesh
    {
        public static Mesh Create(Mesh source, float maximumRadius)
        {
            var input = source.vertices;
            var normals = source.normals;
            var indices = source.triangles;
            var v = new List<Vector3>();
            var n = new List<Vector3>();
            var uv = new List<Vector2>();
            var tri = new List<int>();
            var remap = new Dictionary<int, int>();
            var replaced = new bool[input.Length];
            bool changed = false;
            for (int start = 0; start + 24 <= input.Length;)
            {
                if (!BoxAxes(input, normals, start, out var center, out var axes, out var half))
                {
                    start++;
                    continue;
                }

                // Every face must be isolated from other primitives in the merged source mesh.
                bool isolated = true;
                for (int t = 0; t < indices.Length; t += 3)
                {
                    int count = 0;
                    for (int j = 0; j < 3; j++)
                        if (indices[t + j] >= start && indices[t + j] < start + 24)
                            count++;
                    if (count != 0 && count != 3)
                    {
                        isolated = false;
                        break;
                    }
                }

                if (!isolated)
                {
                    start++;
                    continue;
                }

                float radius = Mathf.Min(maximumRadius, Mathf.Min(half.x, Mathf.Min(half.y, half.z)) * .22f);
                if (radius < .003f)
                {
                    start += 24;
                    continue;
                }

                for (int i = start; i < start + 24; i++)
                    replaced[i] = true;
                AddBox(v, n, uv, tri, center, axes, half, radius);
                changed = true;
                start += 24;
            }

            if (!changed)
                return source;
            for (int i = 0; i < indices.Length; i += 3)
            {
                if (replaced[indices[i]])
                    continue;
                for (int j = 0; j < 3; j++)
                {
                    int old = indices[i + j];
                    if (!remap.TryGetValue(old, out int index))
                    {
                        index = v.Count;
                        remap[old] = index;
                        v.Add(input[old]);
                        n.Add(normals[old]);
                        uv.Add(Vector2.zero);
                    }

                    tri.Add(index);
                }
            }

            var mesh = new Mesh
            {
                name = source.name + " / softened",
                indexFormat = IndexFormat.UInt32
            };
            mesh.SetVertices(v);
            mesh.SetNormals(n);
            mesh.SetUVs(0, uv);
            mesh.SetTriangles(tri, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        static bool BoxAxes(Vector3[] p, Vector3[] n, int start, out Vector3 center, out Vector3[] axes, out Vector3 half)
        {
            center = Vector3.zero;
            half = Vector3.zero;
            axes = new Vector3[3];
            if (n.Length != p.Length)
                return false;
            for (int i = 0; i < 24; i++)
            {
                center += p[start + i];
                if ((n[start + i] - n[start + (i / 4) * 4]).sqrMagnitude > 1e-5f)
                    return false;
            }

            center /= 24;
            int count = 0;
            for (int f = 0; f < 6; f++)
            {
                var a = n[start + f * 4].normalized;
                if (a.sqrMagnitude < .9f)
                    return false;
                bool unique = true;
                for (int j = 0; j < count; j++)
                {
                    float dot = Mathf.Abs(Vector3.Dot(axes[j], a));
                    if (dot > .999f)
                    {
                        unique = false;
                        break;
                    }

                    if (dot > .001f)
                        return false;
                }

                if (unique)
                {
                    if (count >= 3)
                        return false;
                    axes[count++] = a;
                }
            }

            if (count != 3)
                return false;
            for (int i = 0; i < 24; i++)
            {
                var d = p[start + i] - center;
                half.x = Mathf.Max(half.x, Mathf.Abs(Vector3.Dot(d, axes[0])));
                half.y = Mathf.Max(half.y, Mathf.Abs(Vector3.Dot(d, axes[1])));
                half.z = Mathf.Max(half.z, Mathf.Abs(Vector3.Dot(d, axes[2])));
            }

            if (Mathf.Min(half.x, Mathf.Min(half.y, half.z)) < .001f)
                return false;
            for (int i = 0; i < 24; i++)
            {
                var d = p[start + i] - center;
                for (int j = 0; j < 3; j++)
                    if (Mathf.Abs(Mathf.Abs(Vector3.Dot(d, axes[j])) - half[j]) > .0003f)
                        return false;
            }

            return true;
        }

        static void AddBox(List<Vector3> vertices, List<Vector3> normals, List<Vector2> uv, List<int> triangles, Vector3 center, Vector3[] axes, Vector3 half, float radius)
        {
            var inner = half - Vector3.one * radius;
            for (int face = 0; face < 3; face++)
                for (int sign = -1; sign <= 1; sign += 2)
                {
                    int u = (face + 1) % 3, w = (face + 2) % 3;
                    int first = vertices.Count;
                    float[] xs =
                    {
                        -half[u],
                        -half[u] + radius,
                        half[u] - radius,
                        half[u]
                    }, ys =
                    {
                        -half[w],
                        -half[w] + radius,
                        half[w] - radius,
                        half[w]
                    };
                    for (int y = 0; y < 4; y++)
                        for (int x = 0; x < 4; x++)
                        {
                            Vector3 point = Vector3.zero;
                            point[face] = half[face] * sign;
                            point[u] = xs[x];
                            point[w] = ys[y];
                            var core = new Vector3(Mathf.Clamp(point.x, -inner.x, inner.x), Mathf.Clamp(point.y, -inner.y, inner.y), Mathf.Clamp(point.z, -inner.z, inner.z));
                            var normal = (point - core).normalized;
                            point = core + normal * radius;
                            vertices.Add(center + axes[0] * point.x + axes[1] * point.y + axes[2] * point.z);
                            normals.Add(axes[0] * normal.x + axes[1] * normal.y + axes[2] * normal.z);
                            uv.Add(new Vector2((float)x / 3, (float)y / 3));
                        }

                    for (int y = 0; y < 3; y++)
                        for (int x = 0; x < 3; x++)
                        {
                            int a = first + y * 4 + x, b = a + 1, c = a + 4, d = c + 1;
                            AddTriangle(vertices, normals, triangles, a, b, c);
                            AddTriangle(vertices, normals, triangles, b, d, c);
                        }
                }
        }

        static void AddTriangle(List<Vector3> v, List<Vector3> n, List<int> triangles, int a, int b, int c)
        {
            if (Vector3.Dot(Vector3.Cross(v[b] - v[a], v[c] - v[a]), n[a]) < 0)
            {
                int t = b;
                b = c;
                c = t;
            }

            triangles.Add(a);
            triangles.Add(b);
            triangles.Add(c);
        }
    }
}

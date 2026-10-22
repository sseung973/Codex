using System;
using System.Collections.Generic;
using UnityEngine;

namespace RelayZero
{
    [Serializable]
    public class SurfaceData
    {
        public string name;
        public float[] color, emission;
        public float metallic, roughness, alpha = 1;
        public bool unlit;
    }

    [Serializable]
    public class PartData
    {
        public string name;
        public int material;
        public float[] vertices, normals;
        public int[] triangles;
        public bool solid, visible = true, enabled = true, head, shield, weakpoint;
    }

    [Serializable]
    public class ModelData
    {
        public SurfaceData[] materials;
        public PartData[] parts;
    }

    [Serializable]
    public class PointData
    {
        public float[] p;
    }

    [Serializable]
    public class SignData
    {
        public string text, color;
        public float[] p;
        public float w, h, yaw;
        public bool ground;
    }

    [Serializable]
    public class LightData
    {
        public int type;
        public float[] p, direction, color;
        public float intensity, range;
    }

    [Serializable]
    public class ArenaData : ModelData
    {
        public string id, name, title, description, clear;
        public float[] spawn;
        public PointData[] spawns, mission;
        public int[] blocked;
        public SignData[] signs;
        public LightData[] lights;
    }

    [Serializable]
    public class BalanceData
    {
        public string source;
        public WeaponSpec[] weapons;
        public DifficultySpec[] difficulties;
    }

    [Serializable]
    public class GameSettings
    {
        public float sensitivity = 1, masterVolume = .65f, sfxVolume = .8f, fov = 90, crosshairSize = 1;
        public int quality = 1;
        public bool autoGraphics = true, headBob = true;
    }

    public static class Data
    {
        public static BalanceData Balance;
        public static Font Font;
        public static void Load()
        {
            Balance = Read<BalanceData>("balance");
            Font = Resources.Load<Font>("Fonts/NotoSansCJKkr-Regular");
            if (!Font)
                Font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        }

        public static T Read<T>(string name)
        {
            var asset = Resources.Load<TextAsset>("Data/" + name);
            if (!asset)
                throw new InvalidOperationException("Missing exported game data: " + name);
            return JsonUtility.FromJson<T>(asset.text);
        }

        public static WeaponSpec Weapon(string id)
        {
            return Array.Find(Balance.weapons, w => w.id == id);
        }

        public static Vector3 V(float[] p)
        {
            return p != null && p.Length == 3 ? new Vector3(p[0], p[1], p[2]) : Vector3.zero;
        }

        public static float[] A(Vector3 v)
        {
            return new[]
            {
                Round(v.x),
                Round(v.y),
                Round(v.z)
            };
        }

        public static float Round(float n)
        {
            return (float)Math.Round(n, 3);
        }

        public static Color ColorOf(string hex)
        {
            Color c;
            return ColorUtility.TryParseHtmlString(hex, out c) ? c : Color.white;
        }

        public static Color C(float[] c)
        {
            return c != null && c.Length >= 3 ? new Color(c[0], c[1], c[2]) : Color.white;
        }

        public static float Damp(float a, float b, float speed, float dt)
        {
            return Mathf.Lerp(a, b, 1 - Mathf.Exp(-speed * dt));
        }

        public static string Clock(float t)
        {
            return ((int)t / 60) + ":" + ((int)t % 60).ToString("00");
        }
    }
}

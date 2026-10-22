using System.Collections.Generic;
using UnityEngine;

namespace RelayZero
{
    public class Effects
    {
        class Line
        {
            public LineRenderer Renderer;
            public float Life;
        }

        readonly Line[] pool = new Line[48];
        int next;
        readonly Material material;
        Transform root;
        public Effects()
        {
            root = new GameObject("Pooled combat effects").transform;
            material = new Material(Resources.Load<Shader>("RelayUnlit"));
            for (int i = 0; i < pool.Length; i++)
            {
                pool[i] = new Line
                {
                    Renderer = MakeLine(root, Color.white, .025f)
                };
                pool[i].Renderer.gameObject.SetActive(false);
            }
        }

        public LineRenderer MakeLine(Transform parent, Color color, float width)
        {
            var go = new GameObject("Combat line");
            go.transform.SetParent(parent, false);
            go.layer = 0;
            var l = go.AddComponent<LineRenderer>();
            l.sharedMaterial = material;
            l.positionCount = 2;
            l.useWorldSpace = true;
            l.startWidth = l.endWidth = width;
            l.startColor = l.endColor = color;
            l.numCapVertices = 2;
            l.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            l.receiveShadows = false;
            return l;
        }

        public LineRenderer MakeRing(Transform parent, float radius, Color color)
        {
            var l = MakeLine(parent, color, .045f);
            l.positionCount = 49;
            l.loop = false;
            l.useWorldSpace = false;
            for (int i = 0; i <= 48; i++)
            {
                float a = i * Mathf.PI * 2 / 48;
                l.SetPosition(i, new Vector3(Mathf.Cos(a) * radius, .08f, Mathf.Sin(a) * radius));
            }

            return l;
        }

        public void Tracer(Vector3 a, Vector3 b, Color? color = null)
        {
            var p = pool[next++ % pool.Length];
            p.Renderer.gameObject.SetActive(true);
            p.Renderer.positionCount = 2;
            p.Renderer.loop = false;
            p.Renderer.startColor = p.Renderer.endColor = color ?? new Color(1, .78f, .4f);
            p.Renderer.SetPosition(0, a);
            p.Renderer.SetPosition(1, b);
            p.Life = .065f;
        }

        public void Pulse(Vector3 p, float radius, Color color)
        {
            for (int i = 0; i < 12; i++)
            {
                float a = i * Mathf.PI / 6, b = (i + 1) * Mathf.PI / 6;
                Tracer(p + new Vector3(Mathf.Cos(a) * radius, .08f, Mathf.Sin(a) * radius), p + new Vector3(Mathf.Cos(b) * radius, .08f, Mathf.Sin(b) * radius), color);
            }
        }

        public void Tick(float dt)
        {
            foreach (var p in pool)
                if (p.Life > 0)
                {
                    p.Life -= dt;
                    if (p.Life <= 0)
                        p.Renderer.gameObject.SetActive(false);
                }
        }

        public void Clear()
        {
            foreach (var p in pool)
            {
                p.Life = 0;
                p.Renderer.gameObject.SetActive(false);
            }
        }
    }

    public class GameAudio
    {
        readonly AudioSource[] voices = new AudioSource[12];
        readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        int next;
        readonly RelayGame game;
        public GameAudio(RelayGame owner)
        {
            game = owner;
            var root = new GameObject("Synthesized original SFX");
            for (int i = 0; i < voices.Length; i++)
            {
                voices[i] = root.AddComponent<AudioSource>();
                voices[i].playOnAwake = false;
                voices[i].spatialBlend = 0;
            }

            Make("swing", 240, .16f, .07f, 1);
            Make("fire", 110, .085f, .2f, 2);
            Make("reload", 360, .075f, .09f, 3);
            Make("dry", 1200, .025f, .05f, 3);
            Make("hit", 850, .055f, .09f, 0);
            Make("headshot", 1550, .13f, .11f, 0);
            Make("step", 65, .065f, .09f, 1);
            Make("jump", 160, .1f, .04f, 0);
            Make("land", 48, .12f, .13f, 1);
            Make("enemy", 165, .065f, .08f, 2);
            Make("alert", 620, .18f, .05f, 0);
            Make("ui", 660, .08f, .06f, 0);
        }

        void Make(string id, float freq, float duration, float amp, int type)
        {
            int count = Mathf.CeilToInt(44100 * duration);
            var samples = new float[count];
            float phase = 0;
            var random = new System.Random(973);
            for (int i = 0; i < count; i++)
            {
                float t = (float)i / count;
                phase += freq * Mathf.Pow(.45f, t) / 44100;
                float x = phase - Mathf.Floor(phase);
                float wave = type == 0 ? Mathf.Sin(phase * Mathf.PI * 2) : type == 1 ? 1 - 4 * Mathf.Abs(x - .5f) : type == 2 ? 2 * x - 1 : x < .5f ? 1 : -1;
                samples[i] = (wave * amp + (id == "fire" ? (float)(random.NextDouble() * 2 - 1) * .16f : 0)) * Mathf.Pow(.0001f, t);
            }

            var clip = AudioClip.Create(id, count, 1, 44100, false);
            clip.SetData(samples, 0);
            clips[id] = clip;
        }

        public void Play(string id, float volume = 1)
        {
            AudioClip clip;
            if (!clips.TryGetValue(id, out clip))
                return;
            var voice = voices[next++ % voices.Length];
            voice.clip = clip;
            voice.volume = game.Settings.masterVolume * game.Settings.sfxVolume * volume;
            voice.Play();
        }
    }
}

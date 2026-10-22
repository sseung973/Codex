using System;
using System.Collections.Generic;
using UnityEngine;

namespace RelayZero
{
    [Serializable]
    public class VisualReplacement
    {
        public string key;
        public string map = "*";
        public GameObject prefab;
        public Vector3 rotation, offset;
        public float scale = 1;
        public bool stretchToBounds;
        public string speedParameter = "Speed", deadParameter = "Dead", attackParameter = "Attack";
    }

    [CreateAssetMenu(menuName = "RELAY ZERO/Visual Overrides", fileName = "VisualOverrides")]
    public class VisualOverrides : ScriptableObject
    {
        [Tooltip("Rounds the built-in box meshes until imported visual prefabs replace them.")]
        public bool softenOriginalMeshes = true;
        [Tooltip("Keys: weapon-ar7, weapon-p12, robot-assault, robot-commander, operative-friendly, etc.")]
        public VisualReplacement[] models = Array.Empty<VisualReplacement>();
        [Tooltip("Exact original map part name, e.g. cargo container, lab chamber, server column, supply crate.")]
        public VisualReplacement[] environment = Array.Empty<VisualReplacement>();
        static VisualOverrides current;
        static bool loaded;
        static readonly HashSet<string> Warned = new HashSet<string>();
        public static VisualOverrides Current
        {
            get
            {
                if (!loaded)
                {
                    current = Resources.Load<VisualOverrides>("VisualOverrides");
                    loaded = true;
                }

                return current;
            }
        }

        public static bool Soften
        {
            get
            {
                return !Current || Current.softenOriginalMeshes;
            }
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void Reset()
        {
            current = null;
            loaded = false;
            Warned.Clear();
        }

        public static VisualReplacement Find(VisualReplacement[] entries, string key, string map = "*")
        {
            if (entries == null)
                return null;
            foreach (var e in entries)
                if (e != null && e.prefab && string.Equals(e.key, key, StringComparison.OrdinalIgnoreCase) && (e.map == "*" || string.IsNullOrEmpty(e.map) || e.map == map))
                    return e;
            return null;
        }

        public static GameObject Attach(VisualReplacement e, Transform parent, Bounds target, int layer)
        {
            if (e == null || !e.prefab)
                return null;
            // Only accept visual prefabs. Third-party game scripts must not take over this game's controls or AI.
            if (e.prefab.GetComponentsInChildren<MonoBehaviour>(true).Length > 0)
            {
                if (Warned.Add(e.prefab.name))
                    Debug.LogWarning("RELAY ZERO: prepare a visual-only prefab in Asset Store Visual Setup before using " + e.prefab.name);
                return null;
            }

            var root = new GameObject("Imported art / " + e.key);
            root.transform.SetParent(parent, false);
            var visual = UnityEngine.Object.Instantiate(e.prefab, root.transform, false);
            visual.transform.localPosition = Vector3.zero;
            visual.transform.localRotation = Quaternion.Euler(e.rotation);
            visual.transform.localScale = Vector3.one;
            foreach (var t in visual.GetComponentsInChildren<Transform>(true))
                t.gameObject.layer = layer;
            foreach (var c in visual.GetComponentsInChildren<Collider>(true))
                c.enabled = false;
            foreach (var b in visual.GetComponentsInChildren<Rigidbody>(true))
            {
                b.isKinematic = true;
                b.detectCollisions = false;
            }

            foreach (var c in visual.GetComponentsInChildren<Camera>(true))
                c.enabled = false;
            foreach (var l in visual.GetComponentsInChildren<Light>(true))
                l.enabled = false;
            foreach (var a in visual.GetComponentsInChildren<AudioSource>(true))
            {
                a.Stop();
                a.enabled = false;
            }

            foreach (var a in visual.GetComponentsInChildren<Animator>(true))
            {
                a.applyRootMotion = false;
                a.fireEvents = false;
            }

            foreach (var p in visual.GetComponentsInChildren<ParticleSystem>(true))
                p.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var renderers = visual.GetComponentsInChildren<Renderer>(true);
            if (renderers.Length == 0)
            {
                UnityEngine.Object.Destroy(root);
                return null;
            }

            var bounds = LocalBounds(root.transform, renderers);
            Vector3 size = bounds.size, desired = target.size;
            Vector3 ratio = new Vector3(desired.x / Mathf.Max(.001f, size.x), desired.y / Mathf.Max(.001f, size.y), desired.z / Mathf.Max(.001f, size.z));
            Vector3 fit = e.stretchToBounds ? ratio : Vector3.one * Mathf.Min(ratio.x, Mathf.Min(ratio.y, ratio.z));
            fit *= Mathf.Clamp(e.scale, .01f, 100);
            visual.transform.localScale = fit;
            bounds = LocalBounds(root.transform, renderers);
            visual.transform.localPosition += target.center - bounds.center + e.offset;
            var motion = root.AddComponent<ImportedVisualMotion>();
            motion.Configure(e);
            return root;
        }

        static Bounds LocalBounds(Transform root, Renderer[] renderers)
        {
            var bounds = new Bounds();
            bool first = true;
            foreach (var r in renderers)
            {
                var b = r.localBounds;
                for (int i = 0; i < 8; i++)
                {
                    Vector3 point = b.center + Vector3.Scale(b.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1));
                    point = root.InverseTransformPoint(r.transform.TransformPoint(point));
                    if (first)
                    {
                        bounds = new Bounds(point, Vector3.zero);
                        first = false;
                    }
                    else
                        bounds.Encapsulate(point);
                }
            }

            return bounds;
        }
    }

    public class ImportedVisualMotion : MonoBehaviour
    {
        Animator[] animators;
        Bot bot;
        Vector3 previous;
        string speed, dead, attack;
        bool wasCue;
        readonly Dictionary<Animator, HashSet<string>> parameters = new Dictionary<Animator, HashSet<string>>();
        public void Configure(VisualReplacement e)
        {
            speed = e.speedParameter;
            dead = e.deadParameter;
            attack = e.attackParameter;
            animators = GetComponentsInChildren<Animator>(true);
            bot = GetComponentInParent<Bot>();
            previous = transform.position;
            foreach (var a in animators)
            {
                var p = new HashSet<string>();
                if (a.runtimeAnimatorController)
                    foreach (var item in a.parameters)
                        p.Add(item.name + ":" + (int)item.type);
                parameters[a] = p;
            }
        }

        void LateUpdate()
        {
            if (animators == null || !bot)
                return;
            float velocity = (transform.position - previous).magnitude / Mathf.Max(.001f, Time.deltaTime);
            previous = transform.position;
            bool cue = bot.Cue > 0;
            foreach (var a in animators)
            {
                if (!a || !a.runtimeAnimatorController)
                    continue;
                var p = parameters[a];
                if (!string.IsNullOrEmpty(speed) && p.Contains(speed + ":" + (int)AnimatorControllerParameterType.Float))
                    a.SetFloat(speed, bot.Alive ? velocity : 0);
                if (!string.IsNullOrEmpty(dead) && p.Contains(dead + ":" + (int)AnimatorControllerParameterType.Bool))
                    a.SetBool(dead, !bot.Alive);
                if (cue && !wasCue && !string.IsNullOrEmpty(attack) && p.Contains(attack + ":" + (int)AnimatorControllerParameterType.Trigger))
                    a.SetTrigger(attack);
            }

            wasCue = cue;
        }
    }
}

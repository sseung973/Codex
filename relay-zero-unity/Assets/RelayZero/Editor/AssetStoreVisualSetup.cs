using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace RelayZero.Editor
{
    public class AssetStoreVisualSetup : EditorWindow
    {
        const string Local = "Assets/RelayZeroLocal";
        const string ProfilePath = Local + "/Resources/VisualOverrides.asset";
        VisualOverrides profile;
        SerializedObject serialized;
        Vector2 scroll;
        readonly string[] titles =
        {
            "시설 · Sci-Fi Construction Kit (무료)",
            "화물 · Free Shipping Containers (무료)",
            "총기 · Sci Fi Gun (무료)",
            "로봇 · Animated Robot Free (무료)"
        };
        readonly string[] urls =
        {
            "https://assetstore.unity.com/packages/3d/environments/sci-fi/sci-fi-construction-kit-modular-159280",
            "https://assetstore.unity.com/packages/3d/environments/industrial/free-shipping-containers-18315",
            "https://assetstore.unity.com/packages/3d/props/guns/sci-fi-gun-162872",
            "https://assetstore.unity.com/packages/3d/characters/robots/animated-low-poly-robot-free-stylized-sci-fi-character-318201"
        };
        [MenuItem("RELAY ZERO/Asset Store Visual Setup")]
        public static void Open()
        {
            GetWindow<AssetStoreVisualSetup>("RELAY ZERO / Art").Show();
        }

        void OnEnable()
        {
            Load();
        }

        void Load()
        {
            profile = AssetDatabase.LoadAssetAtPath<VisualOverrides>(ProfilePath);
            if (profile)
                serialized = new SerializedObject(profile);
        }

        void OnGUI()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                EditorGUILayout.HelpBox("Play 모드를 멈춘 뒤 에셋을 준비해줘.", MessageType.Info);
                return;
            }

            scroll = EditorGUILayout.BeginScrollView(scroll);
            EditorGUILayout.LabelField("에셋으로 그래픽 교체", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("Asset Store 패키지를 같은 Unity ID의 My Assets에서 받아 Import한 후 사용해. 아래 링크는 패키지를 자동 설치하지 않아. 현재 프로젝트는 Built-in Render Pipeline이야.", MessageType.Info);
            for (int i = 0; i < titles.Length; i++)
            {
                int index = i;
                if (GUILayout.Button(titles[i]))
                    Application.OpenURL(urls[index]);
            }

            if (GUILayout.Button("다운로드한 .unitypackage 가져오기…"))
            {
                string file = EditorUtility.OpenFilePanel("Import acquired Unity package", "", "unitypackage");
                if (!string.IsNullOrEmpty(file))
                    AssetDatabase.ImportPackage(file, true);
            }

            EditorGUILayout.Space();
            EditorGUILayout.LabelField("1. 선택한 프리팹을 시각 요소 전용으로 준비", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("Project 창에서 임포트한 프리팹을 선택해. 새 복사본에서는 외부 조작·AI 스크립트와 충돌체를 제거하고 메시·재질·스켈레톤·Animator를 보존해. 원본 패키지는 수정하지 않아.", MessageType.None);
            if (GUILayout.Button("선택한 프리팹 준비…"))
                PrepareSelected();
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("2. 교체할 대상에 준비한 프리팹 연결", EditorStyles.boldLabel);
            if (!profile)
            {
                if (GUILayout.Button("로컬 교체 프로필 만들기"))
                    CreateProfile();
            }
            else
            {
                serialized.Update();
                EditorGUILayout.PropertyField(serialized.FindProperty("softenOriginalMeshes"), new GUIContent("기본 모델 모서리 부드럽게"));
                EditorGUILayout.PropertyField(serialized.FindProperty("models"), new GUIContent("총기 · 로봇 · 플레이어"), true);
                EditorGUILayout.PropertyField(serialized.FindProperty("environment"), new GUIContent("전장 소품"), true);
                if (serialized.ApplyModifiedProperties())
                    EditorUtility.SetDirty(profile);
                if (GUILayout.Button("프로필 저장 / 점검"))
                {
                    AssetDatabase.SaveAssets();
                    Validate();
                }
            }

            EditorGUILayout.HelpBox("key는 기존 이름과 정확히 맞춰. 예: weapon-ar7, weapon-p12, robot-assault, robot-defender, robot-commander. 환경 key 예: cargo container, supply crate, server column. map은 foundry / cargo / nexus / * . 무기·캐릭터는 비율 유지가 기본이며 offset·rotation·scale로 정렬할 수 있어.", MessageType.None);
            EditorGUILayout.LabelField("실제 충돌과 헤드샷·방패·보스 약점은 게임 코드가 담당해. 새 모델의 머리·총열 위치를 확인하고 Play 모드에서 점검해야 해.", EditorStyles.wordWrappedLabel);
            EditorGUILayout.EndScrollView();
        }

        void CreateProfile()
        {
            Directory.CreateDirectory(Local + "/Resources");
            AssetDatabase.Refresh();
            profile = CreateInstance<VisualOverrides>();
            profile.models = new[]
            {
                Entry("weapon-ar7"),
                Entry("weapon-p12"),
                Entry("weapon-p6"),
                Entry("weapon-s24"),
                Entry("weapon-r20"),
                Entry("weapon-l5"),
                Entry("weapon-arc"),
                Entry("robot-assault"),
                Entry("robot-defender"),
                Entry("robot-support"),
                Entry("robot-sniper"),
                Entry("robot-bomber"),
                Entry("robot-commander"),
                Entry("operative-friendly"),
                Entry("operative-rival")
            };
            profile.environment = new[]
            {
                Entry("cargo container", "cargo", true),
                Entry("supply crate", "cargo", true),
                Entry("cover", "foundry", true),
                Entry("server column", "nexus", true),
                Entry("lab chamber", "nexus", true)
            };
            AssetDatabase.CreateAsset(profile, ProfilePath);
            AssetDatabase.SaveAssets();
            Load();
        }

        static VisualReplacement Entry(string key, string map = "*", bool stretch = false)
        {
            return new VisualReplacement
            {
                key = key,
                map = map,
                stretchToBounds = stretch
            };
        }

        void PrepareSelected()
        {
            var selected = Selection.activeObject as GameObject;
            if (!selected || !EditorUtility.IsPersistent(selected))
            {
                EditorUtility.DisplayDialog("프리팹 선택", "Project 창에서 가져온 프리팹 또는 FBX 모델을 먼저 선택해줘.", "확인");
                return;
            }

            Directory.CreateDirectory(Local + "/Prefabs");
            AssetDatabase.Refresh();
            string path = EditorUtility.SaveFilePanelInProject("Prepare visual prefab", selected.name + "-RelayVisual", "prefab", "Save the prepared visual under Assets/RelayZeroLocal to keep it local.", Local + "/Prefabs");
            if (string.IsNullOrEmpty(path))
                return;
            GameObject copy = null;
            try
            {
                copy = UnityEngine.Object.Instantiate(selected);
                copy.SetActive(false);
                foreach (var component in copy.GetComponentsInChildren<Component>(true))
                {
                    if (!component || component is Transform || component is Renderer || component is MeshFilter || component is Animator || component is LODGroup || component is Animation || component is ParticleSystem)
                        continue;
                    DestroyImmediate(component);
                }

                ConvertMaterials(copy);
                foreach (var a in copy.GetComponentsInChildren<Animator>(true))
                {
                    a.applyRootMotion = false;
                    a.fireEvents = false;
                }

                copy.SetActive(true);
                var prefab = PrefabUtility.SaveAsPrefabAsset(copy, path);
                AssetDatabase.SaveAssets();
                Selection.activeObject = prefab;
                EditorGUIUtility.PingObject(prefab);
                EditorUtility.DisplayDialog("준비 완료", "이 프리팹을 교체 프로필의 prefab 칸에 연결해줘. 정렬·재질·애니메이션은 Play 모드에서 확인해야 해.", "확인");
            }
            finally
            {
                if (copy)
                    DestroyImmediate(copy);
            }
        }

        static void ConvertMaterials(GameObject copy)
        {
            Directory.CreateDirectory(Local + "/Materials");
            AssetDatabase.Refresh();
            var converted = new System.Collections.Generic.Dictionary<Material, Material>();
            foreach (var renderer in copy.GetComponentsInChildren<Renderer>(true))
            {
                var materials = renderer.sharedMaterials;
                for (int i = 0; i < materials.Length; i++)
                {
                    var old = materials[i];
                    if (!old || !old.shader)
                        continue;
                    string shader = old.shader.name;
                    if (!shader.Contains("Universal Render Pipeline") && !shader.StartsWith("HDRP/"))
                        continue;
                    if (!converted.TryGetValue(old, out var material))
                    {
                        material = new Material(Shader.Find("Standard"));
                        material.name = old.name + "-Builtin";
                        string albedo = old.HasProperty("_BaseMap") ? "_BaseMap" : "_MainTex";
                        if (old.HasProperty(albedo))
                        {
                            material.mainTexture = old.GetTexture(albedo);
                            material.mainTextureScale = old.GetTextureScale(albedo);
                            material.mainTextureOffset = old.GetTextureOffset(albedo);
                        }

                        material.color = old.HasProperty("_BaseColor") ? old.GetColor("_BaseColor") : old.HasProperty("_Color") ? old.GetColor("_Color") : Color.white;
                        foreach (string property in new[]
                        {
                            "_BumpMap",
                            "_MetallicGlossMap",
                            "_OcclusionMap",
                            "_EmissionMap"
                        }

                        )
                            if (old.HasProperty(property))
                                material.SetTexture(property, old.GetTexture(property));
                        if (material.GetTexture("_BumpMap"))
                            material.EnableKeyword("_NORMALMAP");
                        if (material.GetTexture("_MetallicGlossMap"))
                            material.EnableKeyword("_METALLICGLOSSMAP");
                        if (old.HasProperty("_Metallic"))
                            material.SetFloat("_Metallic", old.GetFloat("_Metallic"));
                        material.SetFloat("_Glossiness", old.HasProperty("_Smoothness") ? old.GetFloat("_Smoothness") : .3f);
                        if (old.HasProperty("_EmissionColor"))
                        {
                            material.SetColor("_EmissionColor", old.GetColor("_EmissionColor"));
                            material.EnableKeyword("_EMISSION");
                        }

                        if (old.HasProperty("_AlphaClip") && old.GetFloat("_AlphaClip") > .5f)
                        {
                            material.SetFloat("_Mode", 1);
                            material.SetOverrideTag("RenderType", "TransparentCutout");
                            material.EnableKeyword("_ALPHATEST_ON");
                            material.renderQueue = 2450;
                        }
                        else if (old.HasProperty("_Surface") && old.GetFloat("_Surface") > .5f)
                        {
                            material.SetFloat("_Mode", 2);
                            material.SetOverrideTag("RenderType", "Transparent");
                            material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                            material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                            material.SetInt("_ZWrite", 0);
                            material.EnableKeyword("_ALPHABLEND_ON");
                            material.renderQueue = 3000;
                        }

                        string path = AssetDatabase.GenerateUniqueAssetPath(Local + "/Materials/" + System.Text.RegularExpressions.Regex.Replace(material.name, "[^a-zA-Z0-9_-]", "_") + ".mat");
                        AssetDatabase.CreateAsset(material, path);
                        converted.Add(old, material);
                    }

                    materials[i] = material;
                }

                renderer.sharedMaterials = materials;
            }
        }

        void Validate()
        {
            int assigned = 0;
            foreach (var e in profile.models.Concat(profile.environment))
            {
                if (e == null || !e.prefab)
                    continue;
                assigned++;
                if (e.prefab.GetComponentsInChildren<MonoBehaviour>(true).Length > 0)
                    Debug.LogError("RELAY ZERO: visual contains scripts: " + e.key, e.prefab);
                foreach (var r in e.prefab.GetComponentsInChildren<Renderer>(true))
                    foreach (var m in r.sharedMaterials)
                        if (m && (!m.shader || !m.shader.isSupported || m.shader.name.Contains("Universal Render Pipeline") || m.shader.name.StartsWith("HDRP/")))
                            Debug.LogWarning("RELAY ZERO: check Built-in material compatibility: " + m.name, m);
            }

            Debug.Log("RELAY ZERO visual profile: " + assigned + " prefab assignments. Import and gameplay checks still require Play Mode.", profile);
        }
    }
}

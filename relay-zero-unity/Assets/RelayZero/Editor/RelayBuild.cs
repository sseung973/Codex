using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using System;
using System.IO;

namespace RelayZero.Editor
{
    public static class RelayBuild
    {
        const string Scene = "Assets/Scenes/RelayZero.unity";
        [InitializeOnLoadMethod]
        static void Configure()
        {
            EditorApplication.delayCall += () =>
            {
                if (EditorApplication.isPlayingOrWillChangePlaymode)
                    return;
                PlayerSettings.companyName = "RELAY ZERO";
                PlayerSettings.productName = "RELAY ZERO";
                PlayerSettings.bundleVersion = "3.2.0-unity.2";
                PlayerSettings.runInBackground = true;
                PlayerSettings.colorSpace = ColorSpace.Linear;
                PlayerSettings.defaultScreenWidth = 1280;
                PlayerSettings.defaultScreenHeight = 720;
                PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
                EditorBuildSettings.scenes = new[]
                {
                    new EditorBuildSettingsScene(Scene, true)
                };
            };
        }

        [MenuItem("RELAY ZERO/Open Game Scene")]
        public static void Open()
        {
            UnityEditor.SceneManagement.EditorSceneManager.OpenScene(Scene);
        }

        [MenuItem("RELAY ZERO/Build Windows x64")]
        public static void Windows()
        {
            Build(BuildTarget.StandaloneWindows64, "Builds/Windows/RelayZero.exe");
        }

        [MenuItem("RELAY ZERO/Build Linux x64")]
        public static void Linux()
        {
            Build(BuildTarget.StandaloneLinux64, "Builds/Linux/RelayZero.x86_64");
        }

        [MenuItem("RELAY ZERO/Build macOS")]
        public static void Mac()
        {
            Build(BuildTarget.StandaloneOSX, "Builds/macOS/RelayZero.app");
        }

        [MenuItem("RELAY ZERO/Validate Exported Content")]
        public static void Validate()
        {
            Data.Load();
            foreach (string map in new[]
            {
                "foundry",
                "cargo",
                "nexus"
            }

            )
            {
                var a = Data.Read<ArenaData>(map);
                if (a.parts.Length < 50 || a.mission.Length != 2 || a.spawns.Length != 7)
                    throw new Exception("Invalid arena " + map);
            }

            foreach (var w in Data.Balance.weapons)
            {
                var m = Data.Read<ModelData>("weapon-" + w.id);
                if (m.parts.Length == 0)
                    throw new Exception("Missing weapon geometry " + w.id);
            }

            Debug.Log("RELAY ZERO: exported content and balance validated.");
        }

        public static void CI()
        {
            Validate();
            string target = Environment.GetEnvironmentVariable("RELAY_BUILD_TARGET") ?? "linux";
            if (target == "windows")
                Windows();
            else if (target == "macos")
                Mac();
            else
                Linux();
        }

        static void Build(BuildTarget target, string path)
        {
            Validate();
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { Scene }, locationPathName = path, target = target, options = BuildOptions.None });
            if (report.summary.result != BuildResult.Succeeded)
                throw new Exception("Build failed: " + report.summary.result);
            Debug.Log("RELAY ZERO build: " + path);
        }
    }
}

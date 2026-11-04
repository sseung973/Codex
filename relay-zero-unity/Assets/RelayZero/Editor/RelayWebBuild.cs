using System;
using System.IO;
using System.IO.Compression;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace RelayZero.Editor
{
    public static class RelayWebBuild
    {
        const string PendingKey = "relay-zero-build-web-pending";
        const string Folder = "Builds/WebGL";
        const string Zip = "Builds/RelayZero-Unity-WebGL.zip";

        [InitializeOnLoadMethod]
        static void Register()
        {
            EditorApplication.update += ContinueWhenReady;
        }

        [MenuItem("RELAY ZERO/Build WebGL + ZIP")]
        public static void Run()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("RELAY ZERO: stop Play Mode before building.");
                return;
            }
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
            {
                EditorUtility.DisplayDialog("Web Build Support 필요", "Unity Hub → Installs → 사용 중인 Editor의 Manage → Add modules에서 Web Build Support를 설치한 뒤 다시 눌러줘.", "확인");
                return;
            }
            // Switching platforms recompiles scripts; resume after the resulting domain reload.
            SessionState.SetBool(PendingKey, true);
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL &&
                !EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.WebGL, BuildTarget.WebGL))
            {
                SessionState.SetBool(PendingKey, false);
                throw new InvalidOperationException("Unable to switch to WebGL. Install Web Build Support for this Editor.");
            }
        }

        static void ContinueWhenReady()
        {
            if (!SessionState.GetBool(PendingKey, false) || EditorApplication.isCompiling || EditorApplication.isUpdating || EditorApplication.isPlayingOrWillChangePlaymode)
                return;
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL)
                return;
            SessionState.SetBool(PendingKey, false);
            try
            {
                Build();
                EditorUtility.RevealInFinder(Path.GetFullPath(Zip));
                EditorUtility.DisplayDialog("배포용 ZIP 생성 완료", Path.GetFullPath(Zip) + "\n\n이 ZIP을 대화에 첨부하면 Unity 버전 플레이 링크를 배포할 수 있어.", "확인");
            }
            catch (Exception error)
            {
                Debug.LogException(error);
            }
        }

        public static void CI()
        {
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL)
                throw new InvalidOperationException("Start Unity with -buildTarget WebGL for a Web build.");
            Build();
        }

        static void Build()
        {
            if (File.Exists(Zip))
                File.Delete(Zip);
            RelayBuild.Validate();
            // Static hosting cannot assume compressed-response headers. Unity's loader supplies
            // gzip fallback; no special proxy, third-party CDN or COOP/COEP headers are required.
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.threadsSupport = false;
            PlayerSettings.WebGL.template = "PROJECT:RelayZero";
            PlayerSettings.stripEngineCode = true;
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.WebGL, ManagedStrippingLevel.Medium);
            PlayerSettings.runInBackground = true;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            // Keep the source build separate from the distributable ZIP and remove stale outputs.
            if (Directory.Exists(Folder))
                Directory.Delete(Folder, true);
            Directory.CreateDirectory(Folder);
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { "Assets/Scenes/RelayZero.unity" },
                locationPathName = Folder,
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("Unity WebGL build failed: " + report.summary.result);
            if (!File.Exists(Path.Combine(Folder, "index.html")) ||
                Directory.GetFiles(Folder, "*.wasm*", SearchOption.AllDirectories).Length == 0 ||
                Directory.GetFiles(Folder, "*.data*", SearchOption.AllDirectories).Length == 0)
                throw new InvalidDataException("Build did not produce index.html, Wasm and data files.");
            File.WriteAllText(Path.Combine(Folder, "relay-build.json"), JsonUtility.ToJson(new BuildInfo(), true));
            string notices = "RELAY ZERO Unity player\n\n";
            foreach (string source in new[] { "THIRD_PARTY_NOTICES.md", "Assets/RelayZero/Resources/Fonts/OFL.txt", "Assets/RelayZero/Resources/Fonts/Barlow-OFL.txt" })
                if (File.Exists(source))
                    notices += File.ReadAllText(source) + "\n\n";
            File.WriteAllText(Path.Combine(Folder, "LICENSES.txt"), notices);
            ZipFile.CreateFromDirectory(Folder, Zip, CompressionLevel.Optimal, false);
            Debug.Log("RELAY ZERO Unity WebGL ZIP: " + Path.GetFullPath(Zip));
        }

        [Serializable]
        class BuildInfo
        {
            public string engine = "Unity";
            public string target = "WebGL";
            public string unityVersion = Application.unityVersion;
            public string applicationVersion = PlayerSettings.bundleVersion;
            public string builtAtUTC = DateTime.UtcNow.ToString("O");
        }
    }
}

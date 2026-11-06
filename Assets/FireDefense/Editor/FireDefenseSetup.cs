#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using System.IO;

namespace FDEC.Game.Editor
{
    public static class FireDefenseSetup
    {
        const string ScenePath = "Assets/FireDefense/Scenes/Warehouse.unity";
        [MenuItem("Fire Defense/Create Warehouse Scene")]
        public static void CreateScene()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            if (File.Exists(ScenePath) && !EditorUtility.DisplayDialog("Replace warehouse scene?", "A warehouse scene already exists. Replace it with the starter scene?", "Replace", "Cancel")) return;
            Directory.CreateDirectory("Assets/FireDefense/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("FireDefenseGame").AddComponent<FireDefenseGame>();
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] {new EditorBuildSettingsScene(ScenePath, true)};
            Selection.activeGameObject = GameObject.Find("FireDefenseGame");
        }
        [MenuItem("Fire Defense/Build Website")]
        public static void BuildWebsite()
        {
            if (!File.Exists(ScenePath)) { EditorUtility.DisplayDialog("Create scene first", "Choose Fire Defense > Create Warehouse Scene, then build again.", "OK"); return; }
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
            { EditorUtility.DisplayDialog("Web Build Support required", "Install Web Build Support for this Editor version through Unity Hub.", "OK"); return; }
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL)
            { EditorUtility.DisplayDialog("Switch to Web first", "In File > Build Profiles, select Web and switch the active platform, then choose Build Website again.", "OK"); return; }
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            PlayerSettings.companyName = "FDEC";
            PlayerSettings.productName = "Fire Defense";
            PlayerSettings.bundleVersion = "0.2.0";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            // GitHub Pages cannot supply custom Content-Encoding headers.
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.template = "PROJECT:FDEC";
            Directory.CreateDirectory("docs");
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] {ScenePath}, locationPathName = "docs", target = BuildTarget.WebGL,
                options = BuildOptions.None
            });
            Debug.Log("Fire Defense web build: " + report.summary.result + ". Output: docs/");
        }
    }
}
#endif

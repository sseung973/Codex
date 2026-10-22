using UnityEngine;

namespace RelayZero
{
    // World labels need depth testing and their own material, rather than the UI font material.
    public class WorldSign : MonoBehaviour
    {
        TextMesh text;
        Renderer surface;
        Material material;
        Vector2 area;
        int fitFrames;

        public void Configure(SignData sign)
        {
            text = gameObject.AddComponent<TextMesh>();
            text.text = sign.text;
            text.font = Data.TextFont(sign.text);
            text.fontSize = 64;
            text.characterSize = 1;
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.color = Data.ColorOf(sign.color);
            surface = GetComponent<Renderer>();
            material = new Material(Resources.Load<Shader>("RelayWorldText"));
            surface.sharedMaterial = material;
            surface.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            surface.receiveShadows = false;
            area = new Vector2(sign.w * .9f, sign.h * .65f);
            Font.textureRebuilt += AtlasChanged;
            AtlasChanged(text.font);
        }

        void AtlasChanged(Font font)
        {
            if (!text || font != text.font || !material)
                return;
            material.mainTexture = font.material.mainTexture;
            fitFrames = 3;
        }

        void LateUpdate()
        {
            if (fitFrames <= 0 || !surface)
                return;
            var size = surface.localBounds.size;
            if (size.x <= 0 || size.y <= 0)
                return;
            transform.localScale = Vector3.one * Mathf.Min(area.x / size.x, area.y / size.y);
            fitFrames--;
        }

        void OnDestroy()
        {
            Font.textureRebuilt -= AtlasChanged;
            if (material)
                Destroy(material);
        }
    }
}

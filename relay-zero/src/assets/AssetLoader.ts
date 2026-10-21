import {
  Scene,
  AssetContainer,
  LoadAssetContainerAsync,
} from "@babylonjs/core";
export class AssetLoader {
  constructor(private scene: Scene) {}
  async model(
    url: string,
    onProgress?: (percent: number) => void,
  ): Promise<AssetContainer | null> {
    try {
      await import("@babylonjs/loaders/glTF");
      return await LoadAssetContainerAsync(url, this.scene, {
        onProgress: (event) => {
          if (event.lengthComputable)
            onProgress?.((event.loaded / event.total) * 100);
        },
      });
    } catch (error) {
      console.warn(
        `Model unavailable; retaining procedural asset: ${url}`,
        error,
      );
      return null;
    }
  }
}

import { pickWorld } from "./WorldQuery";
import { gameTheme, surface } from "../visual/GameTheme";
import { buildEnvironmentDetails } from "../visual/EnvironmentDetails";
import { maps, MapId } from "./MapData";
import { buildAdditionalMap } from "./AdditionalMaps";
import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Material,
  PBRMaterial,
  PointLight,
  Color3,
  Vector3,
  DirectionalLight,
  HemisphericLight,
  ShadowGenerator,
  Mesh,
  DynamicTexture,
  Color4,
  Ray,
  TransformNode,
  Light,
} from "@babylonjs/core";
export class Level {
  solids: Mesh[] = [];
  root: TransformNode;
  lights: Light[] = [];
  materials: Material[] = [];
  private surfaces = new Map<string, PBRMaterial>();
  shadows: ShadowGenerator;
  spawn = new Vector3(0, 0, -17);
  enemySpawns = [
    new Vector3(-18, 0, 13),
    new Vector3(18, 0, 14),
    new Vector3(0, 0, 18),
    new Vector3(-17, 0, -2),
    new Vector3(17, 0, 0),
    new Vector3(-9, 0, 17),
    new Vector3(9, 0, 17),
  ];
  constructor(
    public scene: Scene,
    public mapId: MapId = "foundry",
  ) {
    this.root = new TransformNode("level-" + mapId, scene);
    const theme = maps[mapId];
    const sky = Color3.FromHexString(theme.clear);
    scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity =
      mapId === "cargo" ? 0.003 : mapId === "nexus" ? 0.004 : 0.009;
    scene.fogColor = sky;
    scene.collisionsEnabled = true;
    const hemi = new HemisphericLight("sky", new Vector3(0.1, 1, 0.3), scene);
    hemi.intensity = mapId === "cargo" ? 1.05 : mapId === "nexus" ? 0.95 : 0.8;
    hemi.groundColor = new Color3(0.12, 0.15, 0.16);
    const sun = new DirectionalLight("sun", new Vector3(-0.6, -1, 0.45), scene);
    sun.position = new Vector3(18, 32, -18);
    sun.intensity = gameTheme.lighting.key;
    sun.diffuse =
      mapId === "cargo"
        ? Color3.FromHexString("#ffe1b5")
        : mapId === "foundry"
          ? Color3.FromHexString("#ffe3ca")
          : new Color3(0.87, 0.98, 1);
    this.lights.push(hemi, sun);
    const safe = new PointLight("entry fill", new Vector3(0, 4, -17), scene);
    safe.diffuse = Color3.FromHexString(gameTheme.colors.blue);
    safe.intensity = 0.65;
    safe.range = 10;
    const goal = new PointLight("relay fill", new Vector3(0, 6, 7), scene);
    goal.diffuse = Color3.FromHexString(theme.glow);
    goal.intensity = 0.8;
    goal.range = 12;
    this.lights.push(safe, goal);
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 90;
    this.shadows = new ShadowGenerator(1024, sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
    this.shadows.bias = 0.001;
    this.shadows.normalBias = 0.025;
    const floor = this.material("floor panel", theme.floor),
      wall = this.material("wall", theme.wall),
      dark = this.material("graphite", gameTheme.colors.metal),
      orange = this.material("painted metal", theme.accent),
      trim = this.material("metal", gameTheme.colors.steel),
      light = this.material("light", theme.glow, theme.glow);
    this.box("ground", new Vector3(0, -0.5, 0), new Vector3(44, 1, 46), floor);
    this.box(
      "back",
      new Vector3(0, mapId === "cargo" ? 2 : 4, 22),
      new Vector3(44, mapId === "cargo" ? 4 : 8, 1),
      wall,
    );
    this.box("front", new Vector3(0, 3, -22), new Vector3(44, 6, 1), dark);
    for (const x of [-22, 22])
      this.box(
        "side",
        new Vector3(x, mapId === "cargo" ? 2 : 4, 0),
        new Vector3(1, mapId === "cargo" ? 4 : 8, 45),
        wall,
      );
    for (let x = -20; x <= 20; x += 4) {
      this.box(
        "floor seam",
        new Vector3(x, 0.012, 0),
        new Vector3(0.025, 0.012, 44),
        trim,
        false,
      );
      this.box(
        "column",
        new Vector3(x, 4, 21.35),
        new Vector3(0.32, 8, 0.4),
        trim,
      );
    }
    for (let z = -20; z <= 20; z += 4)
      this.box(
        "floor seam",
        new Vector3(0, 0.026, z),
        new Vector3(44, 0.012, 0.025),
        trim,
        false,
      );
    if (mapId !== "foundry") {
      this.enemySpawns = [
        [-18, 14],
        [18, 14],
        [0, 18],
        [-18, -2],
        [18, 0],
        [-6, 18],
        [6, 20],
      ].map(([x, z]) => new Vector3(x, 0, z));
      buildAdditionalMap(this, mapId, { dark, accent: orange, trim, light });
      this.sign(
        theme.title,
        new Vector3(0, 5.7, 21.4),
        15,
        2.1,
        gameTheme.colors.ivory,
      );
      for (const x of [-3, 3])
        this.box(
          "spawn marking",
          new Vector3(x, 0.03, -17),
          new Vector3(0.06, 0.02, 5),
          light,
          false,
        );
      buildEnvironmentDetails(this);
      return;
    }
    for (const x of [-12, 12]) {
      this.box(
        "gallery",
        new Vector3(x, 2.4, 8),
        new Vector3(7, 4.8, 15),
        dark,
      );
      this.box(
        "gallery fascia",
        new Vector3(x, 4.8, 8),
        new Vector3(7.3, 0.25, 15.3),
        orange,
      );
      this.box(
        "gallery band",
        new Vector3(x, 3.6, 0.4),
        new Vector3(6.5, 0.12, 0.08),
        light,
        false,
      );
      for (const z of [3, 7, 11, 15]) {
        this.box(
          "rib",
          new Vector3(x + (x < 0 ? 3.54 : -3.54), 2.3, z),
          new Vector3(0.15, 4.5, 0.3),
          trim,
        );
      }
    }
    // Central relay island leaves four traversable combat lanes.
    this.box(
      "relay foundation",
      new Vector3(0, 0.25, 6),
      new Vector3(5, 0.5, 5),
      dark,
    );
    this.box(
      "relay core",
      new Vector3(0, 2.7, 6),
      new Vector3(2.8, 5, 2.8),
      trim,
    );
    for (const x of [-1.48, 1.48])
      this.box(
        "relay light",
        new Vector3(x, 3, 6),
        new Vector3(0.08, 3.2, 0.13),
        light,
        false,
      );
    this.box(
      "relay crown",
      new Vector3(0, 5.4, 6),
      new Vector3(3.6, 0.4, 3.6),
      orange,
    );
    for (const [x, z, w, h, d] of [
      [-6, -7, 3, 1.5, 2],
      [7, -4, 3.5, 1.7, 2],
      [-15, -11, 4, 2.3, 3],
      [14, -12, 3, 1.4, 3],
      [-5, 15, 2.5, 1.5, 2],
      [6, 16, 3, 1.8, 2],
      [0, -2, 2.4, 1.1, 1.5],
    ]) {
      this.box("cover", new Vector3(x, h / 2, z), new Vector3(w, h, d), orange);
      this.box(
        "cover cap",
        new Vector3(x, h + 0.035, z),
        new Vector3(w + 0.06, 0.07, d + 0.06),
        trim,
        false,
      );
      for (const t of [-0.35, 0.35])
        this.box(
          "crate strap",
          new Vector3(x + w * t, h / 2, z - d / 2 - 0.015),
          new Vector3(0.09, h, 0.03),
          dark,
          false,
        );
    }
    // A low raised firing deck with a continuous ramp, no stair snagging.
    this.box("deck", new Vector3(-16, 0.55, -17), new Vector3(7, 1.1, 6), trim);
    const ramp = this.box(
      "ramp",
      new Vector3(-10.8, 0.37, -17),
      new Vector3(4.1, 0.28, 5.8),
      trim,
    );
    ramp.rotation.z = -Math.atan(1.1 / 4);
    ramp.computeWorldMatrix(true);
    for (const x of [-20, 20])
      for (const z of [-16, -6, 5, 16]) {
        this.box(
          "wall buttress",
          new Vector3(x, 2, z),
          new Vector3(1.1, 4, 0.8),
          trim,
        );
        this.box(
          "wall beacon",
          new Vector3(x + (x < 0 ? 0.57 : -0.57), 2.9, z),
          new Vector3(0.05, 1, 0.25),
          light,
          false,
        );
      }
    for (let i = 0; i < 5; i++) {
      this.box(
        "sky beam",
        new Vector3(-18 + i * 9, 9, 8),
        new Vector3(0.38, 0.4, 29),
        dark,
        false,
      );
    }
    this.sign(
      "SECTOR 07",
      new Vector3(0, 5.7, 21.43),
      14,
      2.4,
      gameTheme.colors.ivory,
    );
    this.sign(
      "RELAY / CONTROL",
      new Vector3(-12, 2.8, 0.43),
      6,
      0.85,
      gameTheme.colors.ivory,
    );
    this.sign("07", new Vector3(12, 2.5, 0.43), 3, 2.3, gameTheme.colors.amber);
    this.sign(
      "HOLD THE RELAY",
      new Vector3(0, 0.025, -11),
      7,
      1.2,
      gameTheme.colors.ivory,
      true,
    );
    for (const x of [-3, 3])
      this.box(
        "spawn marking",
        new Vector3(x, 0.015, -17),
        new Vector3(0.06, 0.02, 5),
        light,
        false,
      );
    for (let i = 0; i < 12; i++) {
      const x = (i % 2 ? 1 : -1) * (24 + (i % 3) * 4);
      this.box(
        "distant tower",
        new Vector3(x, 5 + (i % 4) * 2, 12 + i * 3),
        new Vector3(5, 10 + (i % 4) * 4, 5),
        dark,
        false,
      );
    }
    buildEnvironmentDetails(this);
  }
  optimize(): void {
    const casters = new Set(this.shadows.getShadowMap()?.renderList ?? []);
    const groups = new Map<string, Mesh[]>();
    for (const abstract of this.root.getChildMeshes()) {
      if (!(abstract instanceof Mesh)) continue;
      const m = abstract;
      if (
        m.metadata?.renderBatch ||
        m.metadata?.colliderOnly ||
        m.metadata?.dynamic ||
        m.metadata?.entity ||
        m.name === "sign" ||
        !m.isEnabled() ||
        !m.material
      )
        continue;
      const key = `${m.material.uniqueId}:${casters.has(m)}`;
      const list = groups.get(key) ?? [];
      list.push(m);
      groups.set(key, list);
    }
    for (const meshes of groups.values()) {
      const material = meshes[0].material;
      const casts = casters.has(meshes[0]);
      for (const m of meshes) m.computeWorldMatrix(true);
      const batch = Mesh.MergeMeshes(
        meshes,
        false,
        true,
        undefined,
        false,
        false,
      );
      if (!batch) continue;
      batch.name = "static facility batch";
      batch.parent = this.root;
      batch.material = material;
      batch.isPickable = batch.checkCollisions = false;
      batch.receiveShadows = true;
      batch.metadata = { renderBatch: true, visualOnly: true };
      batch.freezeWorldMatrix();
      if (casts) this.shadows.addShadowCaster(batch);
      for (const m of meshes) {
        this.shadows.removeShadowCaster(m);
        if (m.metadata?.world) {
          m.isVisible = false;
          m.metadata.colliderOnly = true;
          m.freezeWorldMatrix();
        } else m.dispose();
      }
    }
    for (const m of this.root.getChildMeshes()) m.freezeWorldMatrix();
  }
  material(name: string, hex: string, emission?: string): PBRMaterial {
    const key = `${name}:${hex}:${emission ?? ""}`;
    const cached = this.surfaces.get(key);
    if (cached) return cached;
    const m = surface(this.scene, name, hex, emission);
    this.materials.push(m);
    this.surfaces.set(key, m);
    return m;
  }
  box(
    name: string,
    pos: Vector3,
    size: Vector3,
    mat: Material,
    solid = true,
  ): Mesh {
    const m = MeshBuilder.CreateBox(
      name,
      { width: size.x, height: size.y, depth: size.z },
      this.scene,
    );
    m.parent = this.root;
    m.position.copyFrom(pos);
    m.material = mat;
    m.checkCollisions = solid;
    m.isPickable = solid;
    m.receiveShadows = true;
    m.metadata = { world: solid };
    if (solid) {
      this.solids.push(m);
      if (
        /^(relay core|relay foundation|nexus core|nexus plinth|gallery|cover|cargo container|lab chamber|crane leg|server column|deck|loading deck)$/.test(
          name,
        )
      )
        this.shadows.addShadowCaster(m);
    }
    return m;
  }
  sign(
    text: string,
    pos: Vector3,
    w: number,
    h: number,
    color: string,
    ground = false,
    yaw = 0,
  ): void {
    const tex = new DynamicTexture(
      "sign " + text,
      { width: 1024, height: 256 },
      this.scene,
      false,
    );
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 1024, 256);
    tex.drawText(
      text,
      null,
      170,
      "bold 104px sans-serif",
      color,
      "transparent",
      true,
    );
    tex.hasAlpha = true;
    const mat = new StandardMaterial("sign", this.scene);
    mat.diffuseTexture = tex;
    mat.emissiveColor = new Color3(0.5, 0.5, 0.5);
    mat.backFaceCulling = false;
    mat.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST;
    mat.zOffset = -1;
    this.materials.push(mat);
    mat.disableLighting = true;
    const m = MeshBuilder.CreatePlane(
      "sign",
      { width: w, height: h },
      this.scene,
    );
    m.parent = this.root;
    m.position.copyFrom(pos);
    if (ground) m.rotation.x = Math.PI / 2;
    m.rotation.y = yaw;
    m.material = mat;
    m.isPickable = false;
  }
  dispose(): void {
    this.shadows.dispose();
    for (const light of this.lights) light.dispose();
    this.root.dispose();
    for (const material of this.materials) material.dispose(false, true);
    this.solids = [];
  }
  lineClear(a: Vector3, b: Vector3): boolean {
    const d = b.subtract(a),
      l = d.length();
    if (l < 0.01) return true;
    const hit = pickWorld(this.scene, new Ray(a, d.scale(1 / l), l));
    return !hit?.hit || hit.distance > l - 0.15;
  }
}

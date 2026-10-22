import type { Level } from "../world/Level";
import { maps } from "../world/MapData";
export interface MapPoint {
  x: number;
  z: number;
}
export interface MapState {
  player: MapPoint;
  yaw: number;
  ally?: MapPoint;
  allyDown?: boolean;
  objective?: MapPoint;
  radius?: number;
  contested?: boolean;
}
const NS = "http://www.w3.org/2000/svg";
export const mapPoint = (p: MapPoint): [number, number] => [
  (p.x + 24) * 5,
  (24 - p.z) * 5,
];
/** Static SVG map geometry is baked once; small marker transforms refresh at 10 Hz. */
export class TacticalMap {
  private attrs = new WeakMap<Element, Map<string, string>>();
  private dynamic: { node: SVGRectElement; enabled: () => boolean }[] = [];
  private last = -Infinity;
  private player: Element;
  private ally: Element;
  private objective: Element;
  constructor(private root: HTMLElement) {
    this.player = root.querySelector("#minimap-player")!;
    this.ally = root.querySelector("#minimap-ally")!;
    this.objective = root.querySelector("#minimap-objective")!;
  }
  private attr(node: Element, name: string, value: string): void {
    let cache = this.attrs.get(node);
    if (!cache) {
      cache = new Map();
      this.attrs.set(node, cache);
    }
    if (cache.get(name) !== value) {
      node.setAttribute(name, value);
      cache.set(name, value);
    }
  }
  configure(level: Level): void {
    const walls = this.root.querySelector("#minimap-walls")!,
      devices = this.root.querySelector("#minimap-devices")!;
    walls.replaceChildren();
    devices.replaceChildren();
    this.dynamic = [];
    this.last = -Infinity;
    const floor = document.createElementNS(NS, "rect");
    floor.setAttribute("x", "10");
    floor.setAttribute("y", "5");
    floor.setAttribute("width", "220");
    floor.setAttribute("height", "230");
    floor.setAttribute("fill", "#c5d2cb12");
    floor.setAttribute("stroke", "#d4e0da55");
    walls.append(floor);
    for (const mesh of level.solids) {
      if (mesh.name === "ground" || mesh.metadata?.entity) continue;
      mesh.computeWorldMatrix();
      const box = mesh.getBoundingInfo().boundingBox,
        min = box.minimumWorld,
        max = box.maximumWorld;
      if (max.y < 0.3) continue;
      const node = document.createElementNS(NS, "rect");
      const [x, y] = mapPoint({ x: min.x, z: max.z });
      for (const [key, value] of Object.entries({
        x,
        y,
        width: (max.x - min.x) * 5,
        height: (max.z - min.z) * 5,
      }))
        node.setAttribute(key, String(Math.round(value * 100) / 100));
      node.setAttribute(
        "class",
        mesh.metadata?.dynamic ? "radar-door" : "radar-wall",
      );
      (mesh.metadata?.dynamic ? devices : walls).append(node);
      if (mesh.metadata?.dynamic)
        this.dynamic.push({ node, enabled: () => mesh.isEnabled() });
    }
    this.root.querySelector("#radar-map")!.textContent =
      maps[level.mapId].title;
    const spawn = mapPoint(level.spawn);
    this.attr(
      this.player,
      "transform",
      `translate(${spawn[0].toFixed(2)} ${spawn[1].toFixed(2)}) rotate(0.0)`,
    );
    this.attr(this.ally, "visibility", "hidden");
    this.attr(this.objective, "visibility", "hidden");
  }
  update(state: MapState, now = performance.now()): void {
    if (now - this.last < 100) return;
    this.last = now;
    const p = mapPoint(state.player);
    this.attr(
      this.player,
      "transform",
      `translate(${p[0].toFixed(2)} ${p[1].toFixed(2)}) rotate(${((state.yaw * 180) / Math.PI).toFixed(1)})`,
    );
    this.attr(this.ally, "visibility", state.ally ? "visible" : "hidden");
    if (state.ally) {
      const a = mapPoint(state.ally);
      this.attr(
        this.ally,
        "transform",
        `translate(${a[0].toFixed(2)} ${a[1].toFixed(2)})`,
      );
      this.attr(this.ally, "class", state.allyDown ? "ally-down" : "");
    }
    this.attr(
      this.objective,
      "visibility",
      state.objective ? "visible" : "hidden",
    );
    if (state.objective) {
      const o = mapPoint(state.objective);
      this.attr(
        this.objective,
        "transform",
        `translate(${o[0].toFixed(2)} ${o[1].toFixed(2)})`,
      );
      this.attr(
        this.objective,
        "class",
        state.contested ? "radar-contested" : "",
      );
      this.attr(
        this.objective.firstElementChild!,
        "r",
        String((state.radius ?? 3) * 5),
      );
    }
    for (const d of this.dynamic)
      this.attr(d.node, "visibility", d.enabled() ? "visible" : "hidden");
  }
}

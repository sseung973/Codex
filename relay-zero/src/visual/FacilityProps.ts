import { Material, Mesh } from '@babylonjs/core';
import type { Level } from '../world/Level';
import { gameTheme } from './GameTheme';

export type DetailBox = (name: string, x: number, y: number, z: number,
  w: number, h: number, d: number, mat: Material) => Mesh;

/** Surface-mounted prop kits. Every kit uses an existing solid as its backing. */
export function buildFacilityProps(level: Level, box: DetailBox): void {
  const c = gameTheme.colors;
  const shell = level.material('prop painted metal', c.concrete);
  const frame = level.material('detail metal', c.metal);
  const trim = level.material('detail steel', c.steel);
  const rubber = level.material('prop rubber', c.rubber);
  const screen = level.material('console glass', c.glass);
  const amber = level.material('safety paint', c.amber);
  const white = level.material('ceramic panel', c.ivory);
  // Consoles are inset into the front wall, not placed across a walkable lane.
  for (const x of [-7, 7]) {
    const z = -21.38;
    box('console housing', x, 1.12, z, 1.25, 1.9, .12, frame);
    box('console face', x, .85, z + .09, 1.08, 1.22, .06, shell);
    box('console screen surround', x, 1.68, z + .09, 1.08, .63, .06, trim);
    box('console glass', x, 1.68, z + .13, .94, .49, .025, screen);
    for (let row = 0; row < 3; row++)
      box('console readout', x - .15, 1.8 - row * .12, z + .148,
        .5 - row * .09, .017, .008, white);
    box('console input rail', x, 1.27, z + .16, .95, .1, .08, rubber);
    box('console amber key', x + .32, 1.27, z + .206, .13, .035, .012, amber);
    for (let row = 0; row < 4; row++)
      box('console cooling slot', x, .48 + row * .07, z + .126, .65, .018, .012, frame);
  }
  for (const solid of level.solids) {
    const p = solid.position;
    const b = solid.getBoundingInfo().boundingBox.extendSize;
    if (/cover|crate/.test(solid.name) && !/cap|strap/.test(solid.name)) {
      // A pale inset, recessed handle, latches and corner caps establish a supply-case family.
      for (const side of [-1, 1]) {
        const z = p.z + side * (b.z + .018);
        box('case inset', p.x, p.y, z, b.x * 1.5, b.y * 1.45, .025, shell);
        box('case grip recess', p.x, p.y + b.y * .43, z + side * .02,
          Math.min(.7, b.x), .16, .025, rubber);
        box('case handle', p.x, p.y + b.y * .47, z + side * .036,
          Math.min(.48, b.x * .75), .045, .025, trim);
        for (const sx of [-1, 1]) {
          box('case latch', p.x + sx * b.x * .8, p.y + b.y * .55,
            z + side * .022, .13, .23, .04, frame);
          box('case foot bumper', p.x + sx * b.x * .78, p.y - b.y * .77,
            z, .23, b.y * .3, .07, rubber);
        }
      }
    }
    if (/gallery$|lab chamber|server column/.test(solid.name)) {
      const z = p.z - b.z - .025;
      const width = Math.min(1.35, b.x * 1.5);
      box('power service cabinet', p.x, 1.3, z, width, 2.3, .035, frame);
      box('power cabinet panel', p.x, 1.3, z - .027, width * .85, 2.08, .025, shell);
      box('generator vent recess', p.x, 1.82, z - .045, width * .66, .63, .018, rubber);
      for (let i = 0; i < 5; i++)
        box('generator vent blade', p.x, 1.57 + i * .11, z - .06,
          width * .61, .035, .024, trim);
      box('generator service stripe', p.x, 1.22, z - .046, width * .75, .055, .017, amber);
      box('generator base', p.x, .32, z - .05, width * .7, .13, .025, rubber);
    }
  }
}

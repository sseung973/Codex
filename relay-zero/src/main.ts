import { applyTheme } from "./visual/GameTheme";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./ui/style.css";
import { Game } from "./core/Game";
import { HUD } from "./ui/HUD";
import { loadSettings } from "./core/Settings";
document.getElementById("boot")?.remove();
applyTheme();
const hud = new HUD(loadSettings());
try {
  new Game(document.querySelector<HTMLCanvasElement>("#game")!, hud);
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown graphics error";
  hud.error(
    `3D rendering unavailable: ${message}. Enable hardware acceleration in desktop Chrome or Edge and reload.`,
  );
  for (const id of ["play", "practice"]) {
    const button = hud.el(id) as HTMLButtonElement;
    button.disabled = true;
    button.style.opacity = ".5";
  }
  hud.set("play", "WEBGL REQUIRED");
  hud.set("graphics-status", "GRAPHICS / UNAVAILABLE");
}

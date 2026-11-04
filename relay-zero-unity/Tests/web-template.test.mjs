import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function page() {
  const html = readFileSync(new URL("../Assets/WebGLTemplates/RelayZero/index.html", import.meta.url), "utf8");
  const values = {
    DATA_FILENAME: "game.data.unityweb", FRAMEWORK_FILENAME: "game.framework.js.unityweb",
    CODE_FILENAME: "game.wasm.unityweb", LOADER_FILENAME: "game.loader.js",
    "JSON.stringify(COMPANY_NAME)": '"RELAY ZERO"',
    "JSON.stringify(PRODUCT_NAME)": '"RELAY ZERO"',
    "JSON.stringify(PRODUCT_VERSION)": '"3.2.0-unity.3"'
  };
  const compiled = html.replace(/\{\{\{\s*(.*?)\s*\}\}\}/g, (_, name) => {
    assert(name in values, name);
    return values[name];
  });
  const elements = Object.fromEntries(["unity-canvas", "loading", "status", "progress", "failure"].map(id => [id, { hidden: false, addEventListener() {}, focus() { this.focused = true; } }]));
  let loader, received;
  const instance = {};
  const window = { devicePixelRatio: 2 };
  const context = vm.createContext({
    window, console,
    document: {
      getElementById: id => elements[id], createElement: () => ({}),
      body: { appendChild: script => { loader = script; } }
    },
    createUnityInstance: (canvas, config, progress) => {
      received = { canvas, config }; progress(.25); return Promise.resolve(instance);
    }
  });
  vm.runInContext(compiled.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return { elements, window, instance, loader, get received() { return received; } };
}

test("Compiled template uses relative Unity payload paths and preserves display pixel ratio", async () => {
  const p = page();
  assert.equal(p.loader.src, "Build/game.loader.js");
  p.loader.onload();
  await Promise.resolve();
  assert.equal(p.received.config.dataUrl, "Build/game.data.unityweb");
  assert.equal(p.received.config.frameworkUrl, "Build/game.framework.js.unityweb");
  assert.equal(p.received.config.codeUrl, "Build/game.wasm.unityweb");
  assert.equal(p.received.config.devicePixelRatio, 2);
  assert.equal(p.elements.progress.value, .25);
  assert.equal(p.window.unityInstance, p.instance);
  assert.equal(p.elements.loading.hidden, true);
  assert.equal(p.elements["unity-canvas"].focused, true);
});

test("Loader download failure presents a visible error instead of a false loaded state", () => {
  const p = page();
  p.loader.onerror();
  assert.equal(p.elements.loading.hidden, false);
  assert.equal(p.elements.failure.hidden, false);
  assert.match(p.elements.failure.textContent, /다운로드/);
});

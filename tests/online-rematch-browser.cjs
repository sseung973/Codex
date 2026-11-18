'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright');
const { createApp } = require('../server/index.cjs');

async function run() {
  const app = createApp();
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const pages = [], errors = [];
  try {
    for (let i = 0; i < 4; ++i) {
      const page = await browser.newPage(i === 2 ? {
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce',
      } : { viewport: { width: 1280, height: 900 } });
      page.on('pageerror', error => errors.push(error.message));
      pages.push(page);
      await page.goto('http://127.0.0.1:' + app.server.address().port);
      await page.locator('#title-enter').click();
      await page.locator('#lobby-friends-tab').click();
    }
    const [host, partner, receiver] = pages;
    await host.locator('[name=room-type][value=doubles]').check();
    await host.locator('[name=room-format][value="1"]').check();
    await host.locator('#room-create').click();
    await host.waitForFunction(() => shuttleRush.snapshot.online.room);
    const code = await host.locator('#room-number').innerText();
    for (const guest of pages.slice(1)) {
      await guest.locator('#room-code-input').fill(code);
      await guest.locator('#room-join').click();
      await guest.waitForFunction(() => shuttleRush.snapshot.online.room);
    }
    async function start() {
      for (const p of pages) await p.locator('#room-ready').click();
      await host.locator('#room-start').click();
      await Promise.all(pages.map(p => p.waitForFunction(() => shuttleRush.snapshot.state === 'serve')));
    }
    await start();
    assert.ok(await host.locator('#serve-options').isVisible(), 'server needs serve controls');
    for (const guest of pages.slice(1)) {
      assert.ok(await guest.locator('#serve-options').isHidden(), 'only the server should see serve controls');
    }
    await host.locator('[data-serve=short]').click();
    await host.keyboard.press('Space');
    await receiver.waitForFunction(() => shuttleRush.snapshot.rally === 1);

    // Place the in-flight shuttle at match point. The normal server step decides the landing and score.
    const match = app.rooms.rooms.get(code).match;
    match.score = [0, 10];
    match.ball = { x: 3.14, y: .002, z: 4, vx: 0, vy: -2, vz: 0 };
    match.activeServe = null;
    await Promise.all(pages.map(p => p.waitForFunction(() => shuttleRush.snapshot.state === 'over')));
    for (const [p, sign] of [[host, 1], [receiver, -1]]) {
      const s = await p.evaluate(() => shuttleRush.snapshot);
      assert.deepEqual(s.score, sign === 1 ? [0, 11] : [11, 0]);
      assert.ok(s.camera.lastCall?.edge.x === sign * 3.05, 'call must use the mirrored doubles sideline');
    }
    const box = receiver.locator('#line-call-detail rect').first();
    assert.ok(await box.count() > 0 && Math.abs(Number(await box.getAttribute('x')) - 114.4) < .01,
      'reduced-motion diagram should show the nearest doubles line');
    await host.locator('#resume').click();
    await host.locator('#room-start').click();
    for (const p of pages) {
      await p.waitForFunction(() => shuttleRush.snapshot.online.room.phase === 'waiting');
      const s = await p.evaluate(() => shuttleRush.snapshot);
      assert.ok(!s.online.active && s.screen === 'lobby' && s.lobby.tab === 'friends', 'everyone returns to the same waiting room');
      assert.ok(await p.locator('#room-ready').isVisible(), 'all players can immediately ready up');
    }
    await start();
    assert.equal(await host.locator('[data-serve=long]').getAttribute('aria-pressed'), 'true');
    await host.keyboard.press('Space');
    await partner.waitForFunction(() => shuttleRush.snapshot.rally === 1);
    assert.equal((await partner.evaluate(() => shuttleRush.snapshot)).lastShot.serve, 'long');
    assert.deepEqual(errors, []);
    console.log('PASS: four-client serve controls, mirrored doubles line replay, synchronized rematch and next serve');
  } finally {
    await browser.close();
    await app.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

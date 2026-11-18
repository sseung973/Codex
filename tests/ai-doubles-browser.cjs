'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright');
const { createApp } = require('../server/index.cjs');

const snapshot = page => page.evaluate(() => shuttleRush.snapshot);

async function swipe(page) {
  const cdp = await page.context().newCDPSession(page);
  const court = await page.locator('#court').boundingBox();
  const x = court.x + court.width * .60, y = court.y + court.height * .59;
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(30);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 50 }] });
    await page.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 4 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

async function run() {
  const app = process.env.LIVE_ORIGIN ? null : createApp();
  if (app) await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.LIVE_ORIGIN || 'http://127.0.0.1:' + app.server.address().port;
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [];

  async function enter(touch) {
    const page = await browser.newPage({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      hasTouch: touch,
      isMobile: touch,
      ignoreHTTPSErrors: Boolean(process.env.LIVE_ORIGIN)
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { timeout: 120000 });
    await page.locator('#title-enter').click();
    await page.locator('#lobby-friends-tab').click();
    return page;
  }

  try {
    for (const lineup of ['coop', 'versus']) {
      const host = await enter(false), guest = await enter(true);
      assert.ok(await host.locator('#room-lineup').isHidden());
      await host.locator('[name=room-type][value=doubles]').check();
      await host.locator('[name=room-lineup][value=' + lineup + ']').check();
      await host.locator('[name=room-format][value="1"]').check();
      await host.locator('#room-create').click();
      await host.waitForFunction(() => shuttleRush.snapshot.online.room);
      const code = await host.locator('#room-number').innerText();
      await guest.locator('#room-code-input').fill(code);
      await guest.locator('#room-join').click();
      await guest.waitForFunction(() => shuttleRush.snapshot.online.room);
      assert.equal((await snapshot(guest)).online.room.lineup, lineup);
      assert.equal(await guest.locator('#room-roster [data-bot]').count(), 2);
      assert.equal(await guest.locator('#room-roster img.room-avatar').count(),4);
      assert.equal(await guest.locator('#room-roster [data-state=bot]').count(),2);
      assert.ok(await guest.locator('#room-teams').isHidden());
      assert.ok(await host.locator('#room-start').isDisabled());
      for (const page of [host, guest]) await page.locator('#room-ready').click();
      await host.waitForFunction(()=>document.querySelectorAll('#room-roster [data-state=ready]').length===2);
      await host.locator('#room-start').click();
      await guest.waitForFunction(() => shuttleRush.snapshot.state === 'serve');
      assert.deepEqual((await snapshot(guest)).online.players.map(p => p.bot),
        lineup === 'coop' ? [false, false, true, true] : [false, true, false, true]);
      assert.ok(await guest.locator('#serve-options').isHidden());

      await guest.locator('[data-shot=clear]').click();
      await host.keyboard.press('Space');
      if (lineup === 'coop') {
        await guest.waitForFunction(() => {
          const s = shuttleRush.snapshot;
          return s.rally === 2 && s.lastShot.kind === 'ai';
        });
      }
      await guest.waitForFunction(() => {
        const s = shuttleRush.snapshot;
        return s.state === 'rally' && s.lastHit === 1 && s.contact?.t < .26 && s.contact?.t > .04;
      });
      await swipe(guest);
      const hit = lineup === 'coop' ? 3 : 2;
      await host.waitForFunction(({ hit, seat }) => {
        const s = shuttleRush.snapshot;
        return s.rally === hit && s.lastShot.player === seat && s.lastShot.kind === 'swipe';
      }, { hit, seat: lineup === 'coop' ? 1 : 2 });

      if (lineup === 'coop') {
        await host.waitForFunction(() => {
          const s = shuttleRush.snapshot;
          return s.rally === 1 && s.lastShot.kind === 'ai' && s.lastShot.judgement === 'serve';
        }, null, { timeout: 15000 });
      } else {
        assert.deepEqual((await snapshot(guest)).score, [0, 0]);
        await guest.reload();
        await guest.locator('#title-enter').click();
        await guest.waitForFunction(() => shuttleRush.snapshot.online.active && shuttleRush.snapshot.state === 'paused');
        await guest.locator('#resume').click();
        await host.waitForFunction(() => shuttleRush.snapshot.state === 'countdown');
      }
      await host.close();
      await guest.close();
      console.log('PASS ' + lineup + ' with desktop keyboard and phone swipe');
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    if (app) await app.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

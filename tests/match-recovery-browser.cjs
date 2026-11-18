'use strict';

const assert = require('node:assert/strict');
const {chromium} = require('/opt/codex/cua_node/lib/node_modules/playwright');
const {createApp} = require('../server/index.cjs');

const snapshot = page => page.evaluate(() => {
 const {state, screen, score, ball, rally} = shuttleRush.snapshot;
 return {state, screen, score, ball, rally};
});
const waitForState = (page, state) => page.waitForFunction(
 expected => shuttleRush.snapshot.state === expected, state, {timeout:10000}
);

async function enterFriends(browser, base, errors, width, height, touch = false) {
 const page = await browser.newPage({viewport:{width,height}, hasTouch:touch, isMobile:touch});
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(base, {timeout:90000});
 await page.waitForFunction(() => window.shuttleRush?.snapshot?.screen === 'title');
 await page.locator('#title-enter').click();
 await page.locator('#lobby-friends-tab').click();
 return page;
}

async function assertCodeError(page, pattern) {
 await page.waitForFunction(() => !document.getElementById('room-code-error').hidden);
 assert.match(await page.locator('#room-code-error').innerText(), pattern);
 assert.deepEqual(await page.evaluate(() => {
  const input = document.getElementById('room-code-input');
  const clip = document.querySelector('.lobby-content').getBoundingClientRect();
  const message = document.getElementById('room-code-error').getBoundingClientRect();
  return {
   focused: document.activeElement === input,
   invalid: input.getAttribute('aria-invalid'),
   visible: message.top >= clip.top - 1 && message.bottom <= clip.bottom + 1
  };
 }), {focused:true, invalid:'true', visible:true});
}

async function matchResult(page) {
 return page.evaluate(() => {
  const element = id => document.getElementById(id);
  return {
   title:element('pause-title').textContent,
   eyebrow:element('pause-eyebrow').textContent,
   copy:element('pause-copy').textContent,
   rally:element('summary-rally').textContent,
   shots:element('summary-shots').textContent,
   summary:!element('match-summary').hidden,
   pauseDisabled:element('pause').disabled,
   action:element('resume').textContent
  };
 });
}

(async () => {
 const app = process.env.LIVE_ORIGIN ? null : createApp();
 if (app) await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
 const base = process.env.LIVE_ORIGIN || 'http://127.0.0.1:' + app.server.address().port;
 const browser = await chromium.launch({
  executablePath:'/usr/bin/chromium',
  args:['--no-sandbox','--disable-dev-shm-usage']
 });
 const errors = [];
 try {
  for (const [width, height] of [[320,568],[390,844],[844,390],[834,1194]]) {
   const page = await enterFriends(browser, base, errors, width, height, true);
   const input = page.locator('#room-code-input');
   await input.fill('abc');
   await page.locator('#room-join').tap();
   await assertCodeError(page, /6자리/);
   if (width === 844) {
    await input.fill('IIIIII');
    assert.equal(await page.locator('#room-code-error').isHidden(),true);
    await page.locator('#room-join').tap();
    await assertCodeError(page, /방을 찾을 수 없어요/);
   }
   await page.close();
  }
  console.log('PASS inline room code errors on portrait, landscape and tablet');

  const host = await enterFriends(browser, base, errors, 1440, 900);
  const guest = await enterFriends(browser, base, errors, 390, 844, true);
  await host.locator('[name=room-format][value="1"]').check();
  await host.locator('#room-create').click();
  await host.locator('#room-number').waitFor({state:'visible'});
  await guest.locator('#room-code-input').fill(await host.locator('#room-number').innerText());
  await guest.locator('#room-join').tap();
  await host.locator('#room-ready').click();
  await guest.locator('#room-ready').tap();
  await host.locator('#room-start').click();
  await Promise.all([host,guest].map(page => waitForState(page,'serve')));

  await guest.locator('#settings').tap();
  await waitForState(host,'paused');
  assert.equal((await snapshot(guest)).screen,'lobby');
  await host.locator('#resume').click();
  await host.waitForFunction(() => document.getElementById('pause-copy').textContent.includes('모두 코트로 돌아오면'));
  const frozen = await snapshot(host);
  await host.waitForTimeout(3250);
  assert.deepEqual(await snapshot(host),frozen);
  await guest.locator('#menu-resume').tap();
  await Promise.all([host,guest].map(page => waitForState(page,'countdown')));
  await Promise.all([host,guest].map(page => waitForState(page,'serve')));

  await guest.locator('#controls-open').tap();
  await waitForState(host,'paused');
  await host.locator('#resume').click();
  await host.waitForFunction(() => document.getElementById('pause-copy').textContent.includes('모두 코트로 돌아오면'));
  await guest.locator('#controls-done').tap();
  await Promise.all([host,guest].map(page => waitForState(page,'countdown')));
  await Promise.all([host,guest].map(page => waitForState(page,'serve')));
  console.log('PASS settings and controls block all players until a shared countdown');

  await host.locator('#court').focus();
  await host.keyboard.press('Space');
  await host.waitForFunction(() => shuttleRush.snapshot.rally >= 1);
  await guest.locator('#settings').tap();
  await guest.locator('#lobby-friends-tab').tap();
  await guest.locator('#room-leave').tap();
  await waitForState(host,'over');
  await host.locator('#match-summary').waitFor({state:'visible'});
  const result = await matchResult(host);
  assert.equal(result.eyebrow,'MATCH FINISHED');
  assert.match(result.copy,/15 : 0 · 기권 종료/);
  assert.equal(result.rally,'1회');
  assert.equal(result.pauseDisabled,true);
  assert.match(result.action,/대기방으로/);
  await host.reload();
  await host.waitForFunction(() => window.shuttleRush?.snapshot?.screen === 'title');
  await host.locator('#title-enter').click();
  await waitForState(host,'over');
  await host.locator('#match-summary').waitFor({state:'visible'});
  assert.deepEqual(await matchResult(host),result);
  await host.locator('#resume').click();
  await host.locator('#room-start').click();
  await host.waitForFunction(() => shuttleRush.snapshot.online.room.phase === 'waiting');
  console.log('PASS reload restores the final score, match statistics and rematch action');
  assert.deepEqual(errors,[]);
 } finally {
  await browser.close();
  if (app) await app.close();
 }
})().catch(error => {
 console.error(error);
 process.exitCode = 1;
});

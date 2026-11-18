'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright');
const { load, assertRacketContact } = require('./browser-fixture.cjs');

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const snapshot = page => page.evaluate(() => shuttleRush.snapshot);

async function run() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const [width,height,mobile] of [[390,844,true],[844,390,true],[1366,920,false]]) {
      const page = await browser.newPage({ viewport: { width,height }, hasTouch: mobile, isMobile: mobile });
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now()+1000));
      await load(page,{beforeGame: p => p.evaluate(() => {
        const Base = ShuttlePhysics.Rally;
        ShuttlePhysics.Rally = class extends Base {
          constructor(...args) { super(...args); window.qaMatch = this; }
        };
      })});
      await page.locator('#start').click();
      await page.clock.runFor(32);

      for (const [shot,x,y,z] of [['drive',1.42,1.85,-6.15],['drive',-1.42,1.85,-6.15],['smash',-1.3,3.18,-6.15],['drop',1.4,.78,-4.8]]) {
        await page.locator('[data-shot='+shot+']').click();
        await page.evaluate(({x,y,z}) => {
          const m = window.qaMatch;
          m.time += 1;
          Object.assign(m.players[0],{x:0,z:-4.55,recovery:0,dive:null,impact:null});
          m.state = 'rally';
          m.rally = 1;
          m.cooldown = 0;
          m.lastHit = 1;
          m.pending = null;
          m.activeServe = null;
          m.ball = {x,y,z,vx:0,vy:-.25,vz:-.1};
          m.retarget(0);
        },{x,y,z});

        if (mobile) {
          const session = await page.context().newCDPSession(page);
          const r = await page.locator('#court').boundingBox(), sx = r.x+r.width*.57, sy = r.y+r.height*.58;
          try {
            await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
            await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:sy+40}]});
            await page.clock.runFor(40);
            await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:sy-20}]});
            await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          } finally { await session.detach(); }
        } else {
          await page.keyboard.press('Space');
        }
        let s;
        for (let i=0;i<14;i++) {
          await page.clock.runFor(8);
          s = await snapshot(page);
          if (s.lastHit===0) break;
        }
        assert.equal(s.lastHit,0,shot+' input must hit');
        assert.equal(s.lastShot.type,shot);
        assertRacketContact(s.visual.rackets[0]);
        assert.ok(distance(s.visual.rackets[0].impact,s.visual.impact.screen)<.001);
        for (const frame of [0,48,80,80]) {
          await page.clock.runFor(frame);
          const r = (await snapshot(page)).visual.rackets[0];
          const reach = distance(r,r.shoulderScreen)/(r.scale*.85);
          assert.ok(reach<=119.01, shot+' at '+width+'px stretched to '+reach.toFixed(1)+' model units');
        }
      }
      await page.close();
    }
    console.log('PASS: forehand, backhand, smash and drop stay within reach through follow-through on phone and desktop');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode=1; });

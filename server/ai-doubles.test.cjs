'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Rooms } = require('./rooms.cjs');

const swing = { shot: 'clear', power: .55, aim: 0, kind: 'keyboard' };

function setup(lineup) {
  let now = 1000;
  const rooms = new Rooms({ now: () => now, send: () => {} });
  const host = {}, guest = {};
  const room = rooms.create(host, { doubles: true, lineup });
  rooms.join(guest, { code: room.code });
  return { rooms, room, host, guest, elapse: ms => { now += ms; rooms.advance(0); } };
}

function stepUntil(match, condition) {
  for (let i = 0; i < 1400 && !condition(); ++i) match.step();
  assert.ok(condition(), 'expected transition from ' + match.state);
}

for (const [lineup, guestSeat, aiSeats] of [['coop', 1, [2, 3]], ['versus', 2, [1, 3]]]) {
  test(lineup + ' reserves two AI places and retains them through formation changes, resume and rematch', () => {
    const { rooms, room, host, guest, elapse } = setup(lineup);
    assert.equal(guest.seat, guestSeat);
    assert.throws(() => rooms.join({}, { code: room.code }));
    rooms.team(guest, { team: lineup === 'coop' ? 1 : 0 });
    assert.equal(guest.seat, guestSeat);
    rooms.formation(guest, { typeName: 'side-side' });
    assert.deepEqual(rooms.public(room).players.filter(p => p.bot).map(p => p.id), aiSeats);
    for (const id of aiSeats) assert.ok(room.members[id].ready && !room.members[id].token);
    rooms.ready(host);
    assert.throws(() => rooms.start(host));
    rooms.ready(guest);
    rooms.start(host);
    assert.equal(room.match.players.filter(p => p.bot).length, 2);
    elapse(91000);
    assert.equal(room.phase, 'playing');

    const token = room.members[guestSeat].token;
    rooms.disconnect(guest);
    assert.equal(room.match.state, 'paused');
    assert.throws(() => rooms.message(host, { type: 'resume' }));
    const restored = {};
    rooms.join(restored, { code: room.code, token });
    rooms.message(host, { type: 'resume' });
    stepUntil(room.match, () => room.match.state === 'serve');

    rooms.disconnect(restored, true);
    assert.equal(room.match.forfeit, true);
    rooms.reset(host);
    assert.equal(room.phase, 'waiting');
    for (const id of aiSeats) assert.ok(room.members[id]?.bot && room.members[id].ready);
    rooms.join(guest, { code: room.code });
    rooms.ready(guest);
    rooms.ready(host);
    rooms.start(host);
    assert.deepEqual(room.match.score, [0, 0]);
  });

  test(lineup + ' plays AI returns through normal racket contact and accepts a human counter', () => {
    const { rooms, room, host, guest } = setup(lineup);
    rooms.ready(host);
    rooms.ready(guest);
    rooms.start(host);
    const match = room.match;
    match.random = () => .5;
    assert.ok(match.strike(0, { ...swing, aim: lineup === 'versus' ? .8 : 0 }));
    stepUntil(match, () => match.rally === 2);
    assert.ok(match.players[match.lastHit].bot);
    assert.equal(match.lastShot.kind, 'ai');
    stepUntil(match, () => match.contacts[0]?.t < .32);
    assert.ok(match.strike(0, swing));
    stepUntil(match, () => match.rally === 3);
    assert.equal(match.lastHit, 0);

    if (lineup === 'coop') {
      stepUntil(match, () => match.rally === 4);
      stepUntil(match, () => match.state === 'serve');
      assert.deepEqual(match.score, [0, 1]);
      assert.ok(match.players[match.server].bot);
      assert.equal(match.rally, 0);
      stepUntil(match, () => match.rally === 1);
      assert.equal(match.lastShot.judgement, 'serve');
      assert.equal(match.lastShot.kind, 'ai');
    }
  });
}

test('a queued human return takes priority over the AI partner on the same serve', () => {
  const { rooms, room, host, guest } = setup('versus');
  rooms.ready(host);
  rooms.ready(guest);
  rooms.start(host);
  const match = room.match;
  match.random = () => .5;
  assert.ok(match.strike(host.seat, { ...swing, aim: .8 }));
  stepUntil(match, () => match.contacts[guest.seat]?.t < .28);
  assert.ok(match.strike(guest.seat, swing));
  stepUntil(match, () => match.rally === 2);
  assert.equal(match.lastHit, guest.seat);
  assert.equal(match.lastShot.kind, 'keyboard');
});

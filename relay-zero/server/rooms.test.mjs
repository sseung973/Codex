import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Rooms, validPose} from './rooms.mjs';
function fixture() { const out = new Map(); const rooms = new Rooms((id,m)=>out.get(id).push(m)); const add=id=>{out.set(id,[]);return rooms.connect(id);};return {rooms,out,add}; }
test('two ready clients load before room begins, rooms are isolated',()=>{
 const {rooms:r,out,add}=fixture();const a=add('a'),b=add('b'),c=add('c');r.receive(a,{type:'create',mode:'duel',map:'cargo'});const code=a.room.code;
 r.receive(b,{type:'join',code});r.receive(c,{type:'join',code});assert.equal(c.room,null);
 r.receive(a,{type:'ready',value:true});assert.equal(a.room.active,false);r.receive(b,{type:'ready',value:true});assert.equal(a.room.active,true);
 r.receive(a,{type:'loaded'});assert.equal(a.room.begun,false);r.receive(b,{type:'loaded'});assert.equal(a.room.begun,true);
 const n=out.get('a').length;r.receive(b,{type:'state',state:{hp:999}});assert.equal(out.get('a').length,n);
 r.receive(b,{type:'shot',o:[0,1,0],d:[0,0,1],weapon:'ar7',seq:1});assert.equal(out.get('a').at(-1).type,'shot');
 r.disconnect(a);assert.equal(r.rooms.size,0);assert.equal(b.room,null);assert.equal(out.get('b').at(-1).type,'closed');
});
test('invalid positions, invalid weapons, closed sessions and malformed creates rejected',()=>{const {rooms:r,add,out}=fixture();const a=add('a');r.receive(a,{type:'create',mode:'hack',map:'cargo'});assert.equal(a.room,null);assert.equal(out.get('a').at(-1).type,'error');assert.equal(validPose({p:[NaN,0,0],y:0,pitch:0,crouch:false}),false);assert.equal(validPose({p:[99,0,0],y:0,pitch:0,crouch:false}),false);r.disconnect(a);r.receive(a,{type:'create',mode:'coop',map:'nexus'});assert.equal(r.rooms.size,0);});
test('inactivity expires rooms and permits surviving sockets to create again',()=>{const {rooms:r,add}=fixture();const a=add('a');r.receive(a,{type:'create',mode:'coop',map:'nexus'},1000);r.sweep(1000+30*60*1000+1);assert.equal(r.rooms.size,0);});

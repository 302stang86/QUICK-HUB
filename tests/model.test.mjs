import test from 'node:test';
import assert from 'node:assert/strict';
import { betterRun, validateSave, blankProfile, validNickname } from '../Assets/WebGLTemplates/FDEC/game-model.mjs';
const old = {room:5,score:1000,elapsedMs:100000};
test('room outranks score and time',()=> {
  assert.equal(betterRun({room:6,score:1,elapsedMs:999999},old),true);
  assert.equal(betterRun({room:4,score:999999,elapsedMs:1},old),false);
});
test('score outranks time at equal rooms',()=> {
  assert.equal(betterRun({...old,score:1001,elapsedMs:999999},old),true);
  assert.equal(betterRun({...old,score:999,elapsedMs:1},old),false);
});
test('time breaks exact room and score ties',()=> {
  assert.equal(betterRun({...old,elapsedMs:99999},old),true);
  assert.equal(betterRun({...old,elapsedMs:100001},old),false);
  assert.equal(betterRun(old,old),false);
  assert.equal(betterRun(old,null),true);
});
test('nickname is bounded plain text',()=> {
  assert.equal(validNickname('Firefighter_1'),true);
  for(const n of ['ab','x'.repeat(17),'<img src=x>','🚒🚒🚒',null]) assert.equal(validNickname(n),false);
});
const payload = {...blankProfile('Firefighter'),room:1,score:300,elapsedMs:10000,saveId:'a'.repeat(32)};
test('valid save accepted',()=> assert.deepEqual(validateSave(payload),payload));
test('negative, fractional and oversized values rejected',()=> {
  for(const [key,value] of [['credits',-1],['nozzle',6],['foam',4],['cannon',1.5],['room',31],['score',NaN],['elapsedMs',0],['revision',-1],['saveId','invalid']])
    assert.throws(()=>validateSave({...payload,[key]:value}));
});
test('new profiles have no free upgrades or currency',()=> {
  const p=blankProfile('Responder');
  assert.equal(p.credits+p.nozzle+p.foam+p.cannon+p.revision,0);
  assert.throws(()=>blankProfile('!'));
});

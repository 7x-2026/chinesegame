import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,transition,restoreState,objective} from '../dist/game-state.js';
test('materials alone cannot skip meeting the quest character',()=>{
  let s=transition(freshState(),{type:'START'});s=transition(s,{type:'GET_RIBBON'});s=transition(s,{type:'GET_PAINT',color:'mint'});
  assert.equal(transition(s,{type:'COMPLETE',design:{title:'欢迎来玩'}}).completed,false);
});
test('a valid story preserves the chosen sign and learns words without duplicates',()=>{
  let s=freshState();for(const a of [{type:'START'},{type:'MEET_YU'},{type:'CAT_CLUE'},{type:'CAT_CLUE'},{type:'GET_RIBBON'},{type:'GET_PAINT',color:'peach'},{type:'COMPLETE',design:{color:'sun',motif:'flower',title:'一起逛集市'}}])s=transition(s,a);
  assert.equal(s.completed,true);assert.equal(s.words.length,6);assert.equal(s.design.motif,'flower');assert.equal(s.design.color,'sun');
  assert.deepEqual(restoreState(JSON.stringify(s)),s);assert.match(objective(s),/招牌做好/);
  assert.equal(transition(s,{type:'COMPLETE',design:{color:'mint'}}),s);
});
test('corrupt storage cannot create invalid complete progress or unsafe sign content',()=>{
  const s=restoreState(JSON.stringify({version:1,completed:true,words:['help','__proto__','<script>'],design:{title:'<img onerror=alert(1)>',color:'unknown'}}));
  assert.equal(s.completed,false);assert.equal(s.design.title,'欢迎来玩');assert.deepEqual(s.words,['help']);assert.deepEqual(restoreState('broken'),freshState());
});
test('material actions before starting and unknown colors do not create inventory',()=>{
  assert.equal(transition(freshState(),{type:'GET_RIBBON'}).ribbon,false);
  assert.equal(transition({...freshState(),started:true},{type:'GET_PAINT',color:'invalid'}).paint,false);
});

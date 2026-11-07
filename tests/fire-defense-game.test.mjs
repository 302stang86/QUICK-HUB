import test from 'node:test';
import assert from 'node:assert/strict';
import {WAVE,SPEED,Engine,firstHit,movementFromScreen,MAP,inSpawnBand,randomEdgeSpawn,clampToMap} from '../fire-defense/game-core.mjs';
import {blankProfile,betterRun,validateSave,validNickname} from '../fire-defense/game-model.mjs';
const create=()=>new Engine(blankProfile('Firefighter'),()=>.2);
// step() clamps dt to .05 s, so wait out the coin-collection window in real-sized steps.
// Jump the wave clock to just before the end, then run the closing step(s).
const closeRoom=e=>{e.waveTime=WAVE.duration-.02;let r=null;for(let i=0;i<4&&r===null;i++)r=e.step(.05);return r;};
test('new run spawns safe enemies and resets run only',()=>{const e=create();e.profile.nozzle=2;e.profile.credits=500;e.score=123;e.newRun();assert.equal(e.enemies.length,20);assert.equal(e.score,0);assert.equal(e.profile.credits,500);assert.equal(e.profile.nozzle,2);for(const p of e.enemies)assert.ok(Math.hypot(p.x-e.hero.x,p.y-e.hero.y)>3);});
test('diagonal movement is normalized and maps screen directions correctly',()=>{for(const [x,y]of[[1,0],[0,1],[1,1],[-1,1]]){const v=movementFromScreen(x,y);assert.ok(Math.abs(Math.hypot(v.x,v.y)-1)<1e-10);}const right=movementFromScreen(1,0);assert.ok(right.x>0&&right.y<0);const up=movementFromScreen(0,-1);assert.ok(up.x>0&&up.y>0);});
test('hose fires while moving and player stays inside arena',()=>{const e=create();e.newRun();e.step(.05,{x:1,y:0});assert.ok(e.shots.length>0);assert.ok(e.hero.x>0);for(let i=0;i<200;i++){e.enemies=[{x:-5,y:4,hp:1e8,maxHp:1e8,speed:0,timer:0,flash:0}];e.step(.05,{x:1,y:1});}assert.ok(Math.hypot(e.hero.x,e.hero.y)<=MAP.radius-.2+1e-9);});
test('swept collision catches a fast shot and selects first contact',()=>{const a={x:0,y:0},b={x:10,y:0};assert.ok(firstHit(a,b,{x:5,y:0},.4)<.5);assert.equal(firstHit(a,b,{x:5,y:2},.4),null);assert.equal(firstHit(a,b,a,.4),0);assert.ok(firstHit(a,b,{x:2,y:0},.4)<firstHit(a,b,{x:8,y:0},.4));});
test('cleared rooms reward credits and recover one health',()=>{const e=create();e.newRun();e.enemies=[];e.pending=[];e.specialQueue=[];e.health=3;assert.equal(e.step(.01),null);assert.equal(e.mode,'active');assert.equal(closeRoom(e),'checkpoint');assert.equal(e.mode,'clear');assert.equal(e.cleared,1);assert.equal(e.profile.credits,30);assert.equal(e.health,4);assert.equal(e.nextRoom(),true);assert.equal(e.room,2);assert.equal(e.mode,'active');});
test('room 30 ends a run as victory',()=>{const e=create();e.newRun();e.room=30;e.enemies=[];e.pending=[];e.specialQueue=[];e.step(.01);closeRoom(e);assert.equal(e.mode,'victory');assert.equal(e.cleared,30);assert.equal(e.nextRoom(),false);});
test('permanent equipment costs scale and cannot exceed cap',()=>{const e=create();e.profile.credits=10000;assert.equal(e.price('nozzle'),100);assert.equal(e.buy('nozzle'),true);assert.equal(e.profile.credits,9900);assert.equal(e.price('nozzle'),200);for(let i=0;i<4;i++)assert.ok(e.buy('nozzle'));assert.equal(e.buy('nozzle'),false);assert.equal(e.profile.nozzle,5);e.newRun();assert.equal(e.buy('foam'),false);});
test('special is locked until upgraded, consumes charge and has cooldown',()=>{const e=create();e.newRun();assert.equal(e.special(),false);e.profile.foam=1;e.enemies=[{x:e.hero.x,y:e.hero.y+1,hp:100,maxHp:100,charger:false,timer:0,flash:0,speed:0}];const before=e.charges;assert.equal(e.special(),true);assert.equal(e.charges,before-1);assert.equal(e.enemies[0].hp,95);assert.equal(e.special(),false);});
test('contact damage has a grace interval and defeat preserves upgrades',()=>{const e=create();e.profile.nozzle=3;e.newRun();e.grace=0;e.health=1;e.enemies=[{...e.hero,hp:100,maxHp:100,speed:0,timer:0,flash:0}];assert.equal(e.step(.01),'checkpoint');assert.equal(e.mode,'defeat');e.newRun();assert.equal(e.health,6);assert.equal(e.profile.nozzle,3);assert.equal(e.room,1);});
test('paused/non-active engine does not advance time',()=>{const e=create();e.step(.05);assert.equal(e.time,0);e.newRun();e.mode='clear';e.step(.05);assert.equal(e.time,0);});
test('leaderboard ranking uses rooms then score then ascending time',()=>{const a={room:3,score:100,elapsedMs:500};assert.ok(betterRun({...a,room:4,score:0},a));assert.ok(!betterRun({...a,room:2,score:10000},a));assert.ok(betterRun({...a,score:101,elapsedMs:999},a));assert.ok(betterRun({...a,elapsedMs:499},a));assert.ok(!betterRun(a,a));});
test('nickname and save payload validations reject forged shapes',()=>{assert.ok(validNickname('FDEC_1'));assert.ok(!validNickname('<img>'));const p={...blankProfile('Firefighter'),room:1,score:500,elapsedMs:1000,saveId:'a'.repeat(32)};assert.equal(validateSave(p),p);for(const [key,value]of[['credits',-1],['nozzle',6],['foam',4],['room',31],['elapsedMs',0],['score',1.5]])assert.throws(()=>validateSave({...p,[key]:value}));});

import {ENEMY_ROSTER,BASE_ENEMIES,MINI_BOSSES,BOSSES,roomLineup} from '../fire-defense/enemy-roster.mjs';
import {pinchZoom} from '../fire-defense/viewport.mjs';
test('map is round with five times the previous 24 × 18 area and hero starts each room at center',()=>{assert.equal(MAP.shape,'round');assert.ok(Math.abs(Math.PI*MAP.radius**2-24*18*5)<1e-6);const e=create();e.newRun();assert.deepEqual(e.hero,{x:0,y:0});e.hero={x:8,y:6};e.mode='clear';e.nextRoom();assert.deepEqual(e.hero,{x:0,y:0});});
test('random spawns cover the whole outer ring, stay inside the round wall and clear of the hero',()=>{let seed=418;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);const sides=new Set();for(let i=0;i<2000;i++){const p=randomEdgeSpawn(rng);assert.ok(inSpawnBand(p));assert.ok(Math.hypot(p.x,p.y)<=MAP.radius-MAP.margin+1e-9);assert.ok(Math.hypot(p.x,p.y)>3);if(p.x<=-13)sides.add('left');if(p.x>=13)sides.add('right');if(p.y<=-13)sides.add('bottom');if(p.y>=13)sides.add('top');}assert.equal(sides.size,4);const fallback=randomEdgeSpawn(()=>.5);assert.ok(inSpawnBand(fallback));});
test('hero and enemies are half size',()=>{for(const enemy of ENEMY_ROSTER){assert.ok(enemy.radius<=.5);assert.ok(enemy.visualScale<=.9);}assert.equal(BOSSES[0].radius,.5);assert.equal(MINI_BOSSES[0].visualScale,.65);});
test('all 55 enemies have distinct names and HP, damage and speed',()=>{assert.deepEqual([BASE_ENEMIES.length,MINI_BOSSES.length,BOSSES.length],[40,10,5]);for(const key of ['key','name','hp','attack','speed'])assert.equal(new Set(ENEMY_ROSTER.map(e=>e[key])).size,55,key);});
test('every enemy debuts as scheduled and major boss rooms exclude mini-bosses',()=>{for(const enemy of ENEMY_ROSTER){const lineup=roomLineup(enemy.unlock,()=>.99);assert.ok(lineup.some(e=>e.key===enemy.key),enemy.name);}for(let room=1;room<=30;room++){const lineup=roomLineup(room,()=>.2);assert.ok(lineup.every(e=>e.unlock<=room));if(room%6===0){assert.equal(lineup.filter(e=>e.tier==='boss').length,1);assert.equal(lineup.filter(e=>e.tier==='mini').length,0);}else assert.ok(lineup.every(e=>e.tier!=='boss'));}});
test('individual enemy attack damage preserves contact grace',()=>{const e=create();e.newRun();e.grace=0;e.cooldown=100;e.enemies=[{...MINI_BOSSES[0],x:0,y:0,id:42,timer:0,flash:0,maxHp:26}];e.step(.01);assert.equal(e.health,4.5);e.step(.05);assert.equal(e.health,4.5);});
test('projectiles survive beyond old map boundary',()=>{const e=create();e.newRun();e.cooldown=100;e.shots=[{x:8,y:0,vx:1,vy:0,life:1,damage:1}];e.enemies=[{x:-10,y:6,hp:100,maxHp:100,speed:0,timer:0,flash:0}];e.step(.05);assert.equal(e.shots.length,1);assert.ok(e.shots[0].x>8);});
test('pinch zoom clamps at 75 and 125 percent and handles invalid distances',()=>{assert.equal(pinchZoom(1,100,200),1.25);assert.equal(pinchZoom(1,100,10),.75);assert.equal(pinchZoom(1,100,110),1.1);assert.equal(pinchZoom(1.25,0,50),1.25);assert.equal(pinchZoom(1,100,100),1);});

import {WEAPONS,WEAPON_KEYS,UPGRADES,computeStats,rollUpgradeOffer} from '../fire-defense/weapons.mjs';
test('hose keeps the old stats; balloon and foam keep the reference ratios',()=>{const h=computeStats('hose',{nozzle:0},{});assert.equal(h.damage,1);assert.ok(Math.abs(h.interval-.19)<1e-12);assert.ok(Math.abs(WEAPONS.balloon.damage-22/12)<1e-12);assert.ok(Math.abs(WEAPONS.balloon.rate-.7/1.2)<1e-12);assert.ok(Math.abs(WEAPONS.foam.damage-10/12)<1e-12);assert.ok(WEAPONS.foam.homing);assert.ok(WEAPONS.balloon.knockback>0);assert.equal(WEAPONS.hose.speed,14);});
test('nozzle level still scales damage and fire rate',()=>{const a=computeStats('hose',{nozzle:5},{});assert.ok(Math.abs(a.damage-2.75)<1e-12);assert.ok(Math.abs(a.interval-.19/1.4)<1e-12);});
test('upgrade modifiers follow the reference table',()=>{const s=computeStats('hose',{},{front_stream:2,multi_burst:1,ricochet:1,chain_bounce:1,pressure_point:2,quick_pump:1});assert.equal(s.projectiles,3);assert.equal(s.bursts,2);assert.ok(s.bounce);assert.equal(s.chain,1);assert.ok(Math.abs(s.chainKeep-.8)<1e-12);assert.ok(Math.abs(s.critChance-.29)<1e-12);assert.ok(Math.abs(s.critMult-2.4)<1e-12);assert.ok(Math.abs(s.damage-.85**2*.9*.9)<1e-12);assert.ok(Math.abs(s.interval-.19/(.85*1.25))<1e-12);});
test('stacks never exceed their maximum and crit chance stays under the cap',()=>{assert.ok(Math.abs(computeStats('hose',{},{pressure_point:99}).critChance-.53)<1e-12);assert.equal(computeStats('hose',{},{front_stream:99}).projectiles,4);});
test('upgrade offers: three distinct, skip maxed ones, picked only after a cleared room and reset each run',()=>{let seed=7;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);const o=rollUpgradeOffer({},rng);assert.equal(new Set(o).size,3);const all=Object.fromEntries(UPGRADES.map(u=>[u.id,u.max]));assert.deepEqual(rollUpgradeOffer(all,rng),[]);const e=new Engine(blankProfile('Firefighter'),rng);e.newRun();assert.equal(e.chooseUpgrade('quick_pump'),false);e.enemies=[];e.pending=[];e.specialQueue=[];e.step(.01);closeRoom(e);assert.equal(e.mode,'clear');assert.equal(e.offer.length,3);assert.equal(e.chooseUpgrade('not_offered'),false);const id=e.offer[0];assert.equal(e.chooseUpgrade(id),true);assert.equal(e.upgrades[id],1);assert.equal(e.offer.length,0);e.newRun();assert.deepEqual(e.upgrades,{});});
test('weapon can only be changed between runs',()=>{const e=create();assert.equal(e.setWeapon('balloon'),true);e.newRun();assert.equal(e.setWeapon('foam'),false);assert.equal(e.weapon,'balloon');e.mode='defeat';assert.equal(e.setWeapon('foam'),true);assert.equal(e.setWeapon('nope'),false);});
test('weapon fires only inside its range and extra streams multiply shots',()=>{const e=create();e.newRun();e.grace=99;e.enemies=[{x:0,y:30,hp:1e6,maxHp:1e6,speed:0,timer:0,flash:0}];e.step(.01);assert.equal(e.shots.length,0);e.enemies[0].y=10;e.upgrades={front_stream:2};e.step(.01);assert.equal(e.shots.length,3);});
test('multi-burst queues follow-up volleys',()=>{const e=create();e.newRun();e.grace=99;e.upgrades={multi_burst:2};e.enemies=[{x:0,y:10,hp:1e6,maxHp:1e6,speed:0,timer:0,flash:0}];e.step(.01);assert.equal(e.shots.length,1);e.step(.05);e.step(.05);assert.equal(e.shots.length,2);e.step(.05);e.step(.05);assert.equal(e.shots.length>=3,true);});
test('chain splash hops to the next enemy and keeps 80% damage per hop',()=>{const e=create();e.newRun();e.grace=99;e.cooldown=100;const a={x:2,y:0,hp:100,maxHp:100,speed:0,timer:0,flash:0,radius:.4},b={x:3,y:0,hp:100,maxHp:100,speed:0,timer:0,flash:0,radius:.4};e.enemies=[a,b];e.shots=[{x:0,y:0,vx:14,vy:0,speed:14,life:2,damage:3,chain:1,chainKeep:.8,hit:new Set()}];for(let i=0;i<10;i++)e.step(.05);assert.ok(Math.abs(a.hp-97)<1e-9);assert.ok(Math.abs(b.hp-(100-3*.8))<1e-9);});
test('axe hits knock back regular enemies more than bosses',()=>{const e=create();e.newRun();const base={x:5,y:0,hp:100,maxHp:100,speed:0,timer:0,flash:0},boss={...base,tier:'boss'};const shot={vx:9,vy:0,knock:5};e.knockback(base,shot);e.knockback(boss,shot);assert.equal(base.kvx,5);assert.ok(Math.abs(boss.kvx-1)<1e-12);assert.equal(base.kt,.18);});
test('bouncing streams reflect off the round wall instead of leaving it',()=>{const e=create();e.newRun();e.grace=99;e.cooldown=100;e.enemies=[{x:0,y:0,hp:1e6,maxHp:1e6,speed:0,timer:0,flash:0,radius:.01}];e.hero={x:0,y:0};e.shots=[{x:MAP.radius-1,y:0,vx:14,vy:0,speed:14,life:2,damage:1,bounce:true,hit:new Set()}];for(let i=0;i<6;i++)e.step(.05);assert.equal(e.shots.length,1);assert.ok(e.shots[0].vx<0);assert.ok(Math.hypot(e.shots[0].x,e.shots[0].y)<=MAP.radius);});
test('homing foam bends toward an enemy',()=>{const e=create();e.newRun();e.grace=99;e.cooldown=100;e.enemies=[{x:6,y:6,hp:1e6,maxHp:1e6,speed:0,timer:0,flash:0,radius:.2}];e.shots=[{x:0,y:0,vx:10,vy:0,speed:10,life:2,damage:1,homing:true,hit:new Set()}];e.step(.05);assert.ok(e.shots[0].vy>0);assert.ok(Math.abs(Math.hypot(e.shots[0].vx,e.shots[0].vy)-10)<1e-9);});

test('waves last 5:00 and the swarm arrives progressively with no end grace',()=>{
  assert.equal(WAVE.duration,300);
  const e=create();e.newRun();e.hero={x:0,y:0};e.health=1e9;e.maxHealth=1e9;
  const seen=[];let result=null,t=0,n=0;
  while(result===null&&n<8000){result=e.step(.05);t+=.05;n++;if(n%1200===0)seen.push(e.spawned);if(n%20===0)e.enemies=[];}
  assert.equal(e.mode,'clear');assert.ok(t>=299&&t<301.5,'ended at '+t);
  assert.ok(seen.length>=4&&seen[0]<seen[2]&&seen[2]<seen[3],'spawns grow: '+seen);
  assert.equal(e.endTimer,null);assert.equal(e.enemies.length,0);
  const gaps=seen.map((v,i)=>v-(seen[i-1]||0));assert.ok(gaps.every(v=>v>=200),'mass arrivals every minute: '+gaps);
});
test('wave end auto-collects every coin left on the field',()=>{
  const e=create();e.newRun();e.enemies=[];e.pending=[];e.specialQueue=[];
  e.coins=[{x:20,y:20,value:7},{x:-20,y:5,value:11}];const before=e.profile.credits;
  closeRoom(e);assert.equal(e.mode,'clear');assert.equal(e.coins.length,0);
  assert.equal(e.profile.credits,before+18+25+e.room*5);
});
test('boss is released at half time and hero/enemies move faster',()=>{
  const e=create();e.newRun();e.room=6;e.spawnRoom();e.health=1e9;
  assert.ok(e.specialQueue.length>0);e.waveTime=WAVE.duration*.5-.1;e.step(.05);e.step(.1);
  assert.equal(e.specialQueue.length,0);assert.ok(SPEED.hero>1&&SPEED.enemy>1);
  const f=create();f.newRun();f.enemies=[];f.pending=[];f.step(1/20,{x:1,y:0});assert.ok(Math.abs(f.hero.x-3.6*SPEED.hero/20)<1e-9);
});

import {SWARM_ENEMIES,swarmPool} from '../fire-defense/enemy-roster.mjs';
import {RAID} from '../fire-defense/game-core.mjs';
test('20 distinct swarm raiders: low HP, medium attack, fast, no coin reward, kept out of the regular roster',()=>{
  assert.equal(SWARM_ENEMIES.length,20);assert.equal(new Set(SWARM_ENEMIES.map(e=>e.name)).size,20);assert.equal(new Set(SWARM_ENEMIES.map(e=>e.palette+e.shape)).size,20);
  for(const s of SWARM_ENEMIES){assert.ok(s.hp<=7&&s.hp>=2);assert.ok(s.attack>=.8&&s.attack<=1.3);assert.ok(s.speed>=1.9);assert.equal(s.reward,0);assert.equal(s.tier,'swarm');}
  assert.ok(!ENEMY_ROSTER.some(e=>e.tier==='swarm'));assert.ok(swarmPool(1).length>=2);assert.equal(swarmPool(30).length,20);
});
test('swarm attacks trigger at 1:00 and each minute, finale at 4:30, in tight groups',()=>{
  assert.deepEqual([RAID.first,RAID.every,RAID.finale],[60,60,270]);
  const e=create();e.newRun();e.health=1e9;e.maxHealth=1e9;e.hero={x:0,y:0};e.enemies=[];e.pending=[];
  const count=()=>e.enemies.filter(x=>x.tier==='swarm').length;
  e.waveTime=59.9;e.step(.05);assert.equal(count(),0);e.waveTime=60;e.step(.01);const n=count();assert.ok(n>=8,'first raid '+n);
  const xs=e.enemies.filter(x=>x.tier==='swarm');const d=Math.max(...xs.map(a=>Math.hypot(a.x-xs[0].x,a.y-xs[0].y)));assert.ok(d<=RAID.spread*2+.01,'grouped '+d);
  assert.match(e.roomEvent,/SWARM/);
  e.enemies=[];e.waveTime=120;e.step(.01);assert.ok(count()>=8);
  e.enemies=[];e.nextRaid=300;e.waveTime=269.9;e.step(.05);assert.equal(count(),0);e.waveTime=270;e.step(.01);assert.ok(count()>=RAID.baseSize*2,'finale '+count());assert.match(e.roomEvent,/FINALE/);
  const c=count();e.waveTime=271;e.step(.01);assert.equal(count(),c,'finale fires once');
});
test('swarm raiders drop no coins and killing one does not count toward regular progress',()=>{
  const e=create();e.newRun();e.enemies=[];e.pending=[];e.coins=[];
  e.spawnRaid(false);const s=e.enemies[0];const reg=e.defeatedRegular;e.damage(s,999);
  assert.equal(e.coins.length,0);assert.equal(e.defeatedRegular,reg);assert.ok(e.score>=15);
});

test('regression: an empty map with only a hydrant mid-wave does not crash the step loop',()=>{
  const e=create();e.newRun();e.enemies=[];e.pending=[];e.specialQueue=[];e.hydrants=[{x:2,y:0,hp:12,maxHp:12,flash:0,id:99}];
  for(let i=0;i<40;i++)e.step(.05,{x:1,y:0});
  assert.equal(e.mode,'active');
  e.hydrants=[];for(let i=0;i<40;i++)e.step(.05,{x:0,y:1});assert.equal(e.mode,'active');
});
test('long timed waves with movement run to completion in every room band',()=>{
  let seed=5;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
  for(const room of [1,6,13,30]){const e=new Engine(blankProfile('Firefighter'),rng);e.newRun();e.room=room;e.spawnRoom();e.health=e.maxHealth=1e9;
    for(let i=0;i<6100&&e.mode==='active';i++)e.step(.05,{x:Math.sin(i/40),y:Math.cos(i/55)});assert.notEqual(e.mode,'active','room '+room);}
});

// Rendering the first damaged enemy must not stop requestAnimationFrame.
import {drawFireEnemy} from '../fire-defense/enemy-art.mjs';
test('damaged enemy health bars render for every roster entry',()=>{
  const previous=globalThis.Path2D;
  globalThis.Path2D=class {};
  const gradient={addColorStop(){}};
  const context=new Proxy({}, {get:(o,k)=>o[k]??(k.startsWith('create')?()=>gradient:()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  try{
    for(const enemy of [...ENEMY_ROSTER,...SWARM_ENEMIES]){
      assert.doesNotThrow(()=>drawFireEnemy(context,{...enemy,x:0,y:0,unit:25,time:2,id:1,hp:enemy.hp/2,maxHp:enemy.hp,charger:enemy.tier==='mini'||enemy.tier==='boss'}),enemy.name);
    }
  }finally{if(previous===undefined)delete globalThis.Path2D;else globalThis.Path2D=previous;}
});

import {scaleEnemy,SPAWN} from '../fire-defense/game-core.mjs';
test('all enemy types scale health and attack directly with wave without mutating base stats',()=>{
  for(const type of [...ENEMY_ROSTER,...SWARM_ENEMIES]){
    const base={...type},one=scaleEnemy(type,1),ten=scaleEnemy(type,10);
    assert.equal(one.hp,type.hp);assert.equal(one.attack,type.attack);
    assert.equal(ten.hp,one.hp*10);assert.equal(ten.attack,one.attack*10);
    assert.ok(ten.speed>one.speed&&ten.speed<one.speed*2);assert.deepEqual(type,base);
  }
});
test('constant mass spawning refills cleared enemies throughout the wave and respects the cap',()=>{
  const e=create();e.newRun();e.health=1e9;e.cooldown=1e9;
  for(let second=0;second<295;second++){
    e.enemies=[];const before=e.spawned;
    for(let i=0;i<20;i++)e.step(.05);
    assert.ok(e.spawned-before>=3,'continuous spawning at second '+second);
  }
  assert.ok(e.spawned>1100);
  e.enemies=Array.from({length:SPAWN.maxAlive},()=>({...BASE_ENEMIES[0],x:10,y:10,timer:0,flash:0}));
  const before=e.spawned;e.advanceSpawns(.05);assert.equal(e.spawned,before);
  e.spawnRaid(true);assert.equal(e.enemies.length,SPAWN.maxAlive);
});
test('regular enemies and raiders use the same wave scaling',()=>{
  const e=create();e.newRun();e.room=10;e.enemies=[];e.spawnOne(BASE_ENEMIES[0]);
  assert.equal(e.enemies[0].hp,BASE_ENEMIES[0].hp*10);
  assert.equal(e.enemies[0].maxHp,e.enemies[0].hp);
  e.enemies=[];e.spawnRaid(false);
  for(const enemy of e.enemies){const base=SWARM_ENEMIES.find(x=>x.key===enemy.key);assert.equal(enemy.hp,base.hp*10);assert.equal(enemy.attack,base.attack*10);}
  assert.equal(RAID.spread,3.5);assert.ok(e.enemies.length>=50);
});

import {COIN} from '../fire-defense/game-core.mjs';
test('blue drops include swarm kills, guarantee fifth kill, and cannot duplicate on dead enemies',()=>{
  const e=new Engine(blankProfile('Firefighter'),()=>.99);e.newRun();e.enemies=[];
  for(let i=0;i<5;i++){e.spawnOne(SWARM_ENEMIES[0]);e.damage(e.enemies[0],999);}
  assert.equal(e.blueCoins.length,1);assert.equal(e.coins.length,0);
  e.spawnOne(BASE_ENEMIES[0]);const target=e.enemies[0];e.damage(target,999);const n=e.blueCoins.length;e.damage(target,999);assert.equal(e.blueCoins.length,n);
});
test('gold and blue coins collect at expanded range; power pauses all simulation until selection and countdown',()=>{
  const e=create();e.newRun();e.enemies=[];e.pending=[];e.specialQueue=[];
  assert.equal(e.pickupRange(),3);e.coins=[{x:2.8,y:0,value:7}];e.blueCoins=[{x:2.8,y:0,value:18}];
  assert.equal(e.step(.01),'upgrade');assert.equal(e.profile.credits,7);assert.equal(e.power,18);assert.equal(e.offer.length,3);
  const time=e.time,wave=e.waveTime,hero={...e.hero};e.step(.05,{x:1,y:0});assert.equal(e.time,time);assert.equal(e.waveTime,wave);assert.deepEqual(e.hero,hero);
  assert.equal(e.chooseUpgrade('invalid'),false);assert.equal(e.chooseUpgrade(e.offer[0]),true);
  assert.equal(e.power,3);assert.equal(e.powerCost(),24);assert.equal(e.resumeLeft,3);
  for(let i=0;i<60;i++)e.step(.05,{x:1,y:0});assert.equal(e.waveTime,wave);assert.deepEqual(e.hero,hero);
  for(let i=0;i<3;i++)e.step(.05);assert.ok(e.waveTime>wave);
});
test('gold magnet purchases increase both pickup ranges, enforce price and cap, and last one run',()=>{
  const e=create();e.newRun();assert.equal(e.buyMagnet(),false);e.profile.credits=1000;
  for(let i=0;i<5;i++)assert.equal(e.buyMagnet(),true);
  assert.equal(e.pickupRange(),10.5);assert.equal(e.profile.credits,400);assert.equal(e.buyMagnet(),false);
  e.upgrades.coin_magnet=2;assert.equal(e.pickupRange(),13.5);
  e.mode='clear';e.nextRoom();assert.equal(e.magnetLevel,5);assert.equal(e.upgrades.coin_magnet,2);
  e.newRun();assert.equal(e.magnetLevel,0);assert.equal(e.pickupRange(),COIN.range);
});
test('power costs cap at 75 and recovery heals without losing excess blue power',()=>{
  const e=create();e.newRun();e.power=100;e.health=2;e.mode='upgrade';e.offer=['emergency_recovery'];
  assert.equal(e.chooseUpgrade('emergency_recovery'),true);assert.equal(e.health,4);assert.equal(e.power,85);
  e.powerLevel=100;assert.equal(e.powerCost(),75);
  assert.equal(e.stats().damage,computeStats(e.weapon,e.profile,{}).damage*1.5);
});

test('game initializes upgrade HUD before first resize and can load a saved profile',async()=>{
  const fs=await import('node:fs/promises');
  const markup=await fs.readFile(new URL('../fire-defense/index.html',import.meta.url),'utf8');
  const nodes=new Map(),noop=()=>{},events=new Map();
  const listen=(key,fn)=>events.set(key,fn);
  const context=new Proxy({}, {get:()=>noop});
  function element(){return {hidden:false,style:{},firstChild:{},addEventListener(name,fn){this.listeners??={};this.listeners[name]=fn;},setPointerCapture:noop,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),getContext:()=>context,querySelector:()=>({}),replaceChildren:noop,append:noop,focus:noop,
    set innerHTML(value){for(const match of value.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element());}};}
  for(const match of markup.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element());
  const doc={getElementById:id=>nodes.get(id)||null,createElement:element,addEventListener:noop,body:{append(node){nodes.set(node.id,node);}}};
  const globals={document:doc,window:{addEventListener:(name,fn)=>listen('window:'+name,fn)},addEventListener:(name,fn)=>listen(name,fn),innerWidth:1200,innerHeight:700,devicePixelRatio:1,Image:class {},requestAnimationFrame:noop};
  const previous=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  try{
    for(const [k,v] of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
    const {game}=await import('../fire-defense/game.js?startup-regression');
    assert.ok(nodes.has('power-meter'));assert.ok(nodes.has('resume-countdown'));
    game.loadProfile({...blankProfile('SavedPlayer'),credits:321,nozzle:2});
    assert.equal(game.loaded,true);assert.equal(game.engine.profile.nickname,'SavedPlayer');assert.equal(game.engine.profile.credits,321);
    assert.equal(nodes.get('continue').disabled,true);
    assert.equal(game.engine.setWeapon('foam'),true);game.updateView();assert.equal(nodes.get('continue').disabled,false);
    game.engine.newRun();nodes.get('gate').hidden=true;
    const canvas=nodes.get('canvas'),zone=nodes.get('joystick-zone');
    const touch=(id,target=canvas)=>({pointerType:'touch',pointerId:id,target,clientX:40,clientY:40,preventDefault:noop});
    events.get('window:pointerdown')(touch(1,zone));assert.equal(game.touchPoints.size,0);
    events.get('window:pointerdown')(touch(2));events.get('window:pointerdown')(touch(3));assert.equal(game.pinchActive,true);
    events.get('window:pointerup')(touch(3));assert.equal(game.pinchActive,false);
    game.pointer=null;zone.listeners.pointermove({...touch(4,zone),buttons:1,clientX:90,clientY:50});assert.equal(game.pointer,4);assert.ok(game.stick.x>0);
    game.keys.add('d');zone.listeners.pointercancel(touch(4,zone));assert.equal(game.pointer,null);assert.equal(game.keys.has('d'),true);
    game.block('Signed out');assert.equal(game.loaded,false);
  }finally{for(const [k,d] of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
});

test('wave end clears free upgrades and blue progress while gold gear, magnet and primary weapon carry',()=>{
  const e=create();e.setWeapon('balloon');e.profile.nozzle=2;e.profile.foam=1;e.profile.credits=100;e.newRun();e.buyMagnet();
  e.upgrades={pressure_boost:3,shield_orbs:2,healing_orbs:1};e.power=14;e.powerLevel=2;e.enemies=[];
  closeRoom(e);assert.deepEqual(e.upgrades,{});assert.equal(e.power,0);assert.equal(e.powerCost(),15);assert.equal(e.magnetLevel,1);assert.equal(e.profile.nozzle,2);assert.equal(e.weapon,'balloon');
  const pick=e.offer.find(x=>x!=='emergency_recovery')||e.offer[0];e.chooseUpgrade(pick);const upcoming={...e.upgrades};e.nextRoom();assert.deepEqual(e.upgrades,upcoming);assert.equal(e.weapon,'balloon');
});
test('attack orbs have distinct damage, slowing and chain effects without repeated hits inside cooldown',()=>{
  for(const kind of ['frost_orbs','flame_orbs','storm_orbs']){
    const e=create();e.newRun();e.enemies=[];e.upgrades={[kind]:1};
    const target={...BASE_ENEMIES[0],x:2.3,y:0,hp:100,maxHp:100},near={...BASE_ENEMIES[0],x:3.5,y:0,hp:100,maxHp:100};e.enemies=[target,near];
    e.updateOrbitals(e.stats(),0);assert.ok(target.hp<100);
    assert.equal(!!target.slowT,kind==='frost_orbs');assert.equal(near.hp<100,kind==='storm_orbs');
    const hp=target.hp;e.updateOrbitals(e.stats(),0);assert.equal(target.hp,hp);
    if(kind==='flame_orbs')assert.equal(target.hp,98.5);
  }
});
test('defensive and support orbs have capped mitigation, timed healing and limited haste',()=>{
  const e=create();e.newRun();e.cooldown=1e6;e.grace=0;e.upgrades={shield_orbs:2};
  e.enemies=[{x:0,y:0,hp:1e6,maxHp:1e6,speed:0,attack:2,timer:0,flash:0}];e.step(.01);assert.equal(e.health,4.6);
  e.enemies=[];e.upgrades={healing_orbs:2};e.health=3;
  for(let i=0;i<401;i++)e.updateOrbitals(e.stats(),.05);assert.equal(e.health,4);
  e.upgrades={haste_orbs:2};const base=computeStats(e.weapon,e.profile,{});assert.ok(Math.abs(e.stats().interval-base.interval/1.16)<1e-10);
  const x=e.hero.x;e.step(.05,{x:1,y:0});assert.ok(Math.abs(e.hero.x-x-3.6*SPEED.hero*1.16*.05)<1e-10);
  e.upgrades={frost_orbs:4,flame_orbs:3,storm_orbs:3,shield_orbs:2,healing_orbs:2,haste_orbs:2};assert.equal(e.orbActors().length,16);assert.equal(new Set(e.orbActors().map(x=>x.color)).size,6);
});

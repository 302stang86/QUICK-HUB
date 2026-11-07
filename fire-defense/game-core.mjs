import {roomLineup,swarmPool} from './enemy-roster.mjs';
import {WEAPONS,UPGRADE_BY_ID,computeStats,rollUpgradeOffer,SPLASH_DAMAGE,PUDDLE,CHAIN,SPREAD_DEG,ORBIT} from './weapons.mjs';
export const ROOM_LIMIT = 30;
// Round arena. The previous 24 × 18 rectangle was 432 units²; this disc is five times that
// area (2,160 units², about 52.4 units across). width/height are the diameter, kept for callers
// that only need the overall extent.
// Waves arrive progressively: a small first group, then a steady stream. Any mini-boss or boss is held
// back until half of the wave's regular enemies have been defeated.
// Pickups: hydrants spawn at random times, drop a bonus when destroyed; every kill drops a coin.
export const HYDRANT={hp:12,radius:.4,minDelay:10,maxDelay:30,maxAlive:2};
export const BONUS={life:12,pickRadiusPx:34,coinsBase:30,coinsPerRoom:3,bombRadius:4.5,bombDamage:6,timedSeconds:8,types:['coins','upgrade','bomb','timed']};
export const COIN={range:3,dropChance:.25,magnetStep:1.5,magnetMax:5};   // pickup radius; whatever is left on the field is auto-collected when the wave timer ends
// Timed waves: every wave lasts `duration` seconds. The swarm arrives progressively (slow start, heavy finish): the
// cumulative spawn count follows (t/duration)^ramp. A mini-boss / boss is released at `specialAt` of the wave time.
export const WAVE={duration:300,baseRate:4,perRoomRate:.4,ramp:1};
// Triggered swarm attacks: a pack of raiders at 1:00 and every 60 s after, then a bigger finale at 4:30.
export const RAID={first:60,every:60,finale:270,baseSize:30,perRoom:2,maxSize:80,finaleFactor:2.5,maxFinale:160,spread:3.5};
export const SPAWN={initial:20,maxAlive:320,specialAt:.5};
// Health and contact damage scale directly with wave; speed rises 3% per wave, capped at 1.9×.
export function scaleEnemy(type,room){
  const level=Math.max(1,Math.floor(room));
  return {...type,hp:type.hp*level,attack:type.attack*level,speed:type.speed*Math.min(1.9,1+(level-1)*.03)};
}
// Faster play: hero and enemy movement multipliers (enemy table speeds stay as the base values).
export const SPEED={hero:1.3,enemy:1.4};
const OLD_AREA=24*18,AREA_FACTOR=5,RADIUS=Math.sqrt(OLD_AREA*AREA_FACTOR/Math.PI);
export const MAP={shape:'round',radius:RADIUS,width:RADIUS*2,height:RADIUS*2,edgeBand:.5,margin:.6};
// Hero and enemy bodies are half their previous size, so their contact padding is halved as well.
export const HERO_RADIUS=.13,HERO_PAD=.2,ENEMY_PAD=.18;
export function inSpawnBand(p){return Math.hypot(p.x,p.y)>=MAP.radius*MAP.edgeBand-1e-9;}
/** Keep a point (mutated in place) inside the round arena, `pad` units from the wall. */
export function clampToMap(p,pad=0){
  const max=MAP.radius-pad,d=Math.hypot(p.x,p.y);
  if(d>max){const k=max/d;p.x*=k;p.y*=k;}
  return p;
}
export function randomEdgeSpawn(random,hero={x:0,y:0},occupied=[]){
  const inner=MAP.radius*MAP.edgeBand,outer=MAP.radius-MAP.margin;
  let p;
  for(let attempt=0;attempt<80;attempt++){
    // Uniform over the outer ring: radius from the area-weighted square root.
    const r=Math.sqrt(inner*inner+random()*(outer*outer-inner*inner)),a=random()*Math.PI*2;
    p={x:Math.cos(a)*r,y:Math.sin(a)*r};
    if(Math.hypot(p.x-hero.x,p.y-hero.y)>3&&occupied.every(e=>Math.hypot(e.x-p.x,e.y-p.y)>.5))return p;
  }
  const a=random()*Math.PI*2;
  p={x:Math.cos(a)*outer,y:Math.sin(a)*outer};
  if(Math.hypot(p.x-hero.x,p.y-hero.y)<=3){p.x=-p.x;p.y=-p.y;}
  return p;
}
export const EQUIPMENT = [
  {key:'nozzle',name:'Pressure nozzle',max:5,base:100,description:'Stronger, faster hose stream'},
  {key:'foam',name:'Foam system',max:3,base:200,description:'Unlock a wide foam burst'},
  {key:'cannon',name:'Water cannon',max:3,base:300,description:'A powerful long-range burst'}
];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function iso(x,y) {return {x:(x-y)*.72,y:(x+y)*.36};}
export function movementFromScreen(x,y) {
  if(!x&&!y)return{x:0,y:0};
  // Screen y increases downward; world y increases upward.
  const a=x/1.44-y/.72,b=-x/1.44-y/.72,l=Math.hypot(a,b);
  return{x:a/l,y:b/l};
}
export function firstHit(a,b,p,radius) {
  const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-p.x,oy=a.y-p.y;
  const aa=dx*dx+dy*dy,bb=2*(ox*dx+oy*dy),cc=ox*ox+oy*oy-radius*radius;
  if(cc<=0)return 0;
  const det=bb*bb-4*aa*cc;
  if(!aa||det<0)return null;
  const t=(-bb-Math.sqrt(det))/(2*aa);
  return t>=0&&t<=1?t:null;
}
export class Engine {
  constructor(profile,random=Math.random) {
    this.power=0;this.powerLevel=0;this.blueCoins=[];this.dropMisses=0;this.magnetLevel=0;this.resumeLeft=0;
    this.profile={...profile};this.random=random;this.mode='ready';this.room=1;this.cleared=0;
    this.score=0;this.time=0;this.health=6;this.maxHealth=6;this.hero={x:0,y:0};
    this.roomEvent='';this.encounterTimer=0;this.enemies=[];this.shots=[];this.fx=[];this.aim={x:1,y:0};this.moving=false;
    this.cooldown=0;this.specialCooldown=0;this.grace=0;this.charges=0;this.id=0;
    // Per-run loadout (never saved): chosen weapon, upgrade stacks, and the pick offered after a cleared room.
    this.weapon='hose';this.upgrades={};this.offer=[];this.burstQueue=[];this.interval=.19;
    this.pending=[];this.specialQueue=[];this.totalRegular=0;this.defeatedRegular=0;this.waveTime=0;this.waveTotal=0;this.spawned=0;this.nextRaid=RAID.first;this.finaleDone=false;
    this.puddles=[];this.orbAngle=0;
    this.hydrants=[];this.coins=[];this.bonuses=[];this.hydrantTimer=0;this.timedLeft=0;this.endTimer=null;
  }
  stats(){
    const s=computeStats(this.weapon,this.profile,this.upgrades);s.damage*=1.5;
    if(this.timedLeft>0){s.interval*=.5;s.projectiles+=2;}   // timed special attack: double fire rate, two extra streams
    return s;
  }
  setWeapon(key){if(!WEAPONS[key]||!['ready','defeat','victory'].includes(this.mode))return false;this.weapon=key;return true;}
  powerCost(){return Math.min(25,[5,8,12][this.powerLevel]??(12+(this.powerLevel-2)*3));}
  pickupRange(){return COIN.range+this.magnetLevel*COIN.magnetStep+(this.upgrades.coin_magnet||0)*1.5;}
  magnetPrice(){return 40*(this.magnetLevel+1);}
  buyMagnet(){
    if(!['active','upgrade','clear'].includes(this.mode)||this.magnetLevel>=COIN.magnetMax||this.profile.credits<this.magnetPrice())return false;
    this.profile.credits-=this.magnetPrice();this.magnetLevel++;return true;
  }
  openPowerUpgrade(){
    if(this.power<this.powerCost())return false;
    const offer=rollUpgradeOffer(this.upgrades,this.random);
    if(!offer.length)return false;
    this.offer=offer;this.mode='upgrade';return true;
  }
  chooseUpgrade(id){
    if(!['clear','upgrade'].includes(this.mode)||!this.offer.includes(id))return false;
    const during=this.mode==='upgrade';
    if(during){this.power-=this.powerCost();this.powerLevel++;}
    if(id==='emergency_recovery')this.health=Math.min(this.maxHealth,this.health+2);
    else this.upgrades[id]=(this.upgrades[id]||0)+1;
    this.offer=[];
    if(during){this.mode='active';this.resumeLeft=3;}
    return true;
  }
  newRun(){
    this.power=0;this.powerLevel=0;this.blueCoins=[];this.dropMisses=0;this.magnetLevel=0;this.resumeLeft=0;
    this.room=1;this.cleared=0;this.score=0;this.time=0;this.health=this.maxHealth;
    this.hero={x:0,y:0};this.mode='active';this.grace=1;this.upgrades={};this.offer=[];this.spawnRoom();
  }
  spawnRoom(){
    this.enemies=[];this.shots=[];this.burstQueue=[];this.puddles=[];this.fx=[];this.cooldown=0;this.specialCooldown=0;
    this.hydrants=[];this.coins=[];this.blueCoins=[];this.bonuses=[];this.endTimer=null;this.timedLeft=0;
    this.hydrantTimer=HYDRANT.minDelay+this.random()*(HYDRANT.maxDelay-HYDRANT.minDelay);
    this.charges=2+(this.profile.foam>0?1:0)+(this.profile.cannon>0?1:0);
    const lineup=roomLineup(this.room,this.random);
    const regular=lineup.filter(e=>e.tier==='base');
    this.specialQueue=lineup.filter(e=>e.tier!=='base');      // mini-boss / boss, held back until half time
    // A continuous stream throughout the timer, drawn from all unlocked regular types.
    const total=SPAWN.initial+Math.ceil(WAVE.duration*(WAVE.baseRate+(this.room-1)*WAVE.perRoomRate));
    this.pending=Array.from({length:total},(_,i)=>i<regular.length?regular[i]:regular[Math.floor(this.random()*regular.length)]);
    this.totalRegular=total;this.defeatedRegular=0;this.waveTime=0;this.waveTotal=total;this.spawned=0;this.nextRaid=RAID.first;this.finaleDone=false;
    this.roomEvent='Room '+this.room;this.encounterTimer=0;
    for(let i=0;i<SPAWN.initial&&this.pending.length;i++){this.spawnOne(this.pending.shift());this.spawned++;}
  }
  spawnOne(type){
    const p=randomEdgeSpawn(this.random,this.hero,this.enemies);
    const scaled=scaleEnemy(type,this.room);
    this.enemies.push({...scaled,...p,id:++this.id,maxHp:scaled.hp,charger:type.behavior==='charge',timer:this.random()*3.2,flash:0});
  }
  /** Enemies still to defeat this wave: on the map plus everything queued. */
  remaining(){return this.enemies.length+(this.pending?.length||0)+(this.specialQueue?.length||0);}
  /** Release a pack of swarm raiders: one tight group at a random edge point, or the finale from four sides. */
  spawnRaid(finale){
    const pool=swarmPool(this.room),base=Math.min(RAID.maxSize,Math.round(RAID.baseSize+this.room*RAID.perRoom));
    const n=finale?Math.min(RAID.maxFinale,Math.round(base*RAID.finaleFactor)):base;
    const lead=pool[Math.floor(this.random()*pool.length)];
    const centers=finale?[0,1,2,3].map(i=>{const a=i*Math.PI/2+this.random()*.6,r=MAP.radius-MAP.margin-.5;return{x:Math.cos(a)*r,y:Math.sin(a)*r};}):[randomEdgeSpawn(this.random,this.hero,[])];
    for(let i=0;i<n&&this.enemies.length<SPAWN.maxAlive;i++){
      const c=centers[i%centers.length],type=finale?pool[Math.floor(this.random()*pool.length)]:(this.random()<.75?lead:pool[Math.floor(this.random()*pool.length)]);
      const a=this.random()*Math.PI*2,d=Math.sqrt(this.random())*RAID.spread,p={x:c.x+Math.cos(a)*d,y:c.y+Math.sin(a)*d};clampToMap(p,ENEMY_PAD);
      const scaled=scaleEnemy(type,this.room);
      this.enemies.push({...scaled,...p,id:++this.id,maxHp:scaled.hp,charger:false,timer:this.random()*3.2,flash:0});
    }
    this.roomEvent=finale?'FINALE: THE SWARM!':'SWARM INCOMING!';this.encounterTimer=finale?5:3;
  }
  /** Seconds left on the wave clock. */
  timeLeft(){return Math.max(0,WAVE.duration-this.waveTime);}
  advanceSpawns(dt){
    this.waveTime+=dt;
    // Release the mini-boss / boss at half time.
    if(this.specialQueue?.length&&this.waveTime>=WAVE.duration*SPAWN.specialAt){
      const special=this.specialQueue[0];
      this.roomEvent=(special.tier==='boss'?'BOSS: ':'MINI-BOSS: ')+special.name;this.encounterTimer=5;
      for(const type of this.specialQueue.splice(0))this.spawnOne(type);
    }
    // Timed swarm attacks, independent of the regular queue.
    if(this.waveTime>=this.nextRaid&&this.nextRaid<RAID.finale){this.nextRaid+=RAID.every;this.spawnRaid(false);}
    if(!this.finaleDone&&this.waveTime>=RAID.finale){this.finaleDone=true;this.spawnRaid(true);}
    if(!this.pending?.length)return;
    // Constant arrivals; queued enemies refill vacancies when the active population hits its cap.
    const f=Math.min(1,this.waveTime/WAVE.duration),due=Math.min(this.waveTotal,SPAWN.initial+Math.floor((this.waveTotal-SPAWN.initial)*Math.pow(f,WAVE.ramp)));
    while(this.pending.length&&this.spawned<due&&this.enemies.length<SPAWN.maxAlive){this.spawnOne(this.pending.shift());this.spawned++;}
  }

  nextRoom(){
    if(this.mode!=='clear')return false;
    this.room++;this.hero={x:0,y:0};this.mode='active';this.grace=1;this.spawnRoom();return true;
  }
  price(key){const item=EQUIPMENT.find(i=>i.key===key);return item?item.base*(this.profile[key]+1):Infinity;}
  buy(key){
    const item=EQUIPMENT.find(i=>i.key===key);
    if(!item||!['ready','clear','defeat','victory'].includes(this.mode)||this.profile[key]>=item.max||this.profile.credits<this.price(key))return false;
    this.profile.credits-=this.price(key);this.profile[key]++;return true;
  }
  damage(enemy,damage,crit=false){
    if(enemy.hp<=0)return;
    enemy.hp-=damage;enemy.flash=.12;
    this.fx.push({x:enemy.x,y:enemy.y,type:crit?'crit':'splash',life:.28,total:.28});
    if(enemy.hp<=0){
      const index=this.enemies.indexOf(enemy);if(index>=0)this.enemies.splice(index,1);
      if(enemy.tier==='base'||enemy.tier===undefined)this.defeatedRegular=(this.defeatedRegular||0)+1;
      this.score+=enemy.score??(enemy.charger?200:100);
      // The reward drops as a coin that stays on the map until the hero collects it (or the round ends).
      if(enemy.tier!=='swarm')this.coins.push({x:enemy.x,y:enemy.y,value:enemy.reward??(enemy.charger?8:5),big:enemy.tier==='boss'||enemy.tier==='mini'});
      this.dropMisses++;
      if(this.random()<COIN.dropChance||this.dropMisses>=5){this.blueCoins.push({x:enemy.x,y:enemy.y,value:1});this.dropMisses=0;}
      this.fx.push({x:enemy.x,y:enemy.y,type:'steam',life:.65,total:.65});
    }
  }
  fireVolley(st,dir){
    // Extra streams fan out around the aim direction.
    const n=st.projectiles,step=SPREAD_DEG*Math.PI/180,base=Math.atan2(dir.y,dir.x);
    for(let i=0;i<n&&this.enemies.length<SPAWN.maxAlive;i++){
      const ang=base+(i-(n-1)/2)*step,dx=Math.cos(ang),dy=Math.sin(ang),crit=this.random()<st.critChance;
      this.shots.push({x:this.hero.x,y:this.hero.y,vx:dx*st.speed,vy:dy*st.speed,speed:st.speed,
        life:st.range/st.speed*(st.bounce?1.5:1)+.05,damage:st.damage*(crit?st.critMult:1),crit,kind:st.kind,
        homing:st.homing,knock:st.knockback,splash:st.splash,puddle:st.puddle,chain:st.chain,chainKeep:st.chainKeep,bounce:st.bounce,hit:new Set()});
    }
  }
  /** Water balloon burst: other enemies near the impact take reduced damage and a shove. */
  splash(x,y,primary,s){
    this.fx.push({x,y,type:'burst',radius:s.splash,life:.35,total:.35});
    for(const e of [...this.enemies]){
      if(e===primary)continue;
      const dx=e.x-x,dy=e.y-y,d=Math.hypot(dx,dy);
      if(d>s.splash)continue;
      this.damage(e,s.damage*SPLASH_DAMAGE,s.crit);
      if(s.knock&&this.enemies.includes(e))this.knockback(e,{vx:dx||1,vy:dy,knock:s.knock*(1-d/s.splash*.5)});
    }
  }
  addPuddle(x,y){
    this.puddles.push({x,y,r:PUDDLE.radius,life:PUDDLE.life,total:PUDDLE.life});
    if(this.puddles.length>14)this.puddles.shift();
  }
  orbPositions(count=this.stats().orbs){
    const out=[];
    for(let i=0;i<count;i++){const a=this.orbAngle+i*Math.PI*2/count;out.push({x:this.hero.x+Math.cos(a)*ORBIT.radius,y:this.hero.y+Math.sin(a)*ORBIT.radius});}
    return out;
  }
  /** Frost Orbs circle the hero; an enemy they touch takes damage and is slowed. */
  updateOrbitals(st,dt){
    if(!(st.orbs>0))return;
    this.orbAngle=(this.orbAngle+ORBIT.speed*dt)%(Math.PI*2);
    const orbs=this.orbPositions(st.orbs);
    for(const e of [...this.enemies]){
      if((e.orbCd||0)>this.time)continue;
      const r=(e.radius??(e.charger?.25:.18))+ORBIT.hitRadius;
      if(!orbs.some(o=>(o.x-e.x)**2+(o.y-e.y)**2<r*r))continue;
      e.orbCd=this.time+ORBIT.cooldown;
      e.slowT=ORBIT.slowTime;e.slowF=e.tier==='boss'?ORBIT.bossSlow:ORBIT.slow;
      this.damage(e,st.orbDamage,false);
    }
  }
  spawnHydrant(){
    const outer=MAP.radius*.8;
    for(let i=0;i<40;i++){
      const r=Math.sqrt(this.random())*outer,a=this.random()*Math.PI*2,p={x:Math.cos(a)*r,y:Math.sin(a)*r};
      if(Math.hypot(p.x-this.hero.x,p.y-this.hero.y)<2.5||this.hydrants.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<4))continue;
      this.hydrants.push({...p,hp:HYDRANT.hp,maxHp:HYDRANT.hp,id:++this.id,flash:0});return true;
    }
    return false;
  }
  hitHydrant(h,damage){
    h.hp-=damage;h.flash=.12;this.fx.push({x:h.x,y:h.y,type:'splash',life:.28,total:.28});
    if(h.hp>0)return;
    this.hydrants.splice(this.hydrants.indexOf(h),1);
    let type=BONUS.types[Math.floor(this.random()*BONUS.types.length)];
    if(type==='upgrade'&&!rollUpgradeOffer(this.upgrades,()=>0,1).length)type='coins';
    this.bonuses.push({id:++this.id,x:h.x,y:h.y,type,life:BONUS.life,total:BONUS.life});
    this.fx.push({x:h.x,y:h.y,type:'burst',radius:2,life:.5,total:.5});
  }
  /** Click or tap on a bonus: it activates at once. */
  activateBonus(id){
    if(this.mode!=='active')return null;
    const i=this.bonuses.findIndex(b=>b.id===id);if(i<0)return null;
    const b=this.bonuses.splice(i,1)[0];let text='';
    if(b.type==='coins'){const n=BONUS.coinsBase+BONUS.coinsPerRoom*this.room;this.profile.credits=clamp(this.profile.credits+n,0,1000000);text='BONUS: +'+n+' coins';}
    else if(b.type==='upgrade'){const pick=rollUpgradeOffer(this.upgrades,this.random,1)[0];if(pick){this.upgrades[pick]=(this.upgrades[pick]||0)+1;text='BONUS: '+UPGRADE_BY_ID[pick].name;}}
    else if(b.type==='bomb'){
      this.fx.push({...this.hero,type:'burst',radius:BONUS.bombRadius,life:.6,total:.6});
      for(const e of [...this.enemies])if(Math.hypot(e.x-this.hero.x,e.y-this.hero.y)<=BONUS.bombRadius)this.damage(e,BONUS.bombDamage);
      text='BONUS: BOMB';
    }
    else{this.timedLeft=BONUS.timedSeconds;text='BONUS: RAPID FIRE '+BONUS.timedSeconds+'s';}
    this.roomEvent=text;this.encounterTimer=2.5;
    return b.type;
  }
  knockback(enemy,shot){
    // Bosses shrug most of it off; mini-bosses take half.
    const resist=enemy.tier==='boss'?.2:enemy.tier==='mini'?.5:1,l=Math.hypot(shot.vx,shot.vy)||1;
    enemy.kvx=shot.vx/l*shot.knock*resist;enemy.kvy=shot.vy/l*shot.knock*resist;enemy.kt=.18;
  }
  special(){
    if(this.mode!=='active'||this.charges<1||this.specialCooldown>0||(!this.profile.foam&&!this.profile.cannon))return false;
    this.charges--;this.specialCooldown=5;
    const radius=this.profile.cannon>0?4.5:3.2;
    this.fx.push({...this.hero,type:'burst',radius,life:.6,total:.6});
    for(const e of [...this.enemies])if(Math.hypot(e.x-this.hero.x,e.y-this.hero.y)<=radius)this.damage(e,3+2*this.profile.foam+3*this.profile.cannon);
    return true;
  }
  step(dt,move={x:0,y:0}){
    if(this.mode!=='active')return null;
    if(this.resumeLeft>0){this.resumeLeft=Math.max(0,this.resumeLeft-clamp(dt,0,.05));return null;}
    if(this.openPowerUpgrade())return 'upgrade';
    dt=clamp(dt,0,.05);this.time+=dt;this.encounterTimer=Math.max(0,this.encounterTimer-dt);this.cooldown-=dt;this.grace-=dt;this.specialCooldown=Math.max(0,this.specialCooldown-dt);
    const length=Math.hypot(move.x,move.y),scale=length>1?1/length:1;
    this.moving=length>.01;
    this.hero.x+=move.x*scale*3.6*SPEED.hero*dt;this.hero.y+=move.y*scale*3.6*SPEED.hero*dt;clampToMap(this.hero,HERO_PAD);
    this.advanceSpawns(dt);
    this.timedLeft=Math.max(0,this.timedLeft-dt);
    if(this.endTimer===null){
      this.hydrantTimer-=dt;
      if(this.hydrantTimer<=0){this.hydrantTimer=HYDRANT.minDelay+this.random()*(HYDRANT.maxDelay-HYDRANT.minDelay);if(this.hydrants.length<HYDRANT.maxAlive)this.spawnHydrant();}
    }
    for(const h of this.hydrants)h.flash=Math.max(0,h.flash-dt);
    for(const b of this.bonuses)b.life-=dt;
    this.bonuses=this.bonuses.filter(b=>b.life>0);
    for(let i=this.coins.length-1;i>=0;i--){
      const k=this.coins[i];
      if(Math.hypot(k.x-this.hero.x,k.y-this.hero.y)<=this.pickupRange()){
        this.profile.credits=clamp(this.profile.credits+k.value,0,1000000);this.coins.splice(i,1);
        this.fx.push({x:k.x,y:k.y,type:'splash',life:.28,total:.28});
      }
    }
    for(let i=this.blueCoins.length-1;i>=0;i--){const k=this.blueCoins[i];
      if(Math.hypot(k.x-this.hero.x,k.y-this.hero.y)<=this.pickupRange()){this.power+=k.value;this.blueCoins.splice(i,1);}
    }
    if(this.openPowerUpgrade())return 'upgrade';
    const st=this.stats();this.interval=st.interval;
    if(this.enemies.length||this.hydrants.length){
      const d2=o=>(o.x-this.hero.x)**2+(o.y-this.hero.y)**2;
      let nearest=this.enemies[0]||null;   // the map can hold only a hydrant mid-wave now that waves are timed
      for(const e of this.enemies)if(d2(e)<d2(nearest))nearest=e;
      // A hydrant becomes the target when it is in range and no enemy is close (within 3.5 units).
      let hyd=null;for(const h of this.hydrants)if(!hyd||d2(h)<d2(hyd))hyd=h;
      if(hyd&&Math.sqrt(d2(hyd))<=st.range&&(!nearest||(Math.sqrt(d2(nearest))>3.5&&d2(hyd)<d2(nearest))))nearest=hyd;
      if(nearest){
      const dx=nearest.x-this.hero.x,dy=nearest.y-this.hero.y,dist=Math.hypot(dx,dy),l=dist||1;
      this.aim={x:dx/l,y:dy/l};
      // Weapons only fire once the nearest enemy is inside their range.
      if(this.cooldown<=0&&dist<=st.range){
        this.fireVolley(st,this.aim);
        for(let k=1;k<st.bursts;k++)this.burstQueue.push({delay:k*.1,dir:{...this.aim}});
        this.cooldown=st.interval;
      }
      }
    }
    for(let i=this.burstQueue.length-1;i>=0;i--){
      const q=this.burstQueue[i];q.delay-=dt;
      if(q.delay<=0){this.fireVolley(st,q.dir);this.burstQueue.splice(i,1);}
    }
    for(let i=this.shots.length-1;i>=0;i--){
      const s=this.shots[i];
      if(s.homing){
        let target=null,best=14*14;
        for(const e of this.enemies){if(s.hit?.has(e))continue;const d=(e.x-s.x)**2+(e.y-s.y)**2;if(d<best){best=d;target=e;}}
        if(target){
          const sp=s.speed||Math.hypot(s.vx,s.vy),cur=Math.atan2(s.vy,s.vx);
          let diff=Math.atan2(target.y-s.y,target.x-s.x)-cur;diff=Math.atan2(Math.sin(diff),Math.cos(diff));
          const turn=clamp(diff,-4.5*dt,4.5*dt);s.vx=Math.cos(cur+turn)*sp;s.vy=Math.sin(cur+turn)*sp;
        }
      }
      const old={x:s.x,y:s.y};s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
      let hit=null,first=Infinity;
      for(const e of this.enemies){if(s.hit?.has(e))continue;const t=firstHit(old,s,e,e.radius??(e.charger?.25:.18));if(t!==null&&t<first){first=t;hit=e;}}
      let hyd=null,hydT=Infinity;
      for(const h of this.hydrants){const t=firstHit(old,s,h,HYDRANT.radius);if(t!==null&&t<hydT){hydT=t;hyd=h;}}
      if(hyd&&hydT<first){this.hitHydrant(hyd,s.damage);s.life=0;}
      else if(hit){
        const hx=hit.x,hy=hit.y;
        this.damage(hit,s.damage,s.crit);
        if(s.knock&&this.enemies.includes(hit))this.knockback(hit,s);
        if(s.splash)this.splash(hx,hy,hit,s);
        if(s.puddle)this.addPuddle(hx,hy);
        s.hit?.add(hit);
        // Chain Splash: hop to the nearest enemy that has not been hit by this stream yet.
        let next=null;
        if(s.chain>0){
          let best=CHAIN.range*CHAIN.range;
          for(const e of this.enemies){if(s.hit?.has(e))continue;const d=(e.x-hx)**2+(e.y-hy)**2;if(d<best){best=d;next=e;}}
        }
        if(next){
          const dx=next.x-hx,dy=next.y-hy,l=Math.hypot(dx,dy)||1,sp=s.speed||Math.hypot(s.vx,s.vy);
          s.x=hx;s.y=hy;s.vx=dx/l*sp;s.vy=dy/l*sp;s.chain--;s.damage*=s.chainKeep;s.life=Math.max(s.life,CHAIN.range/sp+.3);
        }else s.life=0;
      }
      if(s.bounce){
        const d=Math.hypot(s.x,s.y),edge=MAP.radius-.3;
        if(d>edge){const nx=s.x/d,ny=s.y/d,dot=s.vx*nx+s.vy*ny;if(dot>0){s.vx-=2*dot*nx;s.vy-=2*dot*ny;}s.x=nx*edge;s.y=ny*edge;}
      }
      if(s.life<=0||Math.hypot(s.x,s.y)>MAP.radius+1)this.shots.splice(i,1);
    }
    for(const p of this.puddles)p.life-=dt;
    this.puddles=this.puddles.filter(p=>p.life>0);
    this.updateOrbitals(st,dt);
    for(const e of this.enemies){
      e.timer+=dt;e.flash=Math.max(0,e.flash-dt);
      const dx=this.hero.x-e.x,dy=this.hero.y-e.y,l=Math.hypot(dx,dy)||1;
      const behavior=e.behavior||(e.charger?'charge':'chase');
      const burst=behavior==='charge'&&e.timer%3.2>2.6?2.7:behavior==='pulse'?(e.timer%1.6>.9?1.7:.45):1;
      for(const p of this.puddles)if((e.x-p.x)**2+(e.y-p.y)**2<p.r*p.r){e.slowT=Math.max(e.slowT||0,.3);e.slowF=e.tier==='boss'?PUDDLE.bossSlow:PUDDLE.slow;}
      const slow=e.slowT>0?(e.slowF||.5):1;if(e.slowT>0)e.slowT-=dt;
      const stagger=e.kt>0?.25:1,speed=e.speed*SPEED.enemy*burst*stagger*slow;
      const weave=behavior==='zigzag'?Math.sin(e.timer*4+e.id)*.42:0;
      const vx=dx/l-dy/l*weave,vy=dy/l+dx/l*weave,vl=Math.hypot(vx,vy)||1;
      e.x+=vx/vl*speed*dt;e.y+=vy/vl*speed*dt;
      if(e.kt>0){e.x+=e.kvx*dt;e.y+=e.kvy*dt;e.kt-=dt;}
      clampToMap(e,ENEMY_PAD);
      if(this.grace<=0&&Math.hypot(dx,dy)<(e.radius??(e.charger?.25:.18))+HERO_RADIUS){
        this.health=Math.max(0,Math.round((this.health-(e.attack??1))*100)/100);this.grace=1.1;
        this.fx.push({...this.hero,type:'hurt',life:.3,total:.3});
        if(this.health<=0){this.mode='defeat';return'checkpoint';}
      }
    }
    for(const f of this.fx)f.life-=dt;
    this.fx=this.fx.filter(f=>f.life>0).slice(-100);
    if(this.waveTime>=WAVE.duration){
      // Timer is up: no end grace. Every coin still on the field is collected automatically, leftovers are cleared.
      for(const k of this.blueCoins)this.power+=k.value;
      this.blueCoins=[];
      for(const k of this.coins)this.profile.credits=clamp(this.profile.credits+k.value,0,1000000);
      this.coins=[];this.bonuses=[];this.hydrants=[];this.enemies=[];this.pending=[];this.specialQueue=[];this.timedLeft=0;
      this.cleared=this.room;this.profile.credits=clamp(this.profile.credits+25+this.room*5,0,1000000);
      this.health=Math.min(this.maxHealth,this.health+1);this.mode=this.room>=ROOM_LIMIT?'victory':'clear';
      this.offer=this.mode==='clear'?rollUpgradeOffer(this.upgrades,this.random):[];
      this.shots=[];this.burstQueue=[];return'checkpoint';
    }
    return null;
  }
}

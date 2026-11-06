import {roomLineup} from './enemy-roster.mjs';
import {WEAPONS,UPGRADE_BY_ID,computeStats,rollUpgradeOffer} from './weapons.mjs';
export const ROOM_LIMIT = 30;
// Round arena. The previous 24 × 18 rectangle was 432 units²; this disc is five times that
// area (2,160 units², about 52.4 units across). width/height are the diameter, kept for callers
// that only need the overall extent.
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
    this.profile={...profile};this.random=random;this.mode='ready';this.room=1;this.cleared=0;
    this.score=0;this.time=0;this.health=6;this.maxHealth=6;this.hero={x:0,y:0};
    this.roomEvent='';this.encounterTimer=0;this.enemies=[];this.shots=[];this.fx=[];this.aim={x:1,y:0};this.moving=false;
    this.cooldown=0;this.specialCooldown=0;this.grace=0;this.charges=0;this.id=0;
    // Per-run loadout (never saved): chosen weapon, upgrade stacks, and the pick offered after a cleared room.
    this.weapon='hose';this.upgrades={};this.offer=[];this.burstQueue=[];this.interval=.19;
  }
  stats(){return computeStats(this.weapon,this.profile,this.upgrades);}
  setWeapon(key){if(!WEAPONS[key]||!['ready','defeat','victory'].includes(this.mode))return false;this.weapon=key;return true;}
  chooseUpgrade(id){
    if(this.mode!=='clear'||!this.offer.includes(id))return false;
    this.upgrades[id]=(this.upgrades[id]||0)+1;this.offer=[];return true;
  }
  newRun(){
    this.room=1;this.cleared=0;this.score=0;this.time=0;this.health=this.maxHealth;
    this.hero={x:0,y:0};this.mode='active';this.grace=1;this.upgrades={};this.offer=[];this.spawnRoom();
  }
  spawnRoom(){
    this.enemies=[];this.shots=[];this.burstQueue=[];this.fx=[];this.cooldown=0;this.specialCooldown=0;
    this.charges=2+(this.profile.foam>0?1:0)+(this.profile.cannon>0?1:0);
    const lineup=roomLineup(this.room,this.random);
    const special=lineup.find(e=>e.tier==='boss')||lineup.find(e=>e.tier==='mini');
    this.roomEvent=special?(special.tier==='boss'?'BOSS: ':'MINI-BOSS: ')+special.name:'Room '+this.room;
    this.encounterTimer=special?5:0;
    for(const type of lineup){
      const p=randomEdgeSpawn(this.random,this.hero,this.enemies);
      this.enemies.push({...type,...p,id:++this.id,maxHp:type.hp,charger:type.behavior==='charge',
        timer:this.random()*3.2,flash:0});
    }
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
    enemy.hp-=damage;enemy.flash=.12;
    this.fx.push({x:enemy.x,y:enemy.y,type:crit?'crit':'splash',life:.28,total:.28});
    if(enemy.hp<=0){
      const index=this.enemies.indexOf(enemy);if(index>=0)this.enemies.splice(index,1);
      this.score+=enemy.score??(enemy.charger?200:100);
      this.profile.credits=clamp(this.profile.credits+(enemy.reward??(enemy.charger?8:5)),0,1000000);
      this.fx.push({x:enemy.x,y:enemy.y,type:'steam',life:.65,total:.65});
    }
  }
  fireVolley(st,dir){
    // Extra streams fly side by side, spaced across the aim direction.
    const px=-dir.y,py=dir.x;
    for(let i=0;i<st.projectiles;i++){
      const off=(i-(st.projectiles-1)/2)*.32,crit=this.random()<st.critChance;
      this.shots.push({x:this.hero.x+px*off,y:this.hero.y+py*off,vx:dir.x*st.speed,vy:dir.y*st.speed,speed:st.speed,
        life:st.range/st.speed*(st.bounce?1.5:1)+.05,damage:st.damage*(crit?st.critMult:1),crit,kind:st.kind,
        homing:st.homing,knock:st.knockback,pierce:st.pierce,keep:st.pierceKeep,bounce:st.bounce,hit:new Set()});
    }
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
    dt=clamp(dt,0,.05);this.time+=dt;this.encounterTimer=Math.max(0,this.encounterTimer-dt);this.cooldown-=dt;this.grace-=dt;this.specialCooldown=Math.max(0,this.specialCooldown-dt);
    const length=Math.hypot(move.x,move.y),scale=length>1?1/length:1;
    this.moving=length>.01;
    this.hero.x+=move.x*scale*3.6*dt;this.hero.y+=move.y*scale*3.6*dt;clampToMap(this.hero,HERO_PAD);
    const st=this.stats();this.interval=st.interval;
    if(this.enemies.length){
      let nearest=this.enemies[0];
      for(const e of this.enemies)if((e.x-this.hero.x)**2+(e.y-this.hero.y)**2<(nearest.x-this.hero.x)**2+(nearest.y-this.hero.y)**2)nearest=e;
      const dx=nearest.x-this.hero.x,dy=nearest.y-this.hero.y,dist=Math.hypot(dx,dy),l=dist||1;
      this.aim={x:dx/l,y:dy/l};
      // Weapons only fire once the nearest enemy is inside their range.
      if(this.cooldown<=0&&dist<=st.range){
        this.fireVolley(st,this.aim);
        for(let k=1;k<st.bursts;k++)this.burstQueue.push({delay:k*.1,dir:{...this.aim}});
        this.cooldown=st.interval;
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
      if(hit){
        this.damage(hit,s.damage,s.crit);
        if(s.knock&&this.enemies.includes(hit))this.knockback(hit,s);
        if(s.pierce){s.hit.add(hit);s.damage*=s.keep;}else s.life=0;
      }
      if(s.bounce){
        const d=Math.hypot(s.x,s.y),edge=MAP.radius-.3;
        if(d>edge){const nx=s.x/d,ny=s.y/d,dot=s.vx*nx+s.vy*ny;if(dot>0){s.vx-=2*dot*nx;s.vy-=2*dot*ny;}s.x=nx*edge;s.y=ny*edge;}
      }
      if(s.life<=0||Math.hypot(s.x,s.y)>MAP.radius+1)this.shots.splice(i,1);
    }
    for(const e of this.enemies){
      e.timer+=dt;e.flash=Math.max(0,e.flash-dt);
      const dx=this.hero.x-e.x,dy=this.hero.y-e.y,l=Math.hypot(dx,dy)||1;
      const behavior=e.behavior||(e.charger?'charge':'chase');
      const burst=behavior==='charge'&&e.timer%3.2>2.6?2.7:behavior==='pulse'?(e.timer%1.6>.9?1.7:.45):1;
      const stagger=e.kt>0?.25:1,speed=e.speed*burst*stagger;
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
    if(!this.enemies.length){
      this.cleared=this.room;this.profile.credits=clamp(this.profile.credits+25+this.room*5,0,1000000);
      this.health=Math.min(this.maxHealth,this.health+1);this.mode=this.room>=ROOM_LIMIT?'victory':'clear';
      this.offer=this.mode==='clear'?rollUpgradeOffer(this.upgrades,this.random):[];
      this.shots=[];this.burstQueue=[];return'checkpoint';
    }
    return null;
  }
}

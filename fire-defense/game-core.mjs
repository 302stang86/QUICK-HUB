import {roomLineup} from './enemy-roster.mjs';
export const ROOM_LIMIT = 30;
// Original 12 × 9 = 108 units². Adding 300% produces 24 × 18 = 432 units².
export const MAP={width:24,height:18,edgeBand:.25,margin:.6};
export function inSpawnBand(p){return Math.abs(p.x)>=MAP.width*.25 || Math.abs(p.y)>=MAP.height*.25;}
export function randomEdgeSpawn(random,hero={x:0,y:0},occupied=[]){
  let p;
  for(let attempt=0;attempt<80;attempt++){
    p={x:(random()-.5)*(MAP.width-2*MAP.margin),y:(random()-.5)*(MAP.height-2*MAP.margin)};
    if(inSpawnBand(p)&&Math.hypot(p.x-hero.x,p.y-hero.y)>3&&occupied.every(e=>Math.hypot(e.x-p.x,e.y-p.y)>.9))return p;
  }
  const side=Math.min(3,Math.floor(random()*4));
  const along=random()-.5;
  p=side<2?{x:(side===0?-1:1)*(MAP.width/2-MAP.margin),y:along*(MAP.height-2*MAP.margin)}:
    {x:along*(MAP.width-2*MAP.margin),y:(side===2?-1:1)*(MAP.height/2-MAP.margin)};
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
  }
  newRun(){
    this.room=1;this.cleared=0;this.score=0;this.time=0;this.health=this.maxHealth;
    this.hero={x:0,y:0};this.mode='active';this.grace=1;this.spawnRoom();
  }
  spawnRoom(){
    this.enemies=[];this.shots=[];this.fx=[];this.cooldown=0;this.specialCooldown=0;
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
  damage(enemy,damage){
    enemy.hp-=damage;enemy.flash=.12;
    this.fx.push({x:enemy.x,y:enemy.y,type:'splash',life:.28,total:.28});
    if(enemy.hp<=0){
      const index=this.enemies.indexOf(enemy);if(index>=0)this.enemies.splice(index,1);
      this.score+=enemy.score??(enemy.charger?200:100);
      this.profile.credits=clamp(this.profile.credits+(enemy.reward??(enemy.charger?8:5)),0,1000000);
      this.fx.push({x:enemy.x,y:enemy.y,type:'steam',life:.65,total:.65});
    }
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
    this.hero.x=clamp(this.hero.x+move.x*scale*3.6*dt,-MAP.width/2+.4,MAP.width/2-.4);
    this.hero.y=clamp(this.hero.y+move.y*scale*3.6*dt,-MAP.height/2+.4,MAP.height/2-.4);
    if(this.enemies.length&&this.cooldown<=0){
      let nearest=this.enemies[0];
      for(const e of this.enemies)if((e.x-this.hero.x)**2+(e.y-this.hero.y)**2<(nearest.x-this.hero.x)**2+(nearest.y-this.hero.y)**2)nearest=e;
      const dx=nearest.x-this.hero.x,dy=nearest.y-this.hero.y,l=Math.hypot(dx,dy)||1;
      this.aim={x:dx/l,y:dy/l};
      this.shots.push({...this.hero,vx:dx/l*14,vy:dy/l*14,life:3.0,damage:1+this.profile.nozzle*.35});
      this.cooldown=.19/(1+this.profile.nozzle*.08);
    }
    for(let i=this.shots.length-1;i>=0;i--){
      const s=this.shots[i],old={x:s.x,y:s.y};s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
      let hit=null,first=Infinity;
      for(const e of this.enemies){const t=firstHit(old,s,e,e.radius??(e.charger?.5:.36));if(t!==null&&t<first){first=t;hit=e;}}
      if(hit){this.damage(hit,s.damage);s.life=0;}
      if(s.life<=0||Math.abs(s.x)>MAP.width/2+1||Math.abs(s.y)>MAP.height/2+1)this.shots.splice(i,1);
    }
    for(const e of this.enemies){
      e.timer+=dt;e.flash=Math.max(0,e.flash-dt);
      const dx=this.hero.x-e.x,dy=this.hero.y-e.y,l=Math.hypot(dx,dy)||1;
      const behavior=e.behavior||(e.charger?'charge':'chase');
      const burst=behavior==='charge'&&e.timer%3.2>2.6?2.7:behavior==='pulse'?(e.timer%1.6>.9?1.7:.45):1;
      const speed=e.speed*burst;
      const weave=behavior==='zigzag'?Math.sin(e.timer*4+e.id)*.42:0;
      const vx=dx/l-dy/l*weave,vy=dy/l+dx/l*weave,vl=Math.hypot(vx,vy)||1;
      e.x=clamp(e.x+vx/vl*speed*dt,-MAP.width/2+.35,MAP.width/2-.35);
      e.y=clamp(e.y+vy/vl*speed*dt,-MAP.height/2+.35,MAP.height/2-.35);
      if(this.grace<=0&&Math.hypot(dx,dy)<(e.radius??(e.charger?.5:.36))+.26){
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
      this.shots=[];return'checkpoint';
    }
    return null;
  }
}

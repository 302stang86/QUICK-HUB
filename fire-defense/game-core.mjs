export const ROOM_LIMIT = 30;
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
    this.score=0;this.time=0;this.health=6;this.maxHealth=6;this.hero={x:0,y:-2};
    this.enemies=[];this.shots=[];this.fx=[];this.aim={x:1,y:0};this.moving=false;
    this.cooldown=0;this.specialCooldown=0;this.grace=0;this.charges=0;this.id=0;
  }
  newRun(){
    this.room=1;this.cleared=0;this.score=0;this.time=0;this.health=this.maxHealth;
    this.hero={x:0,y:-2};this.mode='active';this.grace=1;this.spawnRoom();
  }
  spawnRoom(){
    this.enemies=[];this.shots=[];this.fx=[];this.cooldown=0;this.specialCooldown=0;
    this.charges=2+(this.profile.foam>0?1:0)+(this.profile.cannon>0?1:0);
    const count=Math.min(26,3+this.room*2);
    for(let i=0;i<count;i++) {
      let p;
      for(let attempt=0;attempt<40;attempt++){
        p={x:this.random()*11-5.5,y:this.random()*8-4};
        if(Math.hypot(p.x-this.hero.x,p.y-this.hero.y)>3)break;
      }
      if(Math.hypot(p.x-this.hero.x,p.y-this.hero.y)<3)p={x:this.hero.x>0?-5.5:5.5,y:4};
      const charger=this.room>=3&&i%3===0;
      const hp=(charger?5:3)+this.room*.3;
      this.enemies.push({...p,id:++this.id,hp,maxHp:hp,charger,speed:(charger?.9:.62)+this.room*.022,
        timer:this.random()*3.2,flash:0});
    }
  }
  nextRoom(){
    if(this.mode!=='clear')return false;
    this.room++;this.hero={x:0,y:-2};this.mode='active';this.grace=1;this.spawnRoom();return true;
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
      this.score+=enemy.charger?200:100;
      this.profile.credits=clamp(this.profile.credits+(enemy.charger?8:5),0,1000000);
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
    dt=clamp(dt,0,.05);this.time+=dt;this.cooldown-=dt;this.grace-=dt;this.specialCooldown=Math.max(0,this.specialCooldown-dt);
    const length=Math.hypot(move.x,move.y),scale=length>1?1/length:1;
    this.moving=length>.01;
    this.hero.x=clamp(this.hero.x+move.x*scale*3.6*dt,-5.6,5.6);
    this.hero.y=clamp(this.hero.y+move.y*scale*3.6*dt,-4.1,4.1);
    if(this.enemies.length&&this.cooldown<=0){
      let nearest=this.enemies[0];
      for(const e of this.enemies)if((e.x-this.hero.x)**2+(e.y-this.hero.y)**2<(nearest.x-this.hero.x)**2+(nearest.y-this.hero.y)**2)nearest=e;
      const dx=nearest.x-this.hero.x,dy=nearest.y-this.hero.y,l=Math.hypot(dx,dy)||1;
      this.aim={x:dx/l,y:dy/l};
      this.shots.push({...this.hero,vx:dx/l*14,vy:dy/l*14,life:1.4,damage:1+this.profile.nozzle*.35});
      this.cooldown=.19/(1+this.profile.nozzle*.08);
    }
    for(let i=this.shots.length-1;i>=0;i--){
      const s=this.shots[i],old={x:s.x,y:s.y};s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
      let hit=null,first=Infinity;
      for(const e of this.enemies){const t=firstHit(old,s,e,e.charger?.5:.36);if(t!==null&&t<first){first=t;hit=e;}}
      if(hit){this.damage(hit,s.damage);s.life=0;}
      if(s.life<=0||Math.abs(s.x)>7||Math.abs(s.y)>6)this.shots.splice(i,1);
    }
    for(const e of this.enemies){
      e.timer+=dt;e.flash=Math.max(0,e.flash-dt);
      const dx=this.hero.x-e.x,dy=this.hero.y-e.y,l=Math.hypot(dx,dy)||1;
      const speed=e.speed*(e.charger&&e.timer%3.2>2.6?2.7:1);
      e.x+=dx/l*speed*dt;e.y+=dy/l*speed*dt;
      if(this.grace<=0&&Math.hypot(dx,dy)<(e.charger?.75:.6)){
        this.health--;this.grace=1.1;
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

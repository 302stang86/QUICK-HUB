import {ENEMY_ROSTER} from './enemy-roster.mjs';
import {pinchZoom} from './viewport.mjs';
import { drawRookieWobble } from './rookie-wobble.mjs';
import { drawFireEnemy } from './enemy-art.mjs';
import { Engine, EQUIPMENT, MAP, iso, movementFromScreen, clamp } from './game-core.mjs';
import { WEAPONS, WEAPON_KEYS, UPGRADES, UPGRADE_BY_ID } from './weapons.mjs';
// The hero is drawn at half of its previous size (enemies carry their own visualScale).
const HERO_SCALE=.5;
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const navy='#12283c',muted='#7594a9';
import { computeStats } from './weapons.mjs';
const computeFor=(e,key)=>computeStats(key,e.profile,{});
class FireDefense {
  constructor(){
    this.zoom=1;this.camera={x:0,y:0};this.touchPoints=new Map();this.pinchActive=false;this.pinchStart=null;
    this.loaded=false;this.engine=null;this.paused=false;this.pending=null;this.saving=false;this.saveMessage='';this.keys=new Set();this.stick={x:0,y:0};this.pointer=null;this.readyMenu='';this.time=0;this.w=1;this.h=1;this.shake=0;
    this.resize();window.addEventListener('resize',()=>this.resize());
    this.bind();this.last=performance.now();requestAnimationFrame(t=>this.frame(t));
  }
  resize(){this.w=innerWidth;this.h=innerHeight;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(this.w*ratio);canvas.height=Math.round(this.h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);this.ratio=ratio;this.baseUnit=Math.min(this.w/19,this.h/11.6);this.unit=this.baseUnit*this.zoom;this.updateCamera(0,true);this.updateView();}
  bind(){
    addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||!$('gate').hidden||$('board').open||$('bestiary').open)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();this.keys.add(e.key.toLowerCase());if(e.key==='Escape')this.togglePause();if(e.code==='Space'&&!e.repeat)this.special();});
    addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
    const clear=()=>{this.keys.clear();this.stick={x:0,y:0};this.pointer=null;$('stick-knob').style.transform='';};
    this.clearInput=clear;
    addEventListener('blur',()=>{clear();if(this.engine?.mode==='active'){this.paused=true;this.updateView();}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();if(this.engine?.mode==='active'){this.paused=true;this.updateView();}}});
    const zone=$('joystick-zone');
    zone.addEventListener('pointerdown',e=>{if(this.pointer!==null||this.pinchActive)return;e.preventDefault();this.pointer=e.pointerId;zone.setPointerCapture(e.pointerId);this.joystick(e);});
    zone.addEventListener('pointermove',e=>{if(e.pointerId===this.pointer)this.joystick(e);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(name,e=>{if(e.pointerId===this.pointer)clear();});
    this.bindPinch();
    $('zoom-reset').onclick=()=>this.setZoom(1);
    $('enemy-guide').onclick=()=>this.showEnemyGuide();
    $('close-bestiary').onclick=()=>{$('bestiary').close();canvas.focus();};
    $('pause').onclick=()=>this.togglePause();
    $('special').onclick=()=>this.special();
    $('continue').onclick=()=>{
      if(this.saving||this.pending||!this.loaded)return;
      if(!this.paused&&this.engine.mode==='clear'&&this.engine.offer.length)return;
      if(this.paused){this.paused=false;}
      else if(this.engine.mode==='clear')this.engine.nextRoom();
      else this.engine.newRun();
      this.clearInput();this.updateCamera(0,true);this.readyMenu='';this.updateView();canvas.focus();
    };
    $('leaderboard').onclick=()=>window.FDEC?.board();
    $('retry').onclick=()=>{if(this.pending&&!this.saving)this.sendPending();};
    addEventListener('beforeunload',e=>{if(this.pending){e.preventDefault();e.returnValue='';}});
  }
  updateCamera(dt,snap=false){
    const target=this.engine?.hero||{x:0,y:0},blend=snap?1:1-Math.exp(-dt*9);
    this.camera.x+=(target.x-this.camera.x)*blend;this.camera.y+=(target.y-this.camera.y)*blend;
    const p=iso(this.camera.x,this.camera.y);this.center={x:this.w*.5-p.x*this.unit,y:this.h*.53+p.y*this.unit};
  }
  setZoom(value){this.zoom=pinchZoom(value,1,1);this.unit=this.baseUnit*this.zoom;this.updateCamera(0,true);$('zoom-reset').textContent=Math.round(this.zoom*100)+'%';}
  bindPinch(){
    const distance=()=>{const p=[...this.touchPoints.values()];return p.length>=2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;};
    window.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='touch'||!this.loaded||!$('gate').hidden)return;
      if(event.target!==canvas&&!event.target.closest('#joystick-zone'))return;
      this.touchPoints.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(this.touchPoints.size===2){this.pinchActive=true;this.clearInput();this.pinchStart={distance:distance(),zoom:this.zoom};event.preventDefault();}
    },{capture:true,passive:false});
    window.addEventListener('pointermove',event=>{
      if(!this.touchPoints.has(event.pointerId))return;
      this.touchPoints.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(this.pinchActive&&this.touchPoints.size>=2&&this.pinchStart){event.preventDefault();this.setZoom(pinchZoom(this.pinchStart.zoom,this.pinchStart.distance,distance()));}
    },{capture:true,passive:false});
    const finish=event=>{this.touchPoints.delete(event.pointerId);if(!this.touchPoints.size){this.pinchActive=false;this.pinchStart=null;}};
    window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);
    window.addEventListener('blur',()=>{this.touchPoints.clear();this.pinchActive=false;this.pinchStart=null;});
    canvas.addEventListener('dblclick',event=>event.preventDefault());
    for(const type of ['gesturestart','gesturechange'])canvas.addEventListener(type,event=>event.preventDefault(),{passive:false});
  }
  showEnemyGuide(){
    const host=$('enemy-roster');host.replaceChildren();
    for(const [tier,title] of [['base','20 base enemies'],['mini','10 mini-bosses'],['boss','5 major bosses']]){
      const section=document.createElement('details');section.open=tier==='base';
      const summary=document.createElement('summary');summary.textContent=title;section.append(summary);
      const table=document.createElement('table');const header=document.createElement('tr');
      for(const text of ['Enemy / behavior','HP','Damage','Speed','Debut']){const th=document.createElement('th');th.textContent=text;header.append(th);}table.append(header);
      for(const enemy of ENEMY_ROSTER.filter(e=>e.tier===tier)){
        const row=document.createElement('tr');
        for(const [index,value] of [enemy.name+' — '+enemy.description,enemy.hp,enemy.attack,enemy.speed,'Room '+enemy.unlock].entries()){
          const td=document.createElement('td');td.textContent=value;if(index===0)td.className='enemy-name';row.append(td);
        }table.append(row);
      }
      section.append(table);host.append(section);
    }
    $('bestiary').showModal();
  }
  joystick(e){const r=$('stick-base').getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const length=Math.hypot(x,y),max=r.width*.38;if(length>max){x*=max/length;y*=max/length;}this.stick=length<6?{x:0,y:0}:{x:x/max,y:y/max};$('stick-knob').style.transform=`translate(${x}px,${y}px)`;}
  loadProfile(profile){this.engine=new Engine(profile);this.camera={x:0,y:0};this.updateCamera(0,true);this.loaded=true;this.paused=false;this.pending=null;this.saving=false;this.saveMessage='Progress connected to your employee account.';this.readyMenu='';this.updateView();}
  block(message){this.loaded=false;this.paused=true;this.clearInput();this.saveMessage=message;this.updateView();}
  receive(method,value){if(method==='OnCloudProfile')this.loadProfile(typeof value==='string'?JSON.parse(value):value);else if(method==='OnCloudBlocked')this.block(value);else if(method==='OnCloudSaved')this.saved(typeof value==='string'?JSON.parse(value):value);}
  saved(reply){this.saving=false;if(reply.ok){this.engine.profile.revision=reply.revision;this.pending=null;this.saveMessage=reply.message||'✓ Progress saved';}else this.saveMessage=reply.message||'Save failed. Reconnect and retry.';this.readyMenu='';this.updateView();}
  checkpoint(){
    if(!this.loaded||this.pending)return;
    const e=this.engine,p=e.profile;
    const saveId=crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
    this.pending={credits:p.credits,nozzle:p.nozzle,foam:p.foam,cannon:p.cannon,revision:p.revision,nickname:p.nickname,room:e.cleared,score:e.score,elapsedMs:Math.max(1,Math.round(e.time*1000)),saveId};
    this.sendPending();
  }
  sendPending(){this.saving=true;this.saveMessage='Saving progress…';this.updateView();window.FDEC?.save(JSON.stringify(this.pending));}
  togglePause(){if(!this.loaded||this.engine.mode!=='active'||!$('gate').hidden)return;this.paused=!this.paused;this.clearInput();this.readyMenu='';this.updateView();}
  special(){if(!this.loaded||this.paused||!$('gate').hidden||this.h>this.w||$('board').open||$('bestiary').open)return;if(this.engine.special()){this.shake=.18;this.updateHUD();}}
  updateHUD(){if(!this.engine)return;const e=this.engine;$('room').textContent=String(e.room).padStart(2,'0')+' / 30';$('health').textContent=e.health+' / '+e.maxHealth;$('score').textContent=e.score.toLocaleString();$('credits').textContent=e.profile.credits.toLocaleString();$('floor-label').firstChild.textContent='SECTOR '+String(e.room).padStart(2,'0')+' ';const unlocked=e.profile.foam||e.profile.cannon;$('special').disabled=!unlocked||e.charges<=0||e.specialCooldown>0;$('special-name').textContent=e.profile.cannon?'WATER CANNON':'FOAM BURST';$('encounter-banner').hidden=!(e.mode==='active'&&e.encounterTimer>0&&!this.paused);$('encounter-banner').textContent=e.roomEvent||'';const st=e.stats(),owned=UPGRADES.filter(u=>e.upgrades[u.id]).map(u=>u.name+(u.max>1?' ×'+e.upgrades[u.id]:''));$('loadout').hidden=!(e.mode==='active'||e.mode==='clear');$('loadout').innerHTML='<b></b><br><span></span><br><i></i>';const lo=$('loadout');lo.querySelector('b').textContent=WEAPONS[e.weapon].name+' · '+st.damage.toFixed(1)+' dmg · '+Math.round(st.critChance*100)+'% crit';lo.querySelector('span').textContent=owned.join(' · ');lo.querySelector('i').textContent='Enemies left '+e.remaining()+(e.specialQueue.length?' · boss arrives at 50%':'');$('special-state').textContent=!unlocked?'Unlock in equipment':e.specialCooldown>0?Math.ceil(e.specialCooldown)+'s cooldown':e.charges+' charges · Space';}
  updateView(){
    if(!$('menu'))return;
    const e=this.engine;const active=this.loaded&&e?.mode==='active'&&!this.paused;
    $('hud').hidden=!this.loaded;$('controls').hidden=!active;$('menu').hidden=!this.loaded||active;
    $('rotate').hidden=!this.loaded||this.w>=this.h;$('pause').textContent=this.paused?'Resume ▶':'Pause ⏸';
    if(!this.loaded||!e)return;
    this.updateHUD();
    const menuMode=this.paused?'pause':e.mode;
    const labels={ready:['RESPONSE BRIEFING','Ready for response?','Clear each room with your hose. Keep moving—the water aims for you.','Start response →'],clear:['SECTOR SECURED','Room '+e.room+' cleared.','Supplies collected. Recover 1 health and prepare for the next room.','Next room →'],defeat:['RESPONSE COMPLETE','The fire won this round.','Your permanent gear and earned credits stay with you. Start a fresh run.','Try again →'],victory:['WAREHOUSE SECURED','All 30 rooms cleared.','Outstanding response. Upgrade your equipment and take on a new run.','New response →'],pause:['TAKE A BREATHER','Response paused.','Your active play clock is paused.','Resume response →']};
    const text=labels[menuMode]||labels.ready;
    $('menu-eyebrow').textContent=text[0];$('menu-title').textContent=text[1];$('menu-description').textContent=text[2];$('continue').textContent=text[3];
    $('run-stats').textContent=e.profile.nickname+'  ·  '+e.profile.credits.toLocaleString()+' credits'+(e.cleared?'  ·  '+e.cleared+' rooms secured':'');
    $('continue').disabled=this.saving||!!this.pending;
    $('save-status').textContent=this.saveMessage;$('retry').hidden=!this.pending||this.saving;
    $('shop').hidden=menuMode==='pause';
    const pickWeapon=['ready','defeat','victory'].includes(menuMode),pickUpgrade=menuMode==='clear'&&e.offer.length>0;
    $('picker').hidden=!(pickWeapon||pickUpgrade);
    if(pickUpgrade)$('continue').disabled=true;
    const key=menuMode+JSON.stringify(e.profile)+this.saving+!!this.pending+e.weapon+JSON.stringify(e.upgrades)+e.offer.join();
    if(this.readyMenu!==key){
      this.readyMenu=key;
      this.buildPicker(e,pickWeapon,pickUpgrade);
      $('shop').replaceChildren();
      for(const [index,item] of EQUIPMENT.entries()){
        const card=document.createElement('article');card.className='gear';
        const icon=document.createElement('span');icon.className='gear-icon';icon.textContent=['⌁','◌','✦'][index];
        const heading=document.createElement('h3');heading.textContent=item.name;
        const level=document.createElement('span');level.className='level';level.textContent='LEVEL '+e.profile[item.key]+' / '+item.max;
        const description=document.createElement('p');description.textContent=item.description;
        const buy=document.createElement('button');buy.textContent=e.profile[item.key]>=item.max?'Fully upgraded':e.price(item.key)+' credits';
        buy.disabled=this.saving||!!this.pending||e.profile[item.key]>=item.max||e.profile.credits<e.price(item.key);
        buy.onclick=()=>{if(!this.pending&&!this.saving&&e.buy(item.key)){this.checkpoint();this.readyMenu='';this.updateView();}};
        card.append(icon,heading,level,description,buy);$('shop').append(card);
      }
    }
  }
  buildPicker(e,pickWeapon,pickUpgrade){
    const host=$('picker-cards');host.replaceChildren();
    const card=(icon,name,lines,label,selected,onclick,disabled)=>{
      const c=document.createElement('article');c.className='gear'+(selected?' sel':'');
      const i=document.createElement('span');i.className='gear-icon';i.textContent=icon;
      const h=document.createElement('h3');h.textContent=name;c.append(i,h);
      for(const [cls,text] of lines){const p=document.createElement(cls==='p'?'p':'span');if(cls!=='p')p.className=cls;p.textContent=text;if(cls!=='p')p.style.display='block';c.append(p);}
      const b=document.createElement('button');b.textContent=label;b.disabled=!!disabled;b.onclick=onclick;c.append(b);host.append(c);
    };
    if(pickWeapon){
      $('picker-title').textContent='CHOOSE YOUR WEAPON';
      for(const k of WEAPON_KEYS){
        const w=WEAPONS[k],st=computeFor(e,k);
        card(w.icon,w.name,[['p',w.trait],['stat','DMG '+st.damage.toFixed(2)+' · '+(1/st.interval).toFixed(1)+'/s'],['stat','RANGE '+Math.round(st.range)+' · CRIT '+Math.round(st.critChance*100)+'%']],e.weapon===k?'Equipped':'Equip',e.weapon===k,()=>{if(e.setWeapon(k)){this.readyMenu='';this.updateView();}},e.weapon===k);
      }
    }else if(pickUpgrade){
      $('picker-title').textContent='PICK AN UPGRADE · THIS RUN ONLY';
      for(const id of e.offer){
        const u=UPGRADE_BY_ID[id],n=e.upgrades[id]||0;
        card(u.icon,u.name,[['p',u.description],['owned',n?'OWNED ×'+n+(u.max>1?' / '+u.max:''):(u.max>1?'MAX ×'+u.max:'ONE-TIME')]],'Take',false,()=>{if(e.chooseUpgrade(id)){this.readyMenu='';this.updateHUD();this.updateView();}},false);
      }
    }
  }
  frame(now){const dt=Math.min((now-this.last)/1000,.05);this.last=now;this.time+=dt;this.shake=Math.max(0,this.shake-dt);
    if(this.loaded&&!this.paused&&this.w>=this.h&&$('gate').hidden&&!$('board').open&&!$('bestiary').open){
      let x=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0),y=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0);
      if(Math.hypot(this.stick.x,this.stick.y)>.1){x=this.stick.x;y=this.stick.y;}if(this.pinchActive){x=0;y=0;}
      const event=this.engine.step(dt,movementFromScreen(x,y));
      if(event==='checkpoint'){this.clearInput();this.checkpoint();this.readyMenu='';this.updateView();}
      this.updateHUD();
    }
    this.updateCamera(dt);this.render();requestAnimationFrame(t=>this.frame(t));
  }
  project(x,y,z=0){const p=iso(x,y);return{x:this.center.x+p.x*this.unit,y:this.center.y-p.y*this.unit-z*this.unit};}
  polygon(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  tile(x,y,fill){this.polygon([this.project(x,y),this.project(x+1,y),this.project(x+1,y+1),this.project(x,y+1)],fill,'#c6e7ed0c');}
  box(x,y,w,d,h,top,left,right){const a=this.project(x,y),b=this.project(x+w,y),c=this.project(x+w,y+d),f=this.project(x,y+d);const at=this.project(x,y,h),bt=this.project(x+w,y,h),ct=this.project(x+w,y+d,h),ft=this.project(x,y+d,h);this.polygon([a,b,bt,at],left);this.polygon([a,f,ft,at],right);this.polygon([at,bt,ct,ft],top,'#ffffff16');}
  ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  line(a,b,color,width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
  render(){
    const {w,h,unit:u}=this,R=MAP.radius;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,w,h);
    const backdrop=ctx.createRadialGradient(w*.53,h*.45,0,w*.5,h*.5,w*.7);backdrop.addColorStop(0,'#1b3549');backdrop.addColorStop(1,'#071323');ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);
    ctx.save();if(this.shake>0)ctx.translate(Math.sin(this.time*140)*3,Math.cos(this.time*120)*2);
    // Round arena (about 52 units across). The isometric view turns the disc into an ellipse:
    // semi-axes are R·0.72·√2 across and R·0.36·√2 down, in world units.
    const o=this.project(0,0),RX=R*1.0182,RY=R*.5091;
    const ring=(radius,lift=0)=>{ctx.beginPath();ctx.ellipse(o.x,o.y-lift*u,radius*1.0182*u,radius*.5091*u,0,0,Math.PI*2);};
    // Slab edge under the floor gives the disc some thickness.
    ring(R+.35,-.22);ctx.fillStyle='#102431';ctx.fill();ring(R+.2,0);ctx.fillStyle='#243f50';ctx.fill();
    // Floor tiles, clipped to the disc and culled to what is on screen.
    ctx.save();ring(R,0);ctx.clip();
    const pad=u*1.3;
    for(let x=-Math.ceil(R);x<Math.ceil(R);x++)for(let y=-Math.ceil(R);y<Math.ceil(R);y++){
      if(Math.hypot(x+.5,y+.5)>R+.8)continue;
      const c=this.project(x+.5,y+.5);if(c.x<-pad||c.x>w+pad||c.y<-pad||c.y>h+pad)continue;
      this.tile(x,y,(x+Math.floor(y))%2?'#3a5360':'#354d5c');
    }
    // Faint ring marking where enemies can appear.
    ring(R*MAP.edgeBand,0);ctx.setLineDash([u*.35,u*.25]);ctx.strokeStyle='#c6e7ed26';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
    // Safety perimeter: solid line with yellow hazard dashes.
    ring(R-.1,0);ctx.strokeStyle='#f5bd6d88';ctx.lineWidth=2;ctx.stroke();
    ring(R-.35,0);ctx.setLineDash([u*.3,u*.22]);ctx.strokeStyle='#e9b96e75';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
    // Back railing: posts and a red service pipe along the far half of the rim.
    const rail=[];
    for(let deg=-45;deg<=135;deg+=4){const a=deg*Math.PI/180;rail.push([Math.cos(a)*(R+.25),Math.sin(a)*(R+.25)]);}
    ctx.beginPath();rail.forEach(([x,y],i)=>{const p=this.project(x,y,1.1);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.strokeStyle='#8f3b42';ctx.lineWidth=u*.075;ctx.lineJoin='round';ctx.stroke();
    for(let deg=-45;deg<=135;deg+=8){const a=deg*Math.PI/180;this.box(Math.cos(a)*(R+.25)-.06,Math.sin(a)*(R+.25)-.06,.12,.12,1.65,'#718a97','#365161','#416375');}
    // Stacked crates outside the rim on the left side.
    for(let i=0;i<4;i++){
      const a=(196+i*9)*Math.PI/180,cx=Math.cos(a)*(R+1.1),cy=Math.sin(a)*(R+1.1);
      this.box(cx-.16,cy-.25,.33,.5,.1,'#675649','#3b3836','#4e433a');
      this.box(cx-.135,cy-.225,.275,.41,.35,'#a07e57','#6f543c','#846643');
    }
    // Loading bay painted on the floor.
    ctx.save();const sign=this.project(-1,-(R-3));ctx.translate(sign.x,sign.y);ctx.transform(.9,-.45,.9,.45,0,0);ctx.font=`800 ${u*.18}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#bfd0d13b';ctx.fillText('FDEC  /  RESPONSE ZONE',0,0);ctx.restore();
    const e=this.engine;
    // Foam puddles lie on the floor under everything else.
    if(e)for(const pd of e.puddles){const o2=this.project(pd.x,pd.y),k=Math.min(1,pd.life/.6),rr=pd.r*u;ctx.save();ctx.globalAlpha=.55*k;ctx.beginPath();ctx.ellipse(o2.x,o2.y,rr*1.0182,rr*.5091,0,0,Math.PI*2);ctx.fillStyle='#8fe9c4';ctx.fill();ctx.globalAlpha=.9*k;ctx.lineWidth=2;ctx.strokeStyle='#d8fff0';ctx.stroke();ctx.restore();}
    let actors=e?[...e.enemies.map(a=>({kind:'enemy',...a})),{kind:'hero',...e.hero}]:[{kind:'hero',x:1,y:-1},{kind:'enemy',x:-2,y:2,charger:false,timer:1,flash:0,hp:3,maxHp:3},{kind:'enemy',x:3,y:2,charger:true,timer:2,flash:0,hp:5,maxHp:5},{kind:'enemy',x:-3,y:0,charger:false,timer:1,flash:0,hp:3,maxHp:3}];
    actors.sort((a,b)=>(b.x+b.y)-(a.x+a.y));
    for(const a of actors){if(a.kind==='hero')this.drawHero(a,e);else this.drawEnemy(a);}
    if(e){
      // Frost Orbs circling the hero.
      const orbCount=e.stats().orbs;
      if(orbCount>0)for(const orb of e.orbPositions(orbCount)){const q=this.project(orb.x,orb.y,.35);ctx.save();ctx.shadowColor='#9fe3ff';ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(q.x,q.y-9);ctx.lineTo(q.x+5.5,q.y);ctx.lineTo(q.x,q.y+9);ctx.lineTo(q.x-5.5,q.y);ctx.closePath();ctx.fillStyle='#d6f4ff';ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#6fc8ff';ctx.stroke();ctx.restore();}
      for(const s of e.shots){
        const p=this.project(s.x,s.y,.2),tail=this.project(s.x-s.vx*.024,s.y-s.vy*.024,.2),lv=e.profile.nozzle;
        if(s.kind==='balloon'){this.ellipse(p.x,p.y+1,7.5,8.5,s.crit?'#fff3b0':'#4fb4ee');this.ellipse(p.x,p.y+1,7.5,8.5,'#ffffff22');this.ellipse(p.x-2.4,p.y-2.4,2.4,3,'#e6f8ff');this.line({x:p.x,y:p.y+9},{x:p.x+1.5,y:p.y+12},'#2d86bd',1.5);}
        else if(s.kind==='foam'){this.line(this.project(s.x-s.vx*.035,s.y-s.vy*.035,.2),p,'#7fe3b166',6);this.ellipse(p.x,p.y,s.crit?6.5:5,s.crit?6.5:5,'#d6ffe8');this.ellipse(p.x-1,p.y-1,2,2,'#ffffff');}
        else{this.line(tail,p,s.crit?'#fff29a':'#a8f1ff',(s.crit?5:3)+lv*.3);this.ellipse(p.x,p.y,s.crit?3.5:2.5,s.crit?3.5:2.5,s.crit?'#fffbe0':'#e8fcff');}
      }
      for(const f of e.fx)this.drawEffect(f);
      if(e.grace>.85&&e.health<e.maxHealth){ctx.fillStyle='#f64c4c0b';ctx.fillRect(0,0,w,h);}
    }
    // Ambient embers remain decorative; combat is fully paused behind menus.
    for(let i=0;i<18;i++){const x=(Math.sin(i*32.4)*.5+.5)*w,y=(h-(this.time*(12+i%5)+i*43)%h);this.ellipse(x,y,1,1.7,'#fbbd6940');}
    ctx.restore();
    if(this.loaded&&e)this.drawMinimap(e);
  }
  drawMinimap(e){
    const d=this.h<450?84:112,rad=d/2,cx=this.w-rad-16,cy=(this.h<450?74:100)+rad+8;
    ctx.save();ctx.fillStyle='#081725cc';ctx.beginPath();ctx.arc(cx,cy,rad+6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#839eb866';ctx.lineWidth=1;ctx.stroke();
    ctx.strokeStyle='#839eb833';ctx.beginPath();ctx.arc(cx,cy,rad*MAP.edgeBand,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#a8c6d9';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText('MAP ×5',cx,cy-rad-8+2);
    const plot=p=>({x:cx+(p.x/MAP.radius)*rad,y:cy-(p.y/MAP.radius)*rad});
    for(const enemy of e.enemies){const p=plot(enemy);ctx.fillStyle=enemy.tier==='boss'?'#ff626c':enemy.tier==='mini'?'#c796ff':'#edac63';ctx.beginPath();ctx.arc(p.x,p.y,enemy.tier==='boss'?3:enemy.tier==='mini'?2:1.2,0,Math.PI*2);ctx.fill();}
    const p=plot(e.hero);ctx.fillStyle='#d6fbff';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  drawHero(a,e){
    const p=this.project(a.x,a.y),active=e?.mode==='active'&&!this.paused;
    const interval=e?.interval||.19;
    const shooting=!!(active&&e.enemies.length);
    const recoil=shooting?Math.max(0,(e.cooldown-(interval-.10))/.10):0;
    if(!drawRookieWobble(ctx,{x:p.x,y:p.y,unit:this.unit*HERO_SCALE,time:this.time,
      moving:!!(active&&e.moving),aim:e?iso(e.aim.x,e.aim.y):{x:1,y:0},
      celebrate:!!(e&&(e.mode==='clear'||e.mode==='victory')),shooting,recoil,
      upgrades:e?.profile||{},hurt:!!(active&&e.grace>0&&e.health<e.maxHealth)}))this.drawHeroFallback(a,e);
  }
  drawHeroFallback(a,e){
    const p=this.project(a.x,a.y),u=this.unit*HERO_SCALE;ctx.save();ctx.translate(p.x,p.y);
    const walk=e?.moving&&e.mode==='active'&&!this.paused?Math.sin(this.time*16):0;const aim=e?iso(e.aim.x,e.aim.y):{x:.8,y:.1};const facing=aim.x>=0?1:-1;
    this.ellipse(0,0,u*.40,u*.15,'#07151c77');
    // Hose trailing behind the firefighter.
    ctx.beginPath();ctx.moveTo(-facing*u*.25,-u*.45);ctx.bezierCurveTo(-facing*u*.8,-u*.15,-facing*u*.5,u*.2,-facing*u,u*.13);ctx.strokeStyle='#bb9c69';ctx.lineWidth=u*.065;ctx.stroke();
    ctx.translate(0,Math.abs(walk)*-u*.025);
    ctx.fillStyle='#102235';ctx.fillRect(-u*.24,-u*.24+walk*u*.035,u*.19,u*.29);ctx.fillRect(u*.07,-u*.24-walk*u*.035,u*.19,u*.29);
    ctx.fillStyle='#b49d65';ctx.fillRect(-u*.23,-u*.39,u*.18,u*.21);ctx.fillRect(u*.06,-u*.39,u*.18,u*.21);
    ctx.fillStyle='#e5e888';ctx.fillRect(-u*.23,-u*.24,u*.18,u*.055);ctx.fillRect(u*.06,-u*.24,u*.18,u*.055);
    this.ellipse(-facing*u*.25,-u*.58,u*.13,u*.28,'#7898aa');this.ellipse(-facing*u*.26,-u*.63,u*.07,u*.22,'#bfd0cc');
    ctx.fillStyle='#192b36';ctx.fillRect(-facing*u*.26-u*.1,-u*.6,u*.20,u*.07);
    this.ellipse(0,-u*.48,u*.29,u*.30,'#cfb276');
    ctx.fillStyle='#dddf85';ctx.fillRect(-u*.27,-u*.48,u*.54,u*.065);ctx.fillRect(-u*.17,-u*.69,u*.055,u*.29);ctx.fillRect(u*.12,-u*.69,u*.055,u*.29);
    this.line({x:-u*.2,y:-u*.69},{x:u*.16,y:-u*.43},'#23323a',u*.045);
    this.ellipse(0,-u*.88,u*.20,u*.20,'#d6b392');this.ellipse(facing*u*.045,-u*.86,u*.16,u*.115,'#263849');
    this.line({x:-u*.1,y:-u*.9},{x:u*.14,y:-u*.91},'#99c7cf',u*.026);
    this.ellipse(0,-u*1.04,u*.30,u*.17,'#b72d3a');this.ellipse(-u*.045,-u*1.08,u*.24,u*.12,'#f45552');
    this.line({x:-u*.33,y:-u*.97},{x:u*.34,y:-u*.97},'#f26c63',u*.055);
    ctx.fillStyle='#fce5a0';ctx.fillRect(-u*.045,-u*1.16,u*.09,u*.12);
    // Arms and upgraded nozzle point toward the target.
    const angle=Math.atan2(-aim.y,aim.x);ctx.save();ctx.translate(facing*u*.08,-u*.55);ctx.rotate(angle);
    this.line({x:0,y:0},{x:u*.35,y:0},'#c6a967',u*.15);
    this.line({x:u*.3,y:0},{x:u*.43,y:0},'#243546',u*.12);
    const level=e?.profile.nozzle||0;const color=e?.profile.cannon?'#e8c571':e?.profile.foam?'#99e0bb':'#8ad6ea';
    this.line({x:u*.40,y:0},{x:u*(.73+level*.035),y:0},color,u*(.08+level*.008));
    this.line({x:u*.49,y:-u*.06},{x:u*.49,y:u*.06},'#273d4b',u*.04);
    if(e?.profile.foam)this.ellipse(u*.36,u*.10,u*.07,u*.08,'#9fd4b8');ctx.restore();
    if(e?.grace>0&&e.mode==='active'&&Math.floor(this.time*12)%2===0){ctx.globalAlpha=.2;this.ellipse(0,-u*.55,u*.45,u*.65,'#e4fbff');}
    ctx.restore();
  }
  drawEnemy(a){
    const p=this.project(a.x,a.y),e=this.engine;
    drawFireEnemy(ctx,{x:p.x,y:p.y,unit:this.unit*(a.visualScale||1),time:this.time,id:a.id||0,charger:a.tier==='mini'||a.tier==='boss'||!!a.charger,
      palette:a.palette,crest:a.crest,tier:a.tier,name:a.name,
      hp:a.hp,maxHp:a.maxHp,flash:a.flash||0,
      heading:e?iso(e.hero.x-a.x,e.hero.y-a.y):{x:1,y:0},charging:!!(a.charger&&a.timer%3.2>2.2)});
  }
  drawEffect(f){const p=this.project(f.x,f.y,.3),t=1-f.life/f.total,u=this.unit;ctx.save();ctx.globalAlpha=1-t;
    if(f.type==='burst'){const r=f.radius*u*t;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.5,0,0,Math.PI*2);ctx.fillStyle='#c2fff51a';ctx.fill();ctx.lineWidth=5*(1-t)+1;ctx.strokeStyle='#c2fff5';ctx.stroke();}
    else if(f.type==='steam'){for(let i=0;i<4;i++)this.ellipse(p.x+(i-1.5)*u*.08,p.y-u*(.1+t*.4)-Math.sin(i)*u*.05,u*(.05+t*.08),u*(.07+t*.1),'#d2e6db');}
    else if(f.type==='crit'){for(let i=0;i<10;i++){const angle=i/10*Math.PI*2,r=t*u*.4;this.ellipse(p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r,2.6,2.6,'#ffe27a');}}
    else if(f.type==='splash'){for(let i=0;i<7;i++){const angle=i/7*Math.PI*2,r=t*u*.25;this.ellipse(p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r,2,2,'#aef0fc');}}
    else{ctx.strokeStyle='#ff7a73';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,u*(.13+t*.3),0,Math.PI*2);ctx.stroke();}
    ctx.restore();}
}
export const game=new FireDefense();

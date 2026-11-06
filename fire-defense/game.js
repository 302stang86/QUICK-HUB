import {ENEMY_ROSTER} from './enemy-roster.mjs';
import {pinchZoom} from './viewport.mjs';
import { drawRookieWobble } from './rookie-wobble.mjs';
import { drawFireEnemy } from './enemy-art.mjs';
import { Engine, EQUIPMENT, MAP, iso, movementFromScreen, clamp } from './game-core.mjs';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const navy='#12283c',muted='#7594a9';
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
  updateHUD(){if(!this.engine)return;const e=this.engine;$('room').textContent=String(e.room).padStart(2,'0')+' / 30';$('health').textContent=e.health+' / '+e.maxHealth;$('score').textContent=e.score.toLocaleString();$('credits').textContent=e.profile.credits.toLocaleString();$('floor-label').firstChild.textContent='SECTOR '+String(e.room).padStart(2,'0')+' ';const unlocked=e.profile.foam||e.profile.cannon;$('special').disabled=!unlocked||e.charges<=0||e.specialCooldown>0;$('special-name').textContent=e.profile.cannon?'WATER CANNON':'FOAM BURST';$('encounter-banner').hidden=!(e.mode==='active'&&e.encounterTimer>0&&!this.paused);$('encounter-banner').textContent=e.roomEvent||'';$('special-state').textContent=!unlocked?'Unlock in equipment':e.specialCooldown>0?Math.ceil(e.specialCooldown)+'s cooldown':e.charges+' charges · Space';}
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
    if(this.readyMenu!==menuMode+JSON.stringify(e.profile)+this.saving+!!this.pending){
      this.readyMenu=menuMode+JSON.stringify(e.profile)+this.saving+!!this.pending;
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
    const {w,h,unit:u}=this,halfW=MAP.width/2,halfH=MAP.height/2;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,w,h);
    const backdrop=ctx.createRadialGradient(w*.53,h*.45,0,w*.5,h*.5,w*.7);backdrop.addColorStop(0,'#1b3549');backdrop.addColorStop(1,'#071323');ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);
    ctx.save();if(this.shake>0)ctx.translate(Math.sin(this.time*140)*3,Math.cos(this.time*120)*2);
    // Enlarged 24 × 18 arena; the camera follows the hero to retain readable character sizes.
    this.box(-halfW-.12,-halfH-.12,MAP.width+.24,MAP.height+.24,.15,'#243f50','#102431','#172b38');
    for(let x=-halfW;x<halfW;x++)for(let y=-halfH;y<halfH;y++)this.tile(x,y,(x+Math.floor(y))%2?'#3a5360':'#354d5c');
    // Warehouse grid lines and safety perimeter.
    for(const [a,b] of [[[-halfW+.1,-halfH+.1],[halfW-.1,-halfH+.1]],[[halfW-.1,-halfH+.1],[halfW-.1,halfH-.1]],[[halfW-.1,halfH-.1],[-halfW+.1,halfH-.1]],[[-halfW+.1,halfH-.1],[-halfW+.1,-halfH+.1]]])this.line(this.project(...a),this.project(...b),'#f5bd6d88',2);
    this.box(-halfW-.25,halfH+.1,MAP.width+.5,.2,1,'#527080','#213849','#354c5a');
    this.box(halfW+.05,-halfH,.2,MAP.height+.3,1,'#527080','#213849','#354c5a');
    for(let x=-halfW+1;x<halfW;x+=2)this.box(x,halfH+.25,.12,.12,1.65,'#718a97','#365161','#416375');
    for(let y=-halfH+.9;y<halfH;y+=2)this.box(halfW+.17,y,.12,.12,1.65,'#718a97','#365161','#416375');
    // A red service pipe and yellow hazard markings.
    this.line(this.project(-halfW,halfH+.15,1.1),this.project(halfW+.25,halfH+.15,1.1),'#8f3b42',u*.075);
    for(let x=-halfW+.2;x<halfW-.5;x+=.5)this.line(this.project(x,-halfH+.05),this.project(x+.2,-halfH+.35),'#e9b96e75',2);
    for(let i=0;i<4;i++){
      this.box(-halfW-.9,-halfH+1.7+i*1.6,.65,1,.2,'#675649','#3b3836','#4e433a');
      this.box(-halfW-.85,-halfH+1.75+i*1.6,.55,.82,.7,'#a07e57','#6f543c','#846643');
      this.line(this.project(-halfW-.8,-halfH+1.85+i*1.6,.72),this.project(-halfW-.35,-halfH+2.4+i*1.6,.72),'#d3ad7355',2);
    }
    // Loading bay painted on the floor.
    ctx.save();const sign=this.project(-1,-halfH+.9);ctx.translate(sign.x,sign.y);ctx.transform(.9,-.45,.9,.45,0,0);ctx.font=`800 ${u*.18}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#bfd0d13b';ctx.fillText('FDEC  /  RESPONSE ZONE',0,0);ctx.restore();
    const e=this.engine;
    let actors=e?[...e.enemies.map(a=>({kind:'enemy',...a})),{kind:'hero',...e.hero}]:[{kind:'hero',x:1,y:-1},{kind:'enemy',x:-2,y:2,charger:false,timer:1,flash:0,hp:3,maxHp:3},{kind:'enemy',x:3,y:2,charger:true,timer:2,flash:0,hp:5,maxHp:5},{kind:'enemy',x:-3,y:0,charger:false,timer:1,flash:0,hp:3,maxHp:3}];
    actors.sort((a,b)=>(b.x+b.y)-(a.x+a.y));
    for(const a of actors){if(a.kind==='hero')this.drawHero(a,e);else this.drawEnemy(a);}
    if(e){
      for(const s of e.shots){const p=this.project(s.x,s.y,.4),tail=this.project(s.x-s.vx*.024,s.y-s.vy*.024,.4);this.line(tail,p,'#a8f1ff',3+e.profile.nozzle*.3);this.ellipse(p.x,p.y,2.5,2.5,'#e8fcff');}
      for(const f of e.fx)this.drawEffect(f);
      if(e.grace>.85&&e.health<e.maxHealth){ctx.fillStyle='#f64c4c0b';ctx.fillRect(0,0,w,h);}
    }
    // Ambient embers remain decorative; combat is fully paused behind menus.
    for(let i=0;i<18;i++){const x=(Math.sin(i*32.4)*.5+.5)*w,y=(h-(this.time*(12+i%5)+i*43)%h);this.ellipse(x,y,1,1.7,'#fbbd6940');}
    ctx.restore();
    if(this.loaded&&e)this.drawMinimap(e);
  }
  drawMinimap(e){
    const mw=this.h<450?108:140,mh=this.h<450?80:103,x=this.w-mw-16,y=this.h<450?74:100;
    ctx.save();ctx.fillStyle='#081725cc';ctx.fillRect(x,y,mw,mh);ctx.strokeStyle='#839eb866';ctx.lineWidth=1;ctx.strokeRect(x,y,mw,mh);
    ctx.fillStyle='#a8c6d9';ctx.font='9px system-ui';ctx.fillText('MAP ×4',x+7,y+13);
    const plot=p=>({x:x+7+(p.x/MAP.width+.5)*(mw-14),y:y+22+(.5-p.y/MAP.height)*(mh-29)});
    for(const enemy of e.enemies){const p=plot(enemy);ctx.fillStyle=enemy.tier==='boss'?'#ff626c':enemy.tier==='mini'?'#c796ff':'#edac63';ctx.beginPath();ctx.arc(p.x,p.y,enemy.tier==='boss'?3:enemy.tier==='mini'?2:1.2,0,Math.PI*2);ctx.fill();}
    const p=plot(e.hero);ctx.fillStyle='#d6fbff';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  drawHero(a,e){
    const p=this.project(a.x,a.y),active=e?.mode==='active'&&!this.paused;
    const interval=.19/(1+(e?.profile.nozzle||0)*.08);
    const shooting=!!(active&&e.enemies.length);
    const recoil=shooting?Math.max(0,(e.cooldown-(interval-.10))/.10):0;
    if(!drawRookieWobble(ctx,{x:p.x,y:p.y,unit:this.unit,time:this.time,
      moving:!!(active&&e.moving),aim:e?iso(e.aim.x,e.aim.y):{x:1,y:0},
      celebrate:!!(e&&(e.mode==='clear'||e.mode==='victory')),shooting,recoil,
      upgrades:e?.profile||{},hurt:!!(active&&e.grace>0&&e.health<e.maxHealth)}))this.drawHeroFallback(a,e);
  }
  drawHeroFallback(a,e){
    const p=this.project(a.x,a.y),u=this.unit;ctx.save();ctx.translate(p.x,p.y);
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
    else if(f.type==='steam'){for(let i=0;i<4;i++)this.ellipse(p.x+(i-1.5)*u*.15,p.y-u*(.2+t*.8)-Math.sin(i)*u*.1,u*(.1+t*.15),u*(.14+t*.2),'#d2e6db');}
    else if(f.type==='splash'){for(let i=0;i<7;i++){const angle=i/7*Math.PI*2,r=t*u*.5;this.ellipse(p.x+Math.cos(angle)*r,p.y+Math.sin(angle)*r,2,2,'#aef0fc');}}
    else{ctx.strokeStyle='#ff7a73';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,u*(.25+t*.6),0,Math.PI*2);ctx.stroke();}
    ctx.restore();}
}
export const game=new FireDefense();

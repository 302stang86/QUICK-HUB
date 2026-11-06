// Original resolution-independent character art. Physics and progression stay in game-core.mjs.
// Reuse parsed silhouettes instead of rebuilding SVG paths on every frame.
const THEMES={ember:['#ffe39a','#ff9c42','#d84c35'],gold:['#fff8bd','#ffd455','#d38b28'],ash:['#f3d4dc','#ba8799','#795968'],coal:['#ffc573','#f07a3d','#733d37'],crimson:['#ffbd8b','#f45d53','#9b2e44'],toxic:['#eeffb6','#b0e64e','#5a9e45'],blue:['#c9f8ff','#6cceff','#3a68b8'],violet:['#f0d4ff','#b885f0','#7146ac'],smoke:['#e5dde6','#a39cb4','#5c586f']};
const HOT=new Set(['#ffe6a0','#ffecb2','#ffe3a0','#fff0b7','#ffe4a0','#fff4bf','#ffefb5','#ffd98b','#ffc674','#ffb76b','#ffdb80']);
const MID=new Set(['#fda24e','#ffbf5d','#ff9f45','#ffb050','#ff9e43','#ffb952','#ff8b44','#ffc26c','#ed6b3d','#ffb058','#ec6c41','#ed8a4a','#ffdf8b']);
const LOW=new Set(['#d34137','#ee5b37','#d34233','#d64238','#bd3332','#df4a33','#c54239','#f49a59']);
let activeTheme=null;
function tint(value){return activeTheme?(HOT.has(value)?activeTheme[0]:MID.has(value)?activeTheme[1]:LOW.has(value)?activeTheme[2]:value):value;}
const paths = new Map();
function path(d){let p=paths.get(d);if(!p){p=new Path2D(d);paths.set(d,p);}return p;}
function shape(c,d,fill,stroke='#18232b',width=1.5){c.fillStyle=tint(fill);c.fill(path(d));if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke(path(d));}}
function ellipse(c,x,y,rx,ry,fill,stroke=null,width=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=tint(fill);c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function line(c,points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=tint(color);c.lineWidth=width;c.stroke();}
function grad(c,x,y,x2,y2,stops){const g=c.createLinearGradient(x,y,x2,y2);for(const [at,color]of stops)g.addColorStop(at,tint(color));return g;}
function shadow(c,width,opacity=.4){ellipse(c,0,1,width,10,`rgba(3,12,18,${opacity})`);ellipse(c,-3,0,width*.6,5,'#06101840');}
function flame(c,x,y,w,h,phase,colors,lean=0){
  const sway=Math.sin(phase)*w*.14;
  c.beginPath();c.moveTo(x-w*.45,y);
  c.bezierCurveTo(x-w*.9,y-h*.25,x-w*.3+sway,y-h*.52,x-w*.32+lean,y-h*.86);
  c.bezierCurveTo(x-w*.05+sway,y-h*.69,x+w*.06+lean,y-h*.42,x+w*.04+lean,y-h);
  c.bezierCurveTo(x+w*.65+sway,y-h*.68,x+w*.31,y-h*.34,x+w*.55,y-h*.55);
  c.bezierCurveTo(x+w*.94,y-h*.19,x+w*.33,y+h*.13,x-w*.45,y);
  c.fillStyle=grad(c,x,y-h,x,y,[[0,colors[0]],[.45,colors[1]],[1,colors[2]]]);c.fill();
}
function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#ff743000');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
function emberParticles(c,time,seed,width,height){
  for(let i=0;i<4;i++){
    const rise=(time*(.7+i*.06)+seed*.17+i*.29)%1;
    c.globalAlpha=(1-rise)*.85;
    const x=Math.sin(seed+i*2+time*1.5)*(width*.5+rise*8),y=-height-rise*26;
    ellipse(c,x,y,1.0+(i%2)*.4,1.6,'#ffdb80');
  }
  c.globalAlpha=1;
}

export function drawFireEnemy(c,{x,y,unit,time,id=0,charger=false,hp=1,maxHp=1,flash=0,heading={x:0,y:1},charging=false,palette='ember',crest='flame',tier='base',name=''}){
  const previousTheme=activeTheme;activeTheme=THEMES[palette]||THEMES.ember;
  c.save();c.translate(x,y);c.scale(unit/90,unit/90);c.lineJoin='round';c.lineCap='round';
  const phase=time*7+id*1.73,step=Math.sin(phase),facing=heading.x>=0?1:-1;
  if(charger) drawBrute(c,{time,phase,step,facing,charging,flash});
  else drawEmber(c,{time,phase,step,facing,flash,id});
  drawCrest(c,crest,charger,activeTheme);
  if(hp<maxHp){
    const width=charger?62:43,y=charger?-142:-99;
    shape(c,`M${-width/2-2} ${y-2} H${width/2+2} V${y+5} H${-width/2-2} Z`,'#0b1725','#324457',1);
    c.fillStyle=charger?'#ffa65d':'#ffce7b';c.fillRect(-width/2,y,width*Math.max(0,hp/maxHp),3);
  }
  if(tier!=='base'&&name){c.fillStyle=tier==='boss'?'#ffe1af':'#dec7ff';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(name,0,charger?-153:-110);}
  c.restore();activeTheme=previousTheme;
}
function drawEmber(c,{time,phase,step,facing,flash,id}){
  shadow(c,27,.28);glow(c,0,-35,66,'#f974352b');
  c.translate(0,-Math.abs(step)*2);
  // Long dancing flame silhouette wraps a charred, faceted coal body.
  flame(c,-2,-19,62,83,phase,['#ffe6a0','#fda24e','#d34137'],facing*5);
  flame(c,-21,-29,19,40,phase+2,['#ffecb2','#ffbf5d','#ee5b37'],-3);
  flame(c,19,-27,22,45,phase+1,['#ffe3a0','#ff9f45','#d34233'],7);
  shape(c,'M-18 -62 L-26 -46 L-22 -21 L-10 -10 L12 -10 L25 -26 L22 -49 L10 -65 Z',grad(c,-20,-60,20,-12,[[0,'#4d3640'],[.5,'#332d38'],[1,'#1c2530']]),'#753a39',1.5);
  shape(c,'M-18 -60 L-8 -64 L-4 -49 L-20 -40 L-24 -47 Z','#62414a','#2f2832',1);
  shape(c,'M9 -63 L20 -52 L22 -37 L7 -42 L2 -53 Z','#48323b','#2d2630',1);
  shape(c,'M-20 -31 L-11 -27 L-7 -12 L-17 -17 Z','#45323b',null);
  // Molten fissures and hot core provide contrast against the stone shell.
  line(c,[[-10,-62],[-5,-52],[-10,-44],[-5,-35]],'#ec693e',2);
  line(c,[[14,-46],[8,-36],[14,-24],[8,-12]],'#f28d48',1.6);
  ellipse(c,0,-25,8,10,'#cf5c3b');ellipse(c,0,-25,4,6,'#ffd378');
  // Jagged glowing eyes instead of the previous friendly dot face.
  shape(c,'M-19 -46 L-5 -42 L-8 -34 L-17 -36 Z',flash?'#ffffff':'#ffc674','#8b403b',1);
  shape(c,'M6 -42 L20 -47 L17 -35 L8 -34 Z',flash?'#ffffff':'#ffc674','#8b403b',1);
  line(c,[[-16,-42],[-9,-40]],'#fff2b8',2);line(c,[[10,-40],[17,-42]],'#fff2b8',2);
  shape(c,'M-9 -25 L-4 -29 L0 -26 L5 -30 L9 -25 L6 -18 L-5 -18 Z','#191c25',null);
  // Charred limbs trail sparks as the ember scuttles.
  const stride=step*4;
  line(c,[[-20,-39],[-32,-25+stride],[-34,-15+stride]],'#a74637',8);
  line(c,[[20,-39],[30,-28-stride],[34,-19-stride]],'#74353a',8);
  for(const side of [-1,1]){
    const dy=side*stride;
    shape(c,`M${side*13} -18 L${side*21} -10 L${side*23} ${1+dy} L${side*9} ${2+dy} L${side*7} -10 Z`,'#302a34','#703a3b',1.3);
    line(c,[[side*14,-12],[side*17,-5+dy]],'#f9954a',1.2);
    for(let finger=0;finger<2;finger++)line(c,[[side*(31+finger*3),-20+dy],[side*(34+finger*3),-11+dy]],'#ffc26c',1.3);
  }
  if(flash){c.globalAlpha=.65;shape(c,'M-18 -62 L-26 -46 L-22 -21 L-10 -10 L12 -10 L25 -26 L22 -49 L10 -65 Z','#cdfaff',null);c.globalAlpha=1;}
  emberParticles(c,time,id,38,77);
}
function drawBrute(c,{time,phase,step,facing,charging,flash}){
  shadow(c,43,.48);glow(c,0,-58,97,charging?'#ff593d40':'#fb6e2829');
  c.translate(charging?Math.sin(phase*3)*1.4:0,-Math.abs(step)*2);
  // Fire vents burn between a heavy basalt silhouette, distinct from small embers.
  flame(c,-23,-66,37,61,phase,['#fff0b7','#ffb050','#d64238'],-12);
  flame(c,22,-63,39,65,phase+2,['#ffe4a0','#ff9e43','#bd3332'],12);
  flame(c,0,-96,50,55,phase+1,['#fff4bf','#ffb952','#df4a33'],facing*5);
  for(const side of [-1,1]){
    c.save();c.translate(side*20,side*step*4);
    shape(c,'M-15 -42 L14 -42 L12 -15 L20 -5 L18 3 L-16 3 L-19 -6 L-12 -20 Z',grad(c,-15,-38,14,-4,[[0,'#4b3941'],[1,'#202631']]),'#18212b',2);
    shape(c,'M-12 -28 L2 -33 L10 -25 L7 -14 L-6 -10 L-13 -17 Z','#5b4146','#302b35',1.2);
    line(c,[[-2,-33],[1,-22],[-4,-15],[0,-4]],'#ed6b3d',2.2);
    line(c,[[-12,0],[15,0]],'#785043',1.3);c.restore();
  }
  shape(c,'M-28 -99 L-41 -81 L-34 -49 L-20 -26 L23 -26 L36 -54 L40 -82 L25 -100 Z',grad(c,-32,-92,31,-35,[[0,'#65474a'],[.3,'#493b43'],[1,'#272c37']]),'#1d252e',2.3);
  // Faceted shoulder armor, raised forearms, and chunky claws.
  for(const side of [-1,1]){
    const fist=charging?-5:step*side*3;
    shape(c,`M${side*24} -97 L${side*44} -98 L${side*53} -78 L${side*40} -63 L${side*27} -70 Z`,'#51404a','#202733',2);
    line(c,[[side*35,-95],[side*40,-85],[side*36,-74]],'#ffb058',2.5);
    shape(c,`M${side*43} -74 L${side*54} -68 L${side*60} ${-45+fist} L${side*51} ${-26+fist} L${side*35} ${-31+fist} L${side*34} -50 Z`,'#39303c','#17222d',2);
    shape(c,`M${side*49} ${-51+fist} L${side*62} ${-43+fist} L${side*58} ${-24+fist} L${side*40} ${-20+fist} L${side*35} ${-31+fist} Z`,'#5c3a42','#202631',1.6);
    for(let claw=0;claw<3;claw++)line(c,[[side*(42+claw*6),-30+fist],[side*(41+claw*6),-19+fist]],'#e9a166',2.5);
    line(c,[[side*46,-66],[side*49,-52],[side*43,-44]],'#ec6c41',1.5);
  }
  // Chest plates split around a white-hot molten furnace.
  shape(c,'M-25 -85 L-7 -92 L-9 -72 L-3 -62 L-13 -47 L-30 -58 Z','#62464a','#282631',1.4);
  shape(c,'M8 -92 L29 -86 L30 -61 L15 -47 L6 -60 L12 -73 Z','#4b3842','#282631',1.4);
  shape(c,'M0 -83 L11 -69 L10 -53 L1 -40 L-10 -54 L-9 -68 Z',grad(c,0,-83,0,-40,[[0,'#ffdf8b'],[.5,'#ff8b44'],[1,'#c54239']]),'#7e3b3a',1.5);
  shape(c,'M1 -75 L5 -64 L0 -51 L-4 -62 Z','#ffefb5',null);
  line(c,[[-28,-79],[-17,-73],[-23,-62],[-13,-51]],'#ed8a4a',1.4);
  line(c,[[24,-57],[16,-42],[21,-31]],'#d76e46',1.6);
  // Craggy head, angry brow, ember eyes, and an angular glowing jaw.
  shape(c,'M-22 -118 L-11 -131 L12 -131 L25 -116 L20 -93 L10 -85 L-12 -87 L-23 -99 Z',grad(c,-20,-126,18,-91,[[0,'#65414a'],[.6,'#392f3b'],[1,'#252936']]),'#23242e',2);
  shape(c,'M-22 -112 L-3 -108 L-8 -99 L-21 -102 Z',charging?'#fff1b1':'#ffb76b','#b8543f',1.2);
  shape(c,'M4 -108 L23 -113 L21 -101 L9 -99 Z',charging?'#fff1b1':'#ffb76b','#b8543f',1.2);
  line(c,[[-22,-116],[-6,-111]],'#292534',4);line(c,[[7,-111],[23,-117]],'#292534',4);
  shape(c,'M-12 -97 L-5 -95 L0 -98 L5 -94 L12 -98 L8 -89 L0 -87 L-8 -90 Z','#f49a59','#8f483b',1);
  shape(c,'M-29 -124 L-22 -137 L-16 -127 L-10 -132 L-10 -119 Z','#58434a','#242630',1.4);
  shape(c,'M16 -126 L25 -139 L29 -124 L25 -118 L15 -119 Z','#4e3945','#242630',1.4);
  if(flash){c.globalAlpha=.55;ellipse(c,0,-76,39,52,'#d6faff');c.globalAlpha=1;}
  emberParticles(c,time,phase*.08,60,128);
}

function drawCrest(c,kind,large,colors){
  const y=large?-130:-78,w=large?26:17;
  c.save();
  if(kind==='crown')shape(c,`M${-w} ${y} L${-w-4} ${y-17} L${-w*.45} ${y-9} L0 ${y-24} L${w*.45} ${y-9} L${w+4} ${y-17} L${w} ${y+2} Z`,colors[1],'#362e3b',1.4);
  else if(kind==='antenna'){for(const side of [-1,1]){line(c,[[side*w*.55,y],[side*w,y-23]],colors[2],3);ellipse(c,side*w,y-24,4,5,colors[0]);}}
  else if(kind==='horns'){for(const side of [-1,1])shape(c,`M${side*w*.55} ${y+8} L${side*(w+6)} ${y-14} L${side*(w+2)} ${y+12} Z`,colors[0],'#48323e',1.2);}
  else if(kind==='spikes'){for(let i=-1;i<=1;i++)shape(c,`M${i*15-6} ${y+4} L${i*17} ${y-18-Math.abs(i)*5} L${i*15+6} ${y+6} Z`,colors[2],'#252a35',1);}
  else if(kind==='wings'){for(const side of [-1,1])shape(c,`M${side*w} ${y+35} L${side*(w+23)} ${y+4} L${side*(w+10)} ${y+43} L${side*(w+28)} ${y+25} L${side*(w+12)} ${y+58} Z`,colors[1],'#6d4b55',1);}
  else if(kind==='tail'){c.beginPath();c.moveTo(-w, -17);c.bezierCurveTo(-w-30,-10,-w-29,-40,-w-45,-22);c.strokeStyle=colors[2];c.lineWidth=7;c.stroke();ellipse(c,-w-45,-22,4,7,colors[0]);}
  else if(kind==='legs'){for(const side of [-1,1])for(let i=0;i<2;i++)line(c,[[side*w,-32+i*9],[side*(w+12),-26+i*8],[side*(w+20),-10+i*4]],colors[2],3);}
  else if(kind==='mask'){shape(c,`M${-w} ${y+24} L${w} ${y+24} L${w*.8} ${y+39} L${-w*.8} ${y+39} Z`,'#879396','#323845',1.2);line(c,[[-w*.5,y+31],[w*.5,y+31]],colors[1],2);}
  c.restore();
}

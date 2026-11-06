// The approved Rookie Wobble design, rendered from transparent illustrated sprites.
// Keep drawing independent of physics, authentication and saved progress.
const art={};
for(const pose of ['spray','run','victory']){
  const image=new Image();
  art[pose]={image,ready:false};
  image.onload=()=>{art[pose].ready=true;};
  image.src=new URL('./assets/rookie-'+pose+'.webp',import.meta.url).href;
}
export function drawRookieWobble(c,{x,y,unit,time,moving=false,aim={x:1,y:0},celebrate=false,shooting=false,recoil=0,upgrades={},hurt=false}){
  const stride=Math.sin(time*13),pose=celebrate?'victory':moving&&stride>-.15?'run':'spray';
  const sprite=art[pose].ready?art[pose]:art.spray;
  if(!sprite.ready)return false;
  const facing=aim.x>=0?1:-1;
  const width=unit*2.15,height=unit*2.15;
  c.save();c.translate(x,y);
  c.fillStyle='#04101c66';c.beginPath();c.ellipse(0,2,unit*.42,unit*.14,0,0,Math.PI*2);c.fill();
  const bounce=celebrate?Math.abs(Math.sin(time*7))*unit*.09:moving?Math.abs(stride)*unit*.045:Math.sin(time*2)*unit*.008;
  c.translate(-facing*unit*.065*recoil,-bounce);
  c.scale(facing,1);
  c.rotate(celebrate?Math.sin(time*6)*.055:moving?stride*.025:-recoil*.028);
  if(hurt&&Math.floor(time*14)%2===0)c.globalAlpha=.55;
  c.imageSmoothingEnabled=true;
  c.drawImage(sprite.image,-width*.49,-height*.93,width,height);
  c.globalAlpha=1;
  // Colored equipment accents retain a visible distinction for purchased upgrades.
  if(!celebrate&&(upgrades.foam||upgrades.cannon)){
    const nx=unit*.77,ny=-unit*1.30;
    c.save();c.translate(nx,ny);c.rotate(-.23);
    c.strokeStyle=upgrades.cannon?'#f4cf6d':'#a4f4cd';c.lineWidth=2.3;
    c.beginPath();c.ellipse(0,0,unit*.055,unit*.105,0,0,Math.PI*2);c.stroke();
    if(upgrades.cannon){c.strokeStyle='#d59a39';c.lineWidth=1.3;c.beginPath();c.ellipse(-unit*.035,0,unit*.05,unit*.105,0,0,Math.PI*2);c.stroke();}
    c.restore();
  }
  // Tiny live droplets at the nozzle support the recoil animation; actual damage stays in the engine.
  if(shooting&&!celebrate){
    for(let i=0;i<3;i++){
      const t=(time*8+i*.31)%1;
      c.globalAlpha=(1-t)*.8;c.fillStyle=i===0?'#e6fbff':'#80dff7';
      c.beginPath();c.ellipse(unit*(.80+t*.27),unit*(-1.31-t*.05),1.2,1.7,0,0,Math.PI*2);c.fill();
    }
  }
  c.restore();return true;
}

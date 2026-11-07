// HP, attack damage per contact, speed in world units/second. Values are intentionally explicit.
// Introductions are room numbers, not an automatic promise that every later wave contains the type.
const base=[
 ['ember','Ember Creature',3,.50,.62,1,'chase','ember','flame','A small, steady pursuer.'],
 ['soot-scamp','Soot Scamp',4,.55,.82,2,'zigzag','ash','tail','A slippery soot imp with a weaving approach.'],
 ['flame-charger','Flame Charger',5,.60,1.05,3,'charge','crimson','horns','Telegraphs a short burst of speed.'],
 ['matchstick','Matchstick Menace',6,.65,1.40,4,'chase','gold','antenna','A skinny, quick-burning chaser.'],
 ['coal-crawler','Coal Crawler',7,.70,.70,5,'zigzag','coal','legs','A low crawler that closes in slowly.'],
 ['spark-skitter','Spark Skitter',8,.75,1.18,6,'zigzag','gold','spikes','A sharp little spark with an erratic path.'],
 ['cinder-mite','Cinder Mite',9,.80,.92,7,'chase','ember','legs','A tougher crawling cinder.'],
 ['fuse-runner','Fuse Runner',10,.85,1.55,8,'charge','crimson','antenna','A fast runner that briefly surges forward.'],
 ['ash-hopper','Ash Hopper',11,.90,.78,9,'pulse','ash','wings','Advances in short, hopping bursts.'],
 ['blister-bug','Blister Bug',12,.95,1.28,10,'zigzag','toxic','legs','A green-flame bug that weaves toward you.'],
 ['charcoal-chunk','Charcoal Chunk',13,1.00,.66,12,'chase','coal','mask','Slow, sturdy and hard to extinguish.'],
 ['flare-fox','Flare Fox',14,1.05,1.68,14,'charge','ember','tail','A long-tailed hunter with a quick lunge.'],
 ['smoke-sneak','Smoke Sneak',15,1.10,.98,16,'zigzag','smoke','mask','A smoky figure with a winding approach.'],
 ['blue-blaze','Blue Blaze',16,1.15,1.35,18,'chase','blue','flame','A hot blue flame with steady pressure.'],
 ['molten-mutt','Molten Mutt',17,1.20,.74,20,'pulse','crimson','tail','A heavy ember beast with bounding steps.'],
 ['wildfire-wisp','Wildfire Wisp',18,1.25,1.82,22,'zigzag','violet','wings','A fast, dancing violet flame.'],
 ['slag-soldier','Slag Soldier',19,1.30,1.12,24,'chase','coal','spikes','An armored lump of glowing slag.'],
 ['flash-fire','Flash Fire',20,1.35,1.48,26,'charge','gold','flame','A bright flame that telegraphs a rush.'],
 ['boiler-beetle','Boiler Beetle',21,1.40,.88,28,'pulse','blue','legs','A pressurized crawler that bounds forward.'],
 ['inferno-imp','Inferno Imp',22,1.45,1.95,30,'zigzag','violet','horns','The fastest base enemy, saved for the finale.']
];
// Twenty more regular enemies: fire critters, living electricity, and evil inspectors (fire marshals and safety auditors).
// Same row layout as above plus a trailing art kind: 'fire' (tinted ember art), 'electric', 'marshal' or 'osha'.
// HP, damage and speed values sit between the originals so every enemy keeps a unique stat line.
const extra=[
 ['pilot-light','Pilot Light',3.5,.52,.59,1,'chase','gold','flame','A tiny blue-gold flame that never goes out.','fire'],
 ['short-circuit','Short Circuit',4.5,.57,.91,2,'zigzag','volt','',"Crackling with loose current; it can't walk straight.",'electric'],
 ['rookie-marshal','Rookie Marshal',5.5,.62,.75,3,'chase','marshal','',"An evil fire marshal on his first inspection: 'You're all out of code!'",'marshal'],
 ['hard-hat-hazard','Hard-Hat Hazard',6.5,.67,.67,4,'chase','osha','','An evil safety auditor who marches in to shut you down.','osha'],
 ['kindling-imp','Kindling Imp',7.5,.72,.96,5,'zigzag','toxic','spikes','A twiggy imp that sparks wherever it steps.','fire'],
 ['surge-sprite','Surge Sprite',8.5,.77,1.22,6,'charge','arc','','A sprite of stored charge that lunges in a flash.','electric'],
 ['red-tag-rascal','Red Tag Rascal',9.5,.82,1.00,7,'zigzag','marshal','','Slaps a red tag on anything that stands still.','marshal'],
 ['cinder-slug','Cinder Slug',10.5,.87,.60,8,'pulse','coal','legs','A glowing slug that oozes forward in slow pulses.','fire'],
 ['clipboard-crusader','Clipboard Crusader',11.5,.92,1.34,9,'charge','osha','','An auditor with a clipboard and a sudden citation rush.','osha'],
 ['arc-flash','Arc Flash',12.5,.97,1.46,10,'chase','arc','','A blinding arc of current racing straight at you.','electric'],
 ['code-enforcer','Code Enforcer',13.5,1.02,.84,11,'chase','marshal','','A stern marshal who enforces the code with a stomp.','marshal'],
 ['torch-tick','Torch Tick',14.5,1.07,1.14,13,'zigzag','blue','legs','A burning tick that scuttles in from the side.','fire'],
 ['citation-cop','O.S.H.A. Auditor',15.5,1.12,.80,15,'pulse','osha','','Writes up violations between short, heavy steps.','osha'],
 ['tesla-tick','Tesla Tick',16.5,1.17,1.26,17,'zigzag','volt','','A coil-backed crawler that zaps the air around it.','electric'],
 ['citation-captain','Citation Captain',17.5,1.22,1.58,19,'charge','marshal','','A senior marshal who charges when he spots a violation.','marshal'],
 ['phoenix-fledgling','Phoenix Fledgling',18.5,1.27,.90,21,'pulse','crimson','wings','A fiery chick that hops forward in bursts.','fire'],
 ['lockout-lurker','Lockout Lurker',19.5,1.32,1.06,23,'zigzag','osha','','Locks out your equipment and tags it out of service.','osha'],
 ['live-wire','Live Wire',20.5,1.37,1.72,25,'charge','plasma','','A loose cable whip that snaps toward you.','electric'],
 ['deputy-inferno','Deputy Inferno',21.5,1.42,1.20,27,'chase','marshal','','The marshal’s right hand: relentless and armed with a citation book.','marshal'],
 ['blackout-bolt','Blackout Bolt',22.5,1.47,1.86,29,'pulse','plasma','','A fast bolt that surges in and goes dark again.','electric']
];
const mini=[
 ['spark-captain','Spark Captain',26,1.50,.72,2,'chase','gold','crown','Your first larger enemy: slow and readable.'],
 ['cinder-guard','Cinder Guard',32,1.60,.86,4,'chase','coal','mask','A heavily plated guard with a hot core.'],
 ['furnace-fang','Furnace Fang',38,1.70,.94,7,'charge','crimson','horns','A horned hunter with a warning before each rush.'],
 ['smokestack','Smokestack',44,1.80,1.02,9,'zigzag','smoke','antenna','A tall smoky brute that weaves in.'],
 ['ember-knight','Ember Knight',50,1.90,1.10,13,'chase','ember','mask','An armored commander with steady pressure.'],
 ['flare-marshal','Flare Marshal',56,2.00,1.16,15,'charge','gold','crown','A bright marshal with a hard charge.'],
 ['slag-stomper','Slag Stomper',62,2.10,1.24,19,'pulse','coal','spikes','A heavy stomper that advances in bursts.'],
 ['bluefire-baron','Bluefire Baron',68,2.20,1.32,21,'zigzag','blue','crown','A blue-flame noble with a deceptive approach.'],
 ['wildfire-wrangler','Wildfire Wrangler',74,2.30,1.38,25,'charge','toxic','tail','A mobile green-flame pursuer.'],
 ['flashover-captain','Flashover Captain',80,2.40,1.44,27,'pulse','violet','horns','A late-run captain with punishing contact damage.']
];
const bosses=[
 ['boiler-belly','Boiler Belly',95,2.50,.54,6,'pulse','ember','mask','A massive walking boiler; learn its slow rhythm.'],
 ['ash-king','The Ash King',120,2.70,.58,12,'chase','ash','crown','A crowned ash giant with endurance.'],
 ['inferno-foreman','Inferno Foreman',150,2.90,.64,18,'charge','crimson','horns','A furnace commander that warns before charging.'],
 ['flashover-titan','Flashover Titan',185,3.10,.68,24,'pulse','blue','spikes','A blue-hot titan with heavy advancing bursts.'],
 ['pyroclast','Pyroclast',225,3.30,.76,30,'charge','violet','crown','The final volcanic boss: tough, deliberate and dangerous.']
];
function build(rows,tier,offset=0){return rows.map(([key,name,hp,attack,speed,unlock,behavior,palette,crest,description,kind='fire'],i)=>{const index=i+offset;return {key,name,hp,attack,speed,unlock,behavior,palette,crest,description,kind,tier,variant:index,
  // Half of the previous body and art size (radius was 1.0 / .70 / .36 / .42; art scale 1.8 / 1.3 / .85 / 1).
  radius:tier==='boss'?.50:tier==='mini'?.35:crest==='legs'?.18:.21,
  visualScale:tier==='boss'?.90:tier==='mini'?.65:crest==='legs'?.425:.50,
  score:tier==='boss'?2500:tier==='mini'?600:100+index*10,
  reward:tier==='boss'?150:tier==='mini'?35:5+Math.floor(index/4)};});}
export const BASE_ENEMIES=[...build(base,'base'),...build(extra,'base',20)];
export const MINI_BOSSES=build(mini,'mini');
export const BOSSES=build(bosses,'boss');
export const ENEMY_ROSTER=[...BASE_ENEMIES,...MINI_BOSSES,...BOSSES];
export const ENEMY_COUNT_MULTIPLIER=2.5,MAX_WAVE_ENEMIES=55;
export function roomLineup(room,random=Math.random){
  const pool=BASE_ENEMIES.filter(e=>e.unlock<=room),boss=BOSSES.find(e=>e.unlock===room);
  // Each wave has 2.5× the earlier enemy count (a 150% increase); the old 22 cap becomes 55.
  const count=Math.min(MAX_WAVE_ENEMIES,Math.round((4+Math.ceil(room*.7))*ENEMY_COUNT_MULTIPLIER));
  const lineup=Array.from({length:boss?Math.ceil(count*.45):count},()=>pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]);
  // Guarantee the newly introduced base type is actually encountered that room.
  // Several types can debut in the same room; every newly introduced type is guaranteed to appear.
  pool.filter(e=>e.unlock===room).forEach((e,i)=>{if(i<lineup.length)lineup[i]=e;});
  if(boss)lineup.push(boss);
  else{
    const debut=MINI_BOSSES.find(e=>e.unlock===room);
    const unlocked=MINI_BOSSES.filter(e=>e.unlock<=room);
    if(debut)lineup.push(debut);
    else if(room%3===0&&unlocked.length)lineup.push(unlocked[Math.min(unlocked.length-1,Math.floor(random()*unlocked.length))]);
  }
  return lineup;
}

// Swarm raiders: 20 dedicated attack-wave enemies. They are released in groups by timed triggers (see WAVE in
// game-core.mjs), never from the regular queue: low HP, medium contact damage, fast, and they drop no coins.
// Five neon palettes x four body shapes give each one its own silhouette, unlike any fire creature.
const SWARM_PALETTES=['cyan','magenta','lime','white','violet'];
const SWARM_SHAPES=['dart','orb','bat','comet'];
const SWARM_NAMES=[
 ['Zap Dart','Static Orb','Arc Bat','Ion Comet'],
 ['Plasma Dart','Neon Orb','Flux Bat','Nova Comet'],
 ['Toxic Dart','Slime Orb','Fume Bat','Gas Comet'],
 ['Flashpoint Dart','Glare Orb','Strobe Bat','Blaze Comet'],
 ['Void Dart','Dusk Orb','Gloom Bat','Eclipse Comet']];
const SWARM_UNLOCK=[1,1,2,3,4,5,6,8,9,10,12,13,15,16,18,19,21,22,24,26];
export const SWARM_ENEMIES=Array.from({length:20},(_,i)=>{
  const pal=SWARM_PALETTES[Math.floor(i/4)],shape=SWARM_SHAPES[i%4];
  return {key:'swarm-'+pal+'-'+shape,name:SWARM_NAMES[Math.floor(i/4)][i%4],tier:'swarm',variant:i,palette:pal,shape,
    hp:2+Math.floor(i/4)+(i%4===1?1:0),                       // 2-7: dies to a couple of hits
    attack:Math.round((.8+i*.025)*100)/100,                   // .8-1.28: medium contact damage
    speed:Math.round((1.9+(i%4)*.25+Math.floor(i/4)*.1)*100)/100,   // fast; the global enemy multiplier applies on top
    unlock:SWARM_UNLOCK[i],behavior:'chase',radius:.15,visualScale:.42,score:15,reward:0,
    description:'Arrives in a pack during a swarm trigger. Fragile, fast, drops no coins.'};
});
export function swarmPool(room){return SWARM_ENEMIES.filter(e=>e.unlock<=room);}

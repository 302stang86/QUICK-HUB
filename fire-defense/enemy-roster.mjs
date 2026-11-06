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
function build(rows,tier){return rows.map(([key,name,hp,attack,speed,unlock,behavior,palette,crest,description],index)=>({key,name,hp,attack,speed,unlock,behavior,palette,crest,description,tier,variant:index,
  // Half of the previous body and art size (radius was 1.0 / .70 / .36 / .42; art scale 1.8 / 1.3 / .85 / 1).
  radius:tier==='boss'?.50:tier==='mini'?.35:crest==='legs'?.18:.21,
  visualScale:tier==='boss'?.90:tier==='mini'?.65:crest==='legs'?.425:.50,
  score:tier==='boss'?2500:tier==='mini'?600:100+index*10,
  reward:tier==='boss'?150:tier==='mini'?35:5+Math.floor(index/4)}));}
export const BASE_ENEMIES=build(base,'base');
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
  const newest=pool.find(e=>e.unlock===room);if(newest)lineup[0]=newest;
  if(boss)lineup.push(boss);
  else{
    const debut=MINI_BOSSES.find(e=>e.unlock===room);
    const unlocked=MINI_BOSSES.filter(e=>e.unlock<=room);
    if(debut)lineup.push(debut);
    else if(room%3===0&&unlocked.length)lineup.push(unlocked[Math.min(unlocked.length-1,Math.floor(random()*unlocked.length))]);
  }
  return lineup;
}

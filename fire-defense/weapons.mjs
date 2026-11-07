// Weapons and in-run upgrades. Source numbers come from the Archero-style reference table
// (Brave Bow / Death Scythe / Stalker Staff) and are converted so the Rapid Hose, the first
// weapon, matches the game's existing hose: 1 damage per hit at 0.19 s between shots.
// Only ratios are kept: damage ÷ 12, attack speed ÷ 1.2, range × 3 (the map is ~3× roomier than an Archero room).
// Free upgrades last for one wave. Free upgrades reset each wave. Nothing in this file is saved to the employee profile.
// Tuning constants for the weapon effects.
export const SPLASH_RADIUS=2.2,SPLASH_DAMAGE=.6;            // water balloon burst
export const PUDDLE={radius:1.7,life:3.5,slow:.5,bossSlow:.7}; // foam puddle (speed multiplier while inside)
export const CHAIN={range:9,keep:.8};                         // hop distance and damage kept per hop
export const SPREAD_DEG=9;                                    // angle between neighbouring streams
export const ORBIT={radius:2.3,speed:2.4,hitRadius:.3,cooldown:.6,slowTime:2,slow:.5,bossSlow:.7,damage:.7};

const REF={damage:12,attackSpeed:1.2,rangeScale:3};
const SOURCE=[
  {key:'hose',sourceId:'weapon_bow',name:'Rapid Hose',icon:'≋',base_damage:12,attack_speed:1.2,attack_range:8,crit_chance:.05,crit_multiplier:2,speed:14,
    trait:'Fast stream, balanced damage.',kind:'stream'},
  {key:'balloon',sourceId:'weapon_scythe',name:'Water Balloon',icon:'◒',base_damage:22,attack_speed:.7,attack_range:6.5,crit_chance:.1,crit_multiplier:2.2,speed:9,
    trait:'Heavy lob that bursts in a splash and knocks enemies back.',kind:'balloon',knockback:true,splash:true},
  {key:'foam',sourceId:'weapon_staff',name:'Foam Launcher',icon:'◍',base_damage:10,attack_speed:1,attack_range:9,crit_chance:.05,crit_multiplier:2,speed:10,
    trait:'Homing foam leaves a puddle that slows enemies.',kind:'foam',homing:true,puddle:true}
];
export const WEAPONS=Object.fromEntries(SOURCE.map(w=>[w.key,{
  key:w.key,sourceId:w.sourceId,name:w.name,icon:w.icon,trait:w.trait,kind:w.kind,
  damage:w.base_damage/REF.damage,rate:w.attack_speed/REF.attackSpeed,range:w.attack_range*REF.rangeScale,speed:w.speed,
  critChance:w.crit_chance,critMult:w.crit_multiplier,homing:!!w.homing,knockback:w.knockback?5:0,
  splash:w.splash?SPLASH_RADIUS:0,puddle:!!w.puddle
}]));
export const WEAPON_KEYS=SOURCE.map(w=>w.key);
// Modifier names follow the reference table. `max` caps how many times one upgrade can be taken.
export const ORB_STYLES={
  frost_orbs:{name:'Frost',color:'#a6e6ff',role:'attack',damage:.7,cooldown:.6},
  flame_orbs:{name:'Flame',color:'#ff995c',role:'attack',damage:1.5,cooldown:.8},
  storm_orbs:{name:'Storm',color:'#d3adff',role:'attack',damage:.8,cooldown:.9},
  shield_orbs:{name:'Shield',color:'#70afff',role:'defense'},
  healing_orbs:{name:'Healing',color:'#75efab',role:'support'},
  haste_orbs:{name:'Haste',color:'#ffe278',role:'support'}
};
export const UPGRADES=[
  {id:'flame_orbs',name:'Flame Orbs',icon:'🔥',max:3,description:'High contact damage: 1.5 damage per orb hit, every 0.8s. No slowing.',modifiers:{}},
  {id:'storm_orbs',name:'Storm Orbs',icon:'⚡',max:3,description:'0.8 contact damage; arcs to one nearby enemy for half damage. 0.9s cooldown.',modifiers:{}},
  {id:'shield_orbs',name:'Shield Orbs',icon:'◈',max:2,description:'Reduce contact damage by 15% per orb, up to 30%.',modifiers:{}},
  {id:'healing_orbs',name:'Healing Orbs',icon:'✚',max:2,description:'Each orb restores 0.5 health every 20 seconds of active play.',modifiers:{}},
  {id:'haste_orbs',name:'Haste Orbs',icon:'»',max:2,description:'+8% movement and firing speed per orb, up to 16%.',modifiers:{}},
  {id:'pressure_boost',name:'Pressure Boost',icon:'↑',max:12,description:'+25% weapon damage.',modifiers:{damage_multiplier:1.25}},
  {id:'long_reach',name:'Long Reach',icon:'↗',max:4,description:'+15% weapon range.',modifiers:{range_multiplier:1.15}},
  {id:'knockback',name:'Knockback',icon:'➜',max:3,description:'Push enemies farther away with each hit.',modifiers:{}},
  {id:'coin_magnet',name:'Coin Magnet',icon:'🧲',max:4,description:'+1.5 coin pickup range for blue and gold coins this wave.',modifiers:{}},
  {id:'emergency_recovery',name:'Emergency Recovery',icon:'✚',max:1,description:'Restore 2 health immediately. Can be chosen again later.',modifiers:{}},
  {id:'front_stream',name:'Extra Stream +1',icon:'⫴',max:3,description:'Fire an additional stream. Streams fan out in a spread.',modifiers:{projectile_count_add:1,damage_multiplier:.85}},
  {id:'multi_burst',name:'Multi-Burst',icon:'⁝',max:2,description:'Each trigger pull fires an extra stream right behind the first.',modifiers:{burst_count_add:1,attack_speed_multiplier:.85,damage_multiplier:.9}},
  {id:'ricochet',name:'Ricochet Spray',icon:'⤢',max:1,description:'Streams bounce off the arena wall.',modifiers:{has_bounce:true,damage_multiplier:.9}},
  {id:'chain_bounce',name:'Chain Splash',icon:'⛓',max:4,description:'After a hit, the stream hops to another nearby enemy. Each pick adds one more hop. Each hop loses 20% damage.',modifiers:{chain_bounces_add:1,chain_damage_keep:CHAIN.keep}},
  {id:'frost_orbs',name:'Frost Orbs',icon:'❄',max:4,description:'An ice orb circles you, damaging and slowing enemies it strikes. Each pick adds an orb.',modifiers:{orbital_count_add:1,orbital_damage_multiplier:ORBIT.damage,orbital_slow:ORBIT.slow}},
  {id:'pressure_point',name:'Pressure Point',icon:'✸',max:4,description:'+12% critical chance and +0.2 critical damage.',modifiers:{crit_chance_add:.12,crit_multiplier_add:.2}},
  {id:'quick_pump',name:'Quick Pump',icon:'⟳',max:4,description:'+25% attack speed.',modifiers:{attack_speed_multiplier:1.25}}
];
export const UPGRADE_BY_ID=Object.fromEntries(UPGRADES.map(u=>[u.id,u]));
export const MAX_CRIT_CHANCE=.8;
const BASE_INTERVAL=.19;

/** Everything the engine needs to fire: weapon + permanent nozzle level + this run's upgrades. */
export function computeStats(weaponKey,profile={},upgrades={}){
  const w=WEAPONS[weaponKey]||WEAPONS.hose;
  let damage=1,rate=1,projectiles=1,bursts=1,crit=w.critChance,critMult=w.critMult,bounce=false,chain=0,chainKeep=1,orbs=0,orbMult=1;
  for(const [id,stacks] of Object.entries(upgrades)){
    const u=UPGRADE_BY_ID[id];if(!u||!(stacks>0))continue;
    const m=u.modifiers,n=Math.min(stacks,u.max);
    if(m.projectile_count_add)projectiles+=m.projectile_count_add*n;
    if(m.burst_count_add)bursts+=m.burst_count_add*n;
    if(m.damage_multiplier)damage*=m.damage_multiplier**n;
    if(m.attack_speed_multiplier)rate*=m.attack_speed_multiplier**n;
    if(m.crit_chance_add)crit+=m.crit_chance_add*n;
    if(m.crit_multiplier_add)critMult+=m.crit_multiplier_add*n;
    if(m.has_bounce)bounce=true;
    if(m.chain_bounces_add){chain+=m.chain_bounces_add*n;chainKeep=m.chain_damage_keep;}
    if(m.orbital_count_add){orbs+=m.orbital_count_add*n;orbMult=m.orbital_damage_multiplier;}
  }
  const nozzle=profile.nozzle||0;
  return{
    key:w.key,kind:w.kind,speed:w.speed,range:w.range*1.15**Math.min(4,upgrades.long_reach||0),homing:w.homing,knockback:w.knockback+2*Math.min(3,upgrades.knockback||0),splash:w.splash,puddle:w.puddle,
    damage:w.damage*(1+nozzle*.35)*damage,
    interval:BASE_INTERVAL/(w.rate*(1+nozzle*.08)*rate),
    projectiles,bursts,bounce,chain,chainKeep,
    orbs,orbDamage:(1+nozzle*.35)*orbMult,
    critChance:Math.min(MAX_CRIT_CHANCE,crit),critMult
  };
}

/** Up to `count` distinct upgrades that are not yet maxed. */
export function rollUpgradeOffer(upgrades,random=Math.random,count=3){
  const pool=UPGRADES.filter(u=>(upgrades[u.id]||0)<u.max);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,count).map(u=>u.id);
}

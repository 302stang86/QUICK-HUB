/* FDEC Quick Hub — shared card data and renderer.
   Used by index.html (home) and the Field Tools / Tech Cards group pages so each
   card is defined once. A card with `anyOf` is a group card: it shows when the
   signed-in role may open at least one of the listed page keys. */
(function(){
  "use strict";
  var ICONS = {
    book:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    gearwrench:'<g transform="translate(11.2 -1.2) scale(0.5)"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g><g transform="translate(-1.5 4) scale(0.72)"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/></g>',
    megaphone:'<path d="m3 11 15-5v12L3 15v-4z"/><path d="M18 8a3 3 0 0 1 0 6"/><path d="M7 15.5V19a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2.5"/>',
    doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    truck:'<path d="M3 7h11v11H3z"/><path d="M14 11h4l3 3v4h-7z"/><circle cx="7.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/><path d="M3 18h2.5M9.5 18H15.5M19.5 18H21"/>',
    pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    wrench:'<path d="M14.7 6.3a4 4 0 0 1 5.2 5.2l-7.6 7.6a2.1 2.1 0 0 1-3-3l7.6-7.6a4 4 0 0 1 .8-.8z"/><path d="M14.7 6.3 18 3"/>',
    droplet:'<path d="M12 2.7s7 7.3 7 12a7 7 0 0 1-14 0c0-4.7 7-12 7-12z"/>',
    'clipboard-check':'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5h6M9 12l2 2 4-4M9 18h6"/>',
    search:'<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>',
    hourglass:'<path d="M6 3h12M6 21h12"/><path d="M8 3v3.5L12 11l4-4.5V3M8 21v-3.5L12 13l4 4.5V21"/>',
    hammer:'<path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>',
    bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    quote:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M13.6 13.2c0-.7-.8-1.2-1.6-1.2s-1.6.5-1.6 1.2.8 1.2 1.6 1.2 1.6.5 1.6 1.2-.8 1.2-1.6 1.2-1.6-.5-1.6-1.2"/>',
    calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
    phone:'<path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.1.4 2.4.6 3.6.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.5.6 3.6a1 1 0 0 1-.2 1l-2.3 2.2z"/>',
    tower:'<path d="M5 21V9h14v12"/><path d="M4 9V5h2.5v2h3V5h5v2h3V5H20v4"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>',
    firefighter:'<path d="M4 12h16M6 11a6 6 0 0 1 12 0M10 5V3h4v2"/><path d="M7 12v3a5 5 0 0 0 10 0v-3M5 21v-1a5 5 0 0 1 5-5M19 21v-1a5 5 0 0 0-2-4"/><path d="M10 20h4M12 18v4"/>',
    clock:'<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    admin:'<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 10-.3"/><circle cx="18" cy="17" r="2.3"/><path d="M18 14.3v-1.1M18 20.8v-1.1M20.3 15.7l-.9.5M16.6 17.8l-.9.5M20.3 18.3l-.9-.5M16.6 16.2l-.9-.5"/>',
    nicet:'<circle cx="12" cy="4.3" r="1.6"/><path d="M12 1.2v1.1M12 6.2v1.1M9 4.3h1.1M13.9 4.3h1.1M9.9 2.2l.8.8M13.3 5.6l.8.8M14.1 2.2l-.8.8M10.7 5.6l-.8.8"/><rect x="3.5" y="8.6" width="17" height="9.4" rx="1.6"/><path d="M2 21h20"/><path d="M6.3 13.4l1.5 1.5 2.6-3"/><path d="M14 12.3l3.2 3.2M17.2 12.3l-3.2 3.2"/>',
    fieldtools:'<g transform="rotate(45 12 12) scale(1.04) translate(-.46 .2)"><path d="M8.7 9.6V4.7A1.7 1.7 0 0 1 10.4 3h3.2a1.7 1.7 0 0 1 1.7 1.7V6h-3.1v2.4h3.1v1.2h-1.7v11.2a1.6 1.6 0 0 1-3.2 0V9.6z"/></g><g transform="rotate(-45 12 12) scale(1.04) translate(-.46 .2)"><g transform="translate(24 0) scale(-1 1)"><path d="M8.7 9.6V4.7A1.7 1.7 0 0 1 10.4 3h3.2a1.7 1.7 0 0 1 1.7 1.7V6h-3.1v2.4h3.1v1.2h-1.7v11.2a1.6 1.6 0 0 1-3.2 0V9.6z"/></g></g>',
    techcards:'<circle cx="8.3" cy="8.6" r="2.7"/><path d="M4.9 7.4a3.4 3.4 0 0 1 6.8 0"/><path d="M3.9 7.4h8.8"/><path d="M2.5 20.5v-1.2a5.6 5.6 0 0 1 5.6-5.6h.4"/><circle cx="16.9" cy="16.4" r="5.2"/><path d="M16.9 16.4l2.3-3"/>',
    pipecalc:'<rect x="2.4" y="2.6" width="10.8" height="18.8" rx="2"/><path d="M5.2 6.6h5.2"/><path d="M5.6 11h.01M8 11h.01M10.4 11h.01M5.6 14.2h.01M8 14.2h.01M10.4 14.2h.01M5.6 17.4h.01M8 17.4h.01M10.4 17.4h.01" stroke-width="2.3"/><path d="M18.1 9.6s3.6 3.7 3.6 6.2a3.6 3.6 0 0 1-7.2 0c0-2.5 3.6-6.2 3.6-6.2z"/>',
  };

  /* Cards that live on the home page. */
  var LINKS = [
    {name:'Announcements',           cat:'News',    access:'Everyone',     page:'announcements',  url:'announcements.html', color:'#1f7a3d', icon:'megaphone', desc:'Department news — new hires, projects, updates, and events.'},
    {name:'ITM Inspection Reports',  cat:'Field',   access:'',             page:'itm',            url:'itm-reports.html', color:'#1565c0', icon:'doc', desc:'NFPA 25 inspection report forms with PDF output.'},
    {name:'Field Tools', cat:'Field', access:'', page:'home', anyOf:['servicetrade','troubleshooting','frequencies','library','nicet','pipevolume'], url:'field-tools.html', color:'#c2570c', icon:'fieldtools', desc:'ServiceTrade, troubleshooting guide, NFPA 25 frequencies, library, NICET, and the pipe volume calculator.'},
    {name:'Tech Cards', cat:'Tech', access:'', page:'home', anyOf:['inventory','fleet','timeoff','oncall'], url:'tech-cards.html', color:'#2b4a80', icon:'techcards', desc:'Personal inventory, fleet service, time-off requests, and the on-call rotation.'},
    {name:'Local Dispatch Numbers',  cat:'Field',   access:'',             page:'dispatch',       url:'fire-dispatch-directory.html', color:'#6d3bb5', icon:'pin', desc:'Fire department dispatch numbers by city — searchable, tap to call.'},
    {name:'Fleet Service Records',   cat:'Management', access:'', page:'fleet', url:'fleet-requests.html', color:'#2c6950', icon:'clipboard-check', desc:'Review assigned fleet requests, update status, and print service reports.', roles:['manager','admin']},
    {name:'Quoting & Proposal Suite',cat:'Quoting', access:'Manager only', page:'quoting',        url:'quoting.html', color:'#1565c0', icon:'quote', desc:'Sprinkler ITM quoting and proposal verbiage.'},
    {name:'Fire Alarm Proposals',cat:'Quoting', access:'Manager only', page:'faquoting',      url:'fire-alarm-quoting.html', color:'#d12f2f', icon:'bell', desc:'Fire alarm ITM quoting, inspection scope, proposals, and deficiency repair quotes.'},
    {name:'Weekly Time Sheet',       cat:'Team',    access:'Admin only · pending release', page:'timesheet', url:'timesheet.html', color:'#6d3bb5', icon:'clock', desc:'Interactive weekly time sheet for technicians. Locked until released by an administrator.'},
    {name:'SwitchBack TD',          cat:'Break',   access:'Everyone',     page:'bathroom',       url:'switchback/index.html', color:'#b0306a', icon:'tower', desc:'SwitchBack Defense — a quick tower defense game. Beat the waves and climb the leaderboard.'},
    {name:'Wet Pipe Dreams', cat:'Break', access:'Approved employees', page:'bathroom', url:'fire-defense/index.html', color:'#C1121C', icon:'firefighter', desc:'Red Tag Rampage — battle fire creatures, upgrade your firefighting gear, and climb the employee leaderboard.'},
    {name:'Administration',          cat:'Admin',   access:'Admin & managers', page:'administration', url:'administration.html', color:'#c08a1e', icon:'admin', desc:'Quote files for managers; full management tools for admins.'},
    {name:'Help',                    cat:'Help',    access:'Everyone',     page:'help',           url:'help.html', color:'#5b6570', icon:'hammer', desc:'Report a bug with a photo, and find quick help on using Quick Hub.'}
  ];

  /* Cards inside the Field Tools page (field-tools.html). */
  var FIELD_TOOLS = [
    {name:'ServiceTrade',            cat:'Field',   access:'',             page:'servicetrade',   url:'https://app.servicetrade.com/', color:'#e07b1a', icon:'clipboard', desc:'Jobs, service records, deficiencies, and field paperwork.'},
    {name:'Troubleshooting Guide',   cat:'Field',   access:'',             page:'troubleshooting',url:'troubleshooting-guide.html', color:'#0e8a84', icon:'search', desc:'Field troubleshooting steps for common system and device issues.'},
    {name:'NFPA 25 Frequencies',     cat:'Field',   access:'',             page:'frequencies',    url:'nfpa25-frequencies.html', color:'#d12f2f', icon:'hourglass', desc:'Searchable test and inspection frequency lookup by device — confirm when an item is due.'},
    {name:'Library',                 cat:'Field',   access:'',             page:'library',        url:'nfpa-field-library.html', color:'#5e60a8', icon:'book', desc:'NFPA & manufacturer datasheets, recalls, obsolete cross-reference, and field tables.'},
    {name:'NICET',                   cat:'Field',   access:'Everyone',     page:'nicet',          url:'nicet-study.html', color:'#0e7490', icon:'nicet', desc:'NICET ITM certification study centers — Levels I, II, and III (NFPA 25).'},
    {name:'Pipe Volume Calculator', cat:'Field', access:'', page:'pipevolume', url:'pipe-volume.html', color:'#1f6f8b', icon:'pipecalc', desc:'Water volume in steel sprinkler pipe by size and schedule, fill make-up, and expansion tank sizing.'}
  ];

  /* Cards inside the Tech Cards page (tech-cards.html). */
  var TECH_CARDS = [
    {name:'Personal Inventory',      cat:'Field',   access:'',             page:'inventory',      url:'inventory-tracker.html', color:'#4a7b9d', icon:'gearwrench', desc:'Your vehicle stock — on-hand counts and reorder flags by category.'},
    {name:'Fleet Service',           cat:'Field',   access:'',             page:'fleet',          url:'fleet-service-request-firebase.html', color:'#376c91', icon:'truck', desc:'Submit vehicle service requests, mark problem areas, and generate service reports.'},
    {name:'Time-Off Requests',       cat:'Team',    access:'Everyone',     page:'timeoff',        url:'timeoff.html', color:'#1f7a3d', icon:'calendar', desc:'Submit paid time-off (PTO) requests and follow their approval status.'},
    {name:'On-Call Rotation',        cat:'Team',    access:'Everyone',     page:'oncall',         url:'oncall.html', color:'#d12f2f', icon:'phone', desc:'Current sprinkler department on-call schedule.'}
  ];

  function visible(l, auth){
    if(auth && typeof auth.canOpen === 'function' && !auth.canOpen(l.page)) return false;
    if(l.anyOf && auth && typeof auth.canOpen === 'function' &&
       !l.anyOf.some(function(p){ return auth.canOpen(p); })) return false;
    if(l.roles && !(auth && (auth.isAdmin || l.roles.includes(auth.profile && auth.profile.role)) &&
       (auth.isAdmin || (auth.profile && auth.profile.status === 'approved')))) return false;
    return true;
  }

  function render(host, links, auth){
    if(!host) return 0;
    host.innerHTML = '';
    var shown = 0;
    links.forEach(function(l){
      if(!visible(l, auth)) return;
      var a = document.createElement('a');
      var set = l.url && l.url !== '#';
      a.className = 'hublink' + (set ? '' : ' unset');
      if(l.color){ a.style.setProperty('--cc', l.color); }
      if(set){ a.href = l.url; }   // internal hub pages open in the same tab
      else { a.href = '#'; a.addEventListener('click',function(e){e.preventDefault();}); }
      a.innerHTML =
        '<span class="hubicon"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[l.icon] || '') + '</svg></span>' +
        '<span class="hbody">' +
          '<span class="htop"><span class="hname"></span>' +
          '<span class="hcat ' + l.cat.toLowerCase() + '"></span></span>' +
          '<p class="hdesc"></p>' +
        '</span>';
      a.querySelector('.hname').textContent = l.name;
      a.querySelector('.hcat').textContent = l.cat;
      a.querySelector('.hdesc').textContent = l.desc;
      if(l.access){
        var ac = document.createElement('span');
        var lc = l.access.toLowerCase();
        ac.className = 'haccess ' + ((lc.indexOf('manager') > -1 || lc.indexOf('admin') > -1) ? 'manager' : 'everyone');
        ac.textContent = l.access;
        a.querySelector('.hbody').appendChild(ac);
      }
      host.appendChild(a);
      shown++;
    });
    return shown;
  }

  window.FDEC_CARDS = { ICONS: ICONS, LINKS: LINKS, GROUPS: { fieldtools: FIELD_TOOLS, techcards: TECH_CARDS }, render: render };
})();

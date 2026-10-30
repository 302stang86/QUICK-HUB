/* FDEC shared identity — one name per employee, everywhere.
   The Administration roster (users/{uid}.name) is the single source of truth.
   Records keep the account id (uid); pages resolve the CURRENT roster name from it,
   so renaming someone in Administration updates every old and new record.

   - Administrators and managers can read the whole roster; it is cached on the
     device (names and emails only) so lists still resolve with no signal.
   - Everyone else only ever has their own name (remembered from their profile),
     which is what new records are written with. The email-prefix fallback
     ("jk1") is never used when a real profile name is known.
   Works with any Firebase SDK: pages hand in the data, this file only looks names up. */
(function(){
  var KEY = 'fdec_roster_v1', ME = 'fdec_me_v1', TTL = 10 * 60 * 1000;
  var byUid = {}, byEmail = {}, list = [];

  function tidy(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function lower(s){ return tidy(s).toLowerCase(); }
  function index(arr){
    byUid = {}; byEmail = {}; list = [];
    (arr || []).forEach(function(u){
      if(!u) return;
      var uid = u.uid || u.id || '';
      var rec = { uid: uid, name: tidy(u.name), email: lower(u.email), role: u.role || '', status: u.status || '' };
      list.push(rec);
      if(uid) byUid[uid] = rec;
      if(rec.email) byEmail[rec.email] = rec;
    });
  }
  function readCache(){
    try{ var c = JSON.parse(localStorage.getItem(KEY)); return (c && Array.isArray(c.list)) ? c : null; }
    catch(e){ return null; }
  }
  function me(){ try{ return JSON.parse(localStorage.getItem(ME)) || {}; }catch(e){ return {}; } }

  var cached = readCache();
  if(cached) index(cached.list);

  var API = {
    tidy: tidy,

    /* Remember the signed-in person's roster name (used when writing new records
       and as a fallback when the profile cannot be read, e.g. no signal). */
    rememberMe: function(uid, name, email){
      var n = tidy(name);
      if(!uid || !n) return;
      try{ localStorage.setItem(ME, JSON.stringify({ uid: uid, name: n, email: lower(email) })); }catch(e){}
    },
    myName: function(uid){
      var m = me();
      if(uid && m.uid && m.uid !== uid) return '';
      return tidy(m.name);
    },

    /* Hand in the roster (array of users with uid/name/email). */
    setRoster: function(arr){
      index(arr);
      try{ localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), list: list })); }catch(e){}
      return list;
    },
    /* Use the cached roster while it is fresh, otherwise call fetchFn() (which returns
       the users array). Failures (no signal, no permission) keep whatever is cached. */
    ensureRoster: async function(fetchFn, force){
      var c = readCache();
      if(!force && c && (Date.now() - c.at) < TTL){ index(c.list); return list; }
      try{
        var arr = await fetchFn();
        if(Array.isArray(arr)) API.setRoster(arr);
      }catch(e){ if(c) index(c.list); }
      return list;
    },
    invalidate: function(){ try{ localStorage.removeItem(KEY); }catch(e){} },
    roster: function(){ return list.slice(); },

    /* Current roster name for an account id (or email). `saved` is the text that was
       stored on the record when it was written; it is only used when the roster does
       not know the person (deleted account, or no uid on an older record). */
    nameFor: function(uid, saved, email){
      var r = (uid && byUid[uid]) || (email && byEmail[lower(email)]);
      if(r && r.name) return r.name;
      var m = me();
      if(m.name){
        if(uid && m.uid === uid) return m.name;
        if(email && lower(m.email) === lower(email)) return m.name;
      }
      return tidy(saved) || tidy(email) || '';
    },
    nameForEmail: function(email, saved){ return API.nameFor('', saved, email); }
  };
  window.FDEC_ID = API;
})();

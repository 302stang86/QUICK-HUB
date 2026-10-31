/* Battle Royal: stop double-tap / pinch zoom, and add a fullscreen toggle. */
(function(){
  // 1. No zoom. touch-action covers modern browsers; the listeners cover iOS Safari.
  document.addEventListener('gesturestart',function(e){e.preventDefault()},{passive:false});
  document.addEventListener('gesturechange',function(e){e.preventDefault()},{passive:false});
  var lastTap=0;
  document.addEventListener('touchend',function(e){
    var now=Date.now();
    if(now-lastTap<350&&!(e.target.closest&&e.target.closest('button,a,input,dialog')))e.preventDefault();
    lastTap=now;
  },{passive:false});
  document.addEventListener('dblclick',function(e){e.preventDefault()},{passive:false});

  // 2. Fullscreen toggle (arena page only).
  var btn=document.getElementById('fs');
  if(!btn)return;
  var el=document.documentElement;
  var enter=el.requestFullscreen||el.webkitRequestFullscreen;
  var exit=document.exitFullscreen||document.webkitExitFullscreen;
  var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
  if(standalone){btn.hidden=true;return;}       // installed app is already fullscreen
  function isFs(){return !!(document.fullscreenElement||document.webkitFullscreenElement)}
  function sync(){btn.textContent=isFs()?'✕':'⛶';btn.setAttribute('aria-label',isFs()?'Exit fullscreen':'Enter fullscreen')}
  document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
  btn.addEventListener('click',function(){
    var status=document.getElementById('battleStatus');
    if(!enter){ // iPhone Safari has no fullscreen API
      if(status)status.textContent='iPhone: tap Share, then Add to Home Screen, and open from there for full screen.';
      return;
    }
    try{
      var p=isFs()?exit.call(document):enter.call(el);
      if(p&&p.catch)p.catch(function(){});
      if(!isFs()&&screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(function(){});
    }catch(e){}
  });
  sync();
})();

/* MyOrbisAgents redesign — interactions */
(function () {
  // ---- Theme ----
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('orby_theme'); } catch (e) {}
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-theme', stored || (prefersDark ? 'dark' : 'light'));

  function toggleTheme() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('orby_theme', next); } catch (e) {}
  }

  // ---- Mobile menu ----
  function setup() {
    var themeBtns = document.querySelectorAll('[data-theme-toggle]');
    themeBtns.forEach(function (b) { b.addEventListener('click', toggleTheme); });

    var burger = document.querySelector('[data-burger]');
    var menu = document.querySelector('[data-mobile-menu]');
    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = menu.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { menu.classList.remove('open'); });
      });
    }

    // ---- Scroll reveal ----
    var items = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12 });
      items.forEach(function (el, i) {
        el.style.transitionDelay = ((i % 4) * 60) + 'ms';
        io.observe(el);
      });
    } else {
      items.forEach(function (el) { el.classList.add('in'); });
    }

    // ---- Count up ----
    var nums = document.querySelectorAll('[data-count]');
    if ('IntersectionObserver' in window && nums.length) {
      var co = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target, target = parseFloat(el.getAttribute('data-count'));
          var suffix = el.getAttribute('data-suffix') || '';
          var dur = 1200, start = performance.now();
          function tick(now) {
            var p = Math.min((now - start) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          co.unobserve(el);
        });
      }, { threshold: 0.5 });
      nums.forEach(function (n) { co.observe(n); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();

/* homepage conversion pass: audio player + ROI calculator (no-op off home) */
(function(){
  function init(){
    var player=document.querySelector('[data-player]');
    if(player){
      var audio=player.querySelector('[data-audio]'),btn=player.querySelector('[data-play]'),cur=player.querySelector('[data-cur]');
      btn.addEventListener('click',function(){
        if(audio.paused){audio.play().then(function(){player.classList.add('playing');btn.textContent='❚❚';}).catch(function(){window.location.href='tel:+14705173441';});}
        else{audio.pause();player.classList.remove('playing');btn.textContent='▶';}
      });
      audio.addEventListener('timeupdate',function(){var s=Math.floor(audio.currentTime||0);if(cur)cur.textContent=Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);});
      audio.addEventListener('ended',function(){player.classList.remove('playing');btn.textContent='▶';if(cur)cur.textContent='0:00';});
    }
    var calc=document.querySelector('[data-calc]');
    if(calc){
      var ci=calc.querySelector('[data-calc-calls]'),mi=calc.querySelector('[data-calc-comm]'),cv=calc.querySelector('[data-calc-calls-v]'),mv=calc.querySelector('[data-calc-comm-v]'),out=calc.querySelector('[data-calc-out]');
      function fmt(n){return '$'+Math.round(n).toLocaleString('en-US');}
      function upd(){var c=+ci.value,m=+mi.value;cv.textContent=c;mv.textContent=fmt(m);out.textContent=fmt(Math.round(c*52*0.04)*m);}
      ci.addEventListener('input',upd);mi.addEventListener('input',upd);upd();
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

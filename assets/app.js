(function () {
  var t = document.querySelector('.nav-toggle'), nav = document.getElementById('site-nav');
  if (t && nav) t.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  var form = document.getElementById('book-form');
  if (!form) return;
  var today = new Date().toISOString().slice(0, 10);
  var d = form.querySelector('[name=Date]'); if (d) d.min = today;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    form.querySelectorAll('[required]').forEach(function (el) {
      var bad = !el.value.trim();
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad && ok) { el.focus(); ok = false; }
    });
    if (!ok) return;
    var lines = ['AURUM booking request'];
    form.querySelectorAll('select, input, textarea').forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') { if (el.checked) lines.push(el.name + ': yes'); return; }
      if (el.value.trim()) lines.push(el.name + ': ' + el.value.trim());
    });
    lines.push('Page language: ' + document.documentElement.lang);
    var text = lines.join('\n');
    var wa = form.dataset.wa, msg = form.querySelector('.form-msg');
    if (wa) {
      window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      return;
    }
    var done = function () { msg.textContent = form.dataset.copied; window.open(form.dataset.ig, '_blank', 'noopener'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { msg.textContent = text; });
    } else { msg.textContent = text; }
  });
})();

(function () {
  // keep the hero video playing: force muted autoplay, retry on first touch,
  // and fall back to a blob URL on hosts that do not support range requests (iOS needs them)
  document.querySelectorAll('video[autoplay]').forEach(function (v) {
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('muted', '');
    var src = v.dataset.src || v.getAttribute('src');
    var attached = !v.dataset.src;
    var tryPlay = function () {
      if (!attached) return;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    };
    // attach the video only after the page has loaded, so it never delays the first paint;
    // skip it for visitors who turned on data saving (the poster image stays)
    var conn = navigator.connection || {};
    var attach = function () {
      if (attached || conn.saveData) return;
      attached = true; v.src = src; v.preload = 'auto'; tryPlay();
    };
    if (document.readyState === 'complete') setTimeout(attach, 50);
    else window.addEventListener('load', function () { setTimeout(attach, 50); });
    var blobbed = false;
    var fallback = function () {
      if (blobbed || !src || !window.fetch) return; blobbed = true;
      fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
        var t = v.currentTime; v.src = URL.createObjectURL(b); v.load();
        v.addEventListener('loadeddata', function () { try { v.currentTime = t; } catch (e) {} tryPlay(); }, { once: true });
      }).catch(function () {});
    };
    tryPlay();
    v.addEventListener('canplay', tryPlay);
    v.addEventListener('stalled', fallback);
    v.addEventListener('error', fallback, true);
    setTimeout(function () { if (attached && (v.paused || v.readyState < 3)) { fallback(); tryPlay(); } }, 4000);
    var kick = function () { tryPlay(); };
    ['touchstart', 'click', 'scroll'].forEach(function (e) { window.addEventListener(e, kick, { once: true, passive: true }); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tryPlay(); });
  });

  // price calculator
  var f = document.getElementById('calc');
  if (f) {
    var P = JSON.parse(f.dataset.prices), T = JSON.parse(f.dataset.i18n);
    var box = document.querySelector('.calc-result'), lines = box.querySelector('.calc-lines');
    var $ = function (n) { return f.elements[n]; };
    var usd = function (n) { return '$' + n.toLocaleString('en-US'); };
    var night = function (t) { if (!t) return false; var h = parseInt(t.split(':')[0], 10); return h >= 22 || h < 6; };
    var calc = function () {
      var pre = $('plan').value === 'pre', round = f.querySelector('[name=trip]:checked').value === 'round';
      box.ownerDocument.querySelector('.rtime').hidden = !round;
      var pax = +$('pax').value, bags = +$('bags').value, stops = +$('stops').value;
      var veh = Math.max(Math.ceil(pax / 4), Math.ceil(bags / 8), 1);
      var paid = Math.max(0, stops - (pre ? 1 : 0));
      var rows = [[T.l_plan + ' · ' + (pre ? T.pre : T.std), pre ? P.PRE : P.STD]];
      if (pre && stops > 0) rows.push([T.l_free, T.included]);
      if (paid) rows.push([T.l_stops + ' × ' + paid, paid * P.STOP]);
      if (night($('time').value)) rows.push([T.l_night, P.NIGHT]);
      if (round) rows.push([T.l_rt, P.RT]);
      if (round && night($('rtime').value)) rows.push([T.l_rnight, P.NIGHT]);
      var per = rows.reduce(function (s, r) { return s + (typeof r[1] === 'number' ? r[1] : 0); }, 0);
      var reg = per - (pre ? P.PRE : P.STD) + (pre ? P.PRE_REG : P.STD_REG);
      if (veh > 1) rows.push([T.l_veh, '× ' + veh]);
      lines.innerHTML = '';
      rows.forEach(function (r) {
        var li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('b');
        a.textContent = r[0]; b.textContent = typeof r[1] === 'number' ? usd(r[1]) : r[1];
        li.appendChild(a); li.appendChild(b); lines.appendChild(li);
      });
      var total = per * veh;
      box.querySelector('.js-total').textContent = usd(total);
      box.querySelector('.js-reg').textContent = usd(reg * veh);
      box.querySelector('.js-save').textContent = usd((reg - per) * veh);
      var vn = box.querySelector('.calc-veh'); vn.hidden = veh < 2; vn.textContent = T.veh_note.replace('{n}', veh);
      var q = new URLSearchParams({ plan: $('plan').value, airport: $('airport').value, dir: $('dir').value,
        pax: pax, bags: bags, stops: stops, rt: round ? 1 : 0, time: $('time').value, est: total, veh: veh });
      box.querySelector('.js-book').href = f.dataset.book + '?' + q.toString();
    };
    f.addEventListener('input', calc); f.addEventListener('change', calc); calc();
  }

  // prefill the booking form from the calculator
  var b = document.getElementById('book-form'), q = new URLSearchParams(location.search);
  if (b && q.has('plan')) {
    var pick = function (name, idx) { var s = b.elements[name]; if (s && idx >= 0) s.selectedIndex = idx; };
    pick('Plan', q.get('plan') === 'pre' ? 1 : 0);
    pick('Airport', { icn1: 0, icn2: 1, gmp: 2 }[q.get('airport')]);
    pick('Direction', q.get('dir') === 'dep' ? 1 : 0);
    if (q.get('time')) b.elements['Time'].value = q.get('time');
    var pax = +q.get('pax'), bags = +q.get('bags');
    if (pax >= 1 && pax <= 4) b.elements['Passengers'].value = pax;
    if (bags >= 0 && bags <= 8) b.elements['Suitcases'].value = bags;
    b.elements['Round trip'].checked = q.get('rt') === '1';
    b.elements['Additional stop'].checked = +q.get('stops') > 0;
    b.elements['Notes'].value = 'Calculator estimate: $' + q.get('est') + ' | vehicles ' + q.get('veh') +
      ' | passengers ' + pax + ' | suitcases ' + bags + ' | stops ' + q.get('stops');
  }
})();

(function () {
  // preselect the vehicle chosen on the fleet page
  var b = document.getElementById('book-form');
  if (!b) return;
  var v = new URLSearchParams(location.search).get('vehicle'), s = b.elements['Vehicle'];
  if (!v || !s) return;
  for (var i = 0; i < s.options.length; i++) if (s.options[i].dataset.key === v) { s.selectedIndex = i; break; }
})();

(function () {
  // KakaoTalk has no public link for a personal ID: copy the ID and tell the visitor what to do
  var toast = document.querySelector('.toast'), timer;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-copy]');
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('data-copy'), msg = toast ? toast.dataset.copied : id;
    var show = function () {
      if (!toast) return;
      toast.textContent = msg; toast.classList.add('show');
      clearTimeout(timer); timer = setTimeout(function () { toast.classList.remove('show'); }, 4000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(show, show);
    else show();
  });
})();

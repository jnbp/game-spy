// Wer ist der Spion? (Who is the spy?) – Version 2
// Flow: setup → per player: "ready?" gate → role (press and hold) → round with timer → next round.
// UI texts are German on purpose; the game is played in German.
(function () {
  'use strict';

  const VERSION = '2.0.2';
  const KEY = { settings: 'spy.v2.settings', used: 'spy.v2.used', news: 'spy.v2.news' };
  const LIMITS = { players: [3, 20], minutes: [0, 20] };
  const GATE_LOCK_MS = 1200;   // how long "Ich bin …" stays locked so nobody taps through by accident
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Storage (fails silently if the browser blocks it) ----------
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  // ---------- Load location packs ----------
  const packs = [];
  window.Spy = {
    pack(def) {
      const { places, problems } = window.SpyParse(def.places);
      problems.forEach((p) => console.warn(`[${def.id}] ${p}`));
      packs.push({ id: def.id, name: def.name, icon: def.icon || '📍', places });
    }
  };

  function loadPacks() {
    const ids = window.SPY_PACKS || [];
    return Promise.all(ids.map((id) => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `packs/${id}.js?v=${VERSION}`;
      s.onload = resolve;
      s.onerror = () => { console.warn(`Pack ${id} could not be loaded`); resolve(); };
      document.head.appendChild(s);
    }))).then(() => {
      packs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      const seen = new Set();   // count duplicates across packs only once
      packs.forEach((p) => {
        p.places = p.places.filter((pl) => {
          const k = norm(pl.name);
          if (seen.has(k)) { console.warn(`Duplicate location ignored: ${pl.name} (${p.id})`); return false; }
          seen.add(k); return true;
        });
      });
    });
  }
  const norm = (s) => s.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');

  // ---------- Settings ----------
  const defaults = { players: 4, spies: 1, minutes: 8, roles: true, useNames: false, names: [], packs: null };
  const settings = Object.assign({}, defaults, store.get(KEY.settings, {}));
  const save = () => store.set(KEY.settings, settings);

  // ---------- Animation helpers ----------
  const $ = (id) => document.getElementById(id);

  // Split text into letters that fly in staggered
  function splitText(el, text) {
    el.textContent = '';
    el.setAttribute('aria-label', text);
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--c', i);
      s.setAttribute('aria-hidden', 'true');
      s.textContent = c;
      el.appendChild(s);
    });
  }
  // Restart an animation (remove class, force reflow, add again)
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  // Set the stagger index for entrance animations
  function stagger(selector, root = document) {
    root.querySelectorAll(selector).forEach((el, i) => el.style.setProperty('--i', i));
  }
  // Paper confetti in the game colours
  function confetti(x, y, n = 28) {
    if (reduceMotion) return;
    const fx = $('fx');
    const colors = ['#e8d5a3', '#d4bb7c', '#c8323a', '#c9d3e0', '#f2c14e'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 180;
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      c.style.setProperty('--dy', `${Math.sin(a) * d + 160}px`);
      c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
      c.style.setProperty('--dur', `${1 + Math.random() * 0.8}s`);
      fx.appendChild(c);
      setTimeout(() => c.remove(), 2000);
    }
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  // Ripple when tapping buttons
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn, .fx-press');
    if (!btn || btn.disabled || reduceMotion) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const rip = document.createElement('span');
    rip.className = 'ripple';
    rip.style.width = rip.style.height = `${size}px`;
    rip.style.left = `${e.clientX - r.left - size / 2}px`;
    rip.style.top = `${e.clientY - r.top - size / 2}px`;
    btn.appendChild(rip);
    setTimeout(() => rip.remove(), 650);
  });

  const screens = { setup: $('screen-setup'), gate: $('screen-gate'), deal: $('screen-deal'), play: $('screen-play') };
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove('is-active'));
    const el = screens[name];
    void el.offsetWidth;   // restart the entrance animation every time
    el.classList.add('is-active');
    window.scrollTo(0, 0);
  }

  const playerName = (i) => (settings.useNames && (settings.names[i] || '').trim()) || `Spieler ${i + 1}`;

  // ---------- Setup screen ----------
  function clampSettings() {
    settings.players = Math.min(LIMITS.players[1], Math.max(LIMITS.players[0], settings.players));
    settings.spies = Math.min(Math.max(1, settings.players - 2), Math.max(1, settings.spies));
    settings.minutes = Math.min(LIMITS.minutes[1], Math.max(LIMITS.minutes[0], settings.minutes));
  }

  function setOut(id, text, dir) {
    const el = $(id);
    if (el.textContent === String(text)) return;
    el.textContent = text;
    if (dir) replay(el, dir > 0 ? 'bump-up' : 'bump-down');
  }

  function renderSetup(changed, dir) {
    clampSettings();
    setOut('out-players', settings.players, changed === 'players' || changed === 'spies' ? dir : 0);
    setOut('out-spies', settings.spies, changed === 'spies' || changed === 'players' ? dir : 0);
    setOut('out-minutes', settings.minutes ? `${settings.minutes} Min.` : 'Aus', changed === 'minutes' ? dir : 0);
    document.querySelector('[data-step="players"][data-dir="-1"]').disabled = settings.players <= LIMITS.players[0];
    document.querySelector('[data-step="players"][data-dir="1"]').disabled = settings.players >= LIMITS.players[1];
    document.querySelector('[data-step="spies"][data-dir="-1"]').disabled = settings.spies <= 1;
    document.querySelector('[data-step="spies"][data-dir="1"]').disabled = settings.spies >= settings.players - 2;
    document.querySelector('[data-step="minutes"][data-dir="-1"]').disabled = settings.minutes <= LIMITS.minutes[0];
    document.querySelector('[data-step="minutes"][data-dir="1"]').disabled = settings.minutes >= LIMITS.minutes[1];
    $('opt-roles').checked = settings.roles;
    $('opt-names').checked = settings.useNames;
    renderNames();
    renderPacks();
    validate();
  }

  function renderNames() {
    const box = $('names');
    box.hidden = !settings.useNames;
    if (!settings.useNames) return;
    const inputs = box.querySelectorAll('input');
    if (inputs.length === settings.players) return;
    box.textContent = '';
    for (let i = 0; i < settings.players; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 24;
      input.placeholder = `Spieler ${i + 1}`;
      input.setAttribute('aria-label', `Name von Spieler ${i + 1}`);
      input.style.setProperty('--i', i);
      input.value = settings.names[i] || '';
      input.addEventListener('input', () => { settings.names[i] = input.value; save(); });
      box.appendChild(input);
    }
  }

  function selectedIds() {
    if (!Array.isArray(settings.packs)) return packs.map((p) => p.id);
    return settings.packs.filter((id) => packs.some((p) => p.id === id));
  }

  let shownTotal = 0;
  function countUp(el, from, to, suffix) {
    if (reduceMotion || from === to) { el.textContent = `${to}${suffix}`; return; }
    const start = performance.now();
    const dur = 450;
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = `${Math.round(from + (to - from) * e)}${suffix}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderPacks(poppedId) {
    const box = $('packs');
    const sel = new Set(selectedIds());
    if (!box.children.length) {
      packs.forEach((p, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pack';
        b.dataset.id = p.id;
        b.style.setProperty('--i', i);
        const icon = document.createElement('span'); icon.textContent = p.icon; icon.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span'); name.textContent = p.name;
        const count = document.createElement('span'); count.className = 'count'; count.textContent = p.places.length;
        b.append(icon, name, count);
        b.addEventListener('click', () => {
          const now = new Set(selectedIds());
          now.has(p.id) ? now.delete(p.id) : now.add(p.id);
          settings.packs = packs.map((x) => x.id).filter((id) => now.has(id));
          save(); renderPacks(p.id); validate();
        });
        b.addEventListener('animationend', () => b.classList.remove('pop'));
        box.appendChild(b);
      });
    }
    box.querySelectorAll('.pack').forEach((b) => {
      b.setAttribute('aria-pressed', sel.has(b.dataset.id));
      if (b.dataset.id === poppedId) replay(b, 'pop');
    });
    const total = packs.reduce((n, p) => n + p.places.length, 0);
    const chosen = packs.filter((p) => sel.has(p.id)).reduce((n, p) => n + p.places.length, 0);
    countUp($('pack-summary'), shownTotal, chosen, ` von ${total}`);
    shownTotal = chosen;
  }

  function validate() {
    const err = selectedIds().length ? '' : 'Wähle mindestens ein Ortspaket.';
    $('setup-error').textContent = err;
    $('btn-start').disabled = !!err;
    return !err;
  }

  document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const dir = Number(b.dataset.dir);
    settings[b.dataset.step] += dir;
    save(); renderSetup(b.dataset.step, dir);
  }));
  $('opt-roles').addEventListener('change', (e) => { settings.roles = e.target.checked; save(); });
  $('opt-names').addEventListener('change', (e) => { settings.useNames = e.target.checked; save(); renderNames(); });
  $('packs-all').addEventListener('click', () => {
    settings.packs = packs.map((p) => p.id); save(); renderPacks(); validate();
    document.querySelectorAll('.pack').forEach((b, i) => setTimeout(() => replay(b, 'pop'), i * 18));
  });
  $('packs-none').addEventListener('click', () => { settings.packs = []; save(); renderPacks(); validate(); });

  // ---------- Draw a location without repeats ----------
  function drawPlace() {
    const sel = new Set(selectedIds());
    const pool = [];
    packs.forEach((p) => { if (sel.has(p.id)) p.places.forEach((pl) => pool.push({ ...pl, key: `${p.id}:${norm(pl.name)}` })); });
    const used = new Set(store.get(KEY.used, []));
    let available = pool.filter((pl) => !used.has(pl.key));
    if (!available.length) {          // every selected location was used → start over
      pool.forEach((pl) => used.delete(pl.key));
      available = pool;
    }
    const place = available[Math.floor(Math.random() * available.length)];
    used.add(place.key);
    store.set(KEY.used, [...used]);
    return place;
  }

  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  // ---------- Prepare a round ----------
  let round = null;

  function newRound() {
    const place = drawPlace();
    const order = shuffle([...Array(settings.players).keys()]);
    const spies = new Set(order.slice(0, settings.spies));
    const roles = shuffle([...place.roles]);
    let r = 0;
    const cards = [...Array(settings.players).keys()].map((i) => spies.has(i)
      ? { spy: true }
      : { spy: false, role: settings.roles && roles.length ? roles[r++ % roles.length] : '' });
    round = { place, spies, cards, current: 0, starter: Math.floor(Math.random() * settings.players) };
    showGate();
  }

  // ---------- "Player X – ready?" gate ----------
  let gateTimer = null;
  function showGate() {
    closeCard(true);
    const i = round.current;
    const name = playerName(i);
    $('gate-progress').textContent = `${i + 1} von ${settings.players}`;
    splitText($('gate-name'), name);
    $('gate-name-inline').textContent = name;
    $('gate-name-inline2').textContent = name;
    $('gate-btn-label').textContent = `Ich bin ${name}`;
    const btn = $('btn-gate');
    btn.disabled = true;
    btn.style.setProperty('--lock-ms', `${GATE_LOCK_MS}ms`);
    btn.classList.remove('is-locking', 'btn-enabled-flash');
    void btn.offsetWidth;
    btn.classList.add('is-locking');
    clearTimeout(gateTimer);
    gateTimer = setTimeout(() => {
      btn.disabled = false;
      btn.classList.remove('is-locking');
      replay(btn, 'btn-enabled-flash');
    }, GATE_LOCK_MS);
    show('gate');
  }
  $('btn-gate').addEventListener('click', () => { if (!$('btn-gate').disabled) showDeal(); });

  // ---------- Role reveal by press and hold ----------
  const dossier = $('dossier');
  const hold = $('btn-hold');
  let holdTimer = null;
  let isOpen = false;

  function showDeal() {
    closeCard(true);
    const i = round.current;
    const name = playerName(i);
    $('deal-progress').textContent = `${i + 1} von ${settings.players}`;
    $('deal-name').textContent = name;
    $('flap-name').textContent = name;
    const next = $('btn-next');
    next.disabled = true;
    next.textContent = i === settings.players - 1 ? 'Runde starten' : `Weitergeben an ${playerName(i + 1)}`;
    show('deal');
  }

  function fillCard() {
    const card = round.cards[round.current];
    dossier.classList.toggle('is-spy', card.spy);
    $('card-emoji').textContent = card.spy ? '🕵️' : (round.place.emoji || '📍');
    $('card-label').textContent = card.spy
      ? (settings.spies > 1 ? `Ihr seid ${settings.spies} Spione. Finde den Ort heraus.` : 'Finde den Ort heraus, ohne aufzufliegen.')
      : 'Du bist hier:';
    if (card.spy) $('card-place').textContent = '';
    else splitText($('card-place'), round.place.name);
    $('card-role').textContent = card.spy ? '' : (card.role ? `Deine Rolle: ${card.role}` : '');
  }

  function clearCard() {
    ['card-emoji', 'card-label', 'card-place', 'card-role'].forEach((id) => { $(id).textContent = ''; });
    $('card-place').removeAttribute('aria-label');
    dossier.classList.remove('is-spy');
  }

  let clearTimer = null;
  function openCard() {
    clearTimeout(clearTimer);
    fillCard();
    isOpen = true;
    dossier.classList.remove('is-closing');
    dossier.classList.add('is-open');
    hold.classList.add('is-open');
    $('dossier-inside').setAttribute('aria-hidden', 'false');
    if (navigator.vibrate) navigator.vibrate(round.cards[round.current].spy ? [40, 60, 80] : 30);
    const next = $('btn-next');
    if (next.disabled) { next.disabled = false; replay(next, 'btn-enabled-flash'); }
  }

  let closingTimer = null;
  function closeCard(immediate) {
    clearTimeout(holdTimer);
    hold.classList.remove('is-holding', 'is-open');
    const wasOpen = dossier.classList.contains('is-open');
    dossier.classList.remove('is-open');
    clearTimeout(closingTimer);
    if (wasOpen && !immediate) {   // fold the flap back down from the top
      dossier.classList.add('is-closing');
      closingTimer = setTimeout(() => dossier.classList.remove('is-closing'), 600);
    } else {
      dossier.classList.remove('is-closing');
    }
    $('dossier-inside').setAttribute('aria-hidden', 'true');
    isOpen = false;
    clearTimeout(clearTimer);
    if (immediate) clearCard();
    else clearTimer = setTimeout(clearCard, 550); // clear only once the folder is closed
  }

  const holdMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hold-ms')) || 450;
  function startHold() {
    if (isOpen) return;
    hold.classList.add('is-holding');
    holdTimer = setTimeout(openCard, holdMs());
  }
  function endHold() { if (hold.classList.contains('is-holding') || isOpen) closeCard(false); }

  hold.addEventListener('pointerdown', (e) => { e.preventDefault(); hold.setPointerCapture(e.pointerId); startHold(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => hold.addEventListener(t, endHold));
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
  hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') endHold(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && isOpen) closeCard(true); });

  $('btn-next').addEventListener('click', () => {
    closeCard(true);
    round.current++;
    if (round.current < settings.players) showGate();
    else startPlay();
  });

  // ---------- Round screen ----------
  let clock = { total: 0, remaining: 0, deadline: 0, running: false, tick: null };
  let audioCtx = null;
  let wakeLock = null;
  const RING = 628.3;

  function startPlay() {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; }
    $('play-info').textContent = settings.spies > 1 ? `${settings.spies} Spione sind unter euch` : '1 Spion ist unter euch';
    $('reveal-card').classList.remove('is-flipped');
    $('btn-reveal').disabled = false;
    $('reveal-place').textContent = `${round.place.emoji} ${round.place.name}`;
    const spyNames = [...round.spies].sort((a, b) => a - b).map(playerName);
    $('reveal-spies').textContent = `${spyNames.length > 1 ? 'Spione' : 'Spion'}: ${spyNames.join(', ')}`;
    const hasClock = settings.minutes > 0;
    $('clock-wrap').hidden = !hasClock;
    $('clock-actions').hidden = !hasClock;
    $('btn-pause').disabled = false;
    show('play');
    requestWakeLock();
    spinStarter();
    if (hasClock) { clock.total = clock.remaining = settings.minutes * 60000; resumeClock(); }
  }

  // Pick the starting player like a slot machine
  function spinStarter() {
    const el = $('starter-name');
    const target = round.starter;
    if (reduceMotion || settings.players < 2) { el.textContent = playerName(target); return; }
    let step = 0;
    const steps = 14 + settings.players + Math.floor(Math.random() * settings.players);
    let idx = (target - steps % settings.players + settings.players * 10) % settings.players;
    const tick = () => {
      idx = (idx + 1) % settings.players;
      el.textContent = playerName(idx);
      replay(el, 'spin');
      step++;
      if (step < steps) setTimeout(tick, 50 + Math.pow(step / steps, 3) * 260);
      else {
        el.textContent = playerName(target);
        replay(el, 'landed');
        const [x, y] = centerOf(el);
        confetti(x, y, 22);
        if (navigator.vibrate) navigator.vibrate(20);
      }
    };
    setTimeout(tick, 400);
  }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function renderClock() {
    const left = clock.running ? clock.deadline - Date.now() : clock.remaining;
    const wrap = $('clock-wrap');
    $('clock').textContent = fmt(left);
    $('clock-fill').style.strokeDashoffset = `${RING * (1 - Math.max(0, left) / (clock.total || 1))}`;
    wrap.classList.toggle('is-low', left <= 60000 && left > 0);
    wrap.classList.toggle('is-over', left <= 0);
    wrap.classList.toggle('is-paused', !clock.running && left > 0);
    if (left <= 0 && clock.running) { stopClock(); clock.remaining = 0; timeUp(); }
  }
  function resumeClock() {
    if (clock.remaining <= 0) return;
    clock.deadline = Date.now() + clock.remaining;
    clock.running = true;
    clearInterval(clock.tick);
    clock.tick = setInterval(renderClock, 250);
    $('btn-pause').textContent = 'Pause';
    renderClock();
  }
  function stopClock() {
    if (clock.running) clock.remaining = clock.deadline - Date.now();
    clock.running = false;
    clearInterval(clock.tick);
  }
  function timeUp() {
    $('btn-pause').textContent = 'Zeit ist um';
    $('btn-pause').disabled = true;
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
    beep();
  }
  function beep() {
    if (!audioCtx) return;
    try {
      audioCtx.resume();
      [0, 0.35, 0.7].forEach((t) => {
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
        const at = audioCtx.currentTime + t;
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.3, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
        o.start(at); o.stop(at + 0.3);
      });
    } catch { /* no sound */ }
  }
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch { /* ignore */ } wakeLock = null; }

  $('btn-pause').addEventListener('click', () => {
    if (clock.running) { stopClock(); $('btn-pause').textContent = 'Weiter'; renderClock(); }
    else resumeClock();
  });
  // Reveal only after a confirmation
  const confirmDlg = $('confirm');
  $('btn-reveal').addEventListener('click', () => {
    if (typeof confirmDlg.showModal !== 'function') { if (window.confirm('Wirklich auflösen? Damit endet die Runde.')) reveal(); return; }
    confirmDlg.returnValue = '';
    confirmDlg.showModal();
  });
  confirmDlg.addEventListener('close', () => { if (confirmDlg.returnValue === 'ok') reveal(); });
  function reveal() {
    if (settings.minutes > 0) { stopClock(); renderClock(); }
    $('btn-reveal').disabled = true;
    $('reveal-card').classList.add('is-flipped');
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    setTimeout(() => { const [x, y] = centerOf($('reveal-card')); confetti(x, y, 40); }, 450);
  }
  function leavePlay() { stopClock(); releaseWakeLock(); $('btn-pause').disabled = false; }
  $('btn-again').addEventListener('click', () => { leavePlay(); newRound(); });
  $('btn-setup').addEventListener('click', () => { leavePlay(); renderSetup(); show('setup'); });
  $('btn-start').addEventListener('click', () => { if (validate()) newRound(); });

  // ---------- What's new dialog ----------
  const news = $('news');
  $('btn-news').addEventListener('click', () => news.showModal());
  news.addEventListener('close', () => store.set(KEY.news, VERSION));

  // ---------- Start ----------
  splitText($('title'), $('title').textContent);
  stagger('#screen-setup .rise');
  stagger('.news-list li');
  loadPacks().then(() => {
    const total = packs.reduce((n, p) => n + p.places.length, 0);
    document.querySelectorAll('[data-total-places]').forEach((el) => { el.textContent = total.toLocaleString('de-DE'); });
    document.querySelectorAll('[data-total-packs]').forEach((el) => { el.textContent = packs.length; });
    renderSetup();
    if (store.get(KEY.news, '') !== VERSION && typeof news.showModal === 'function') news.showModal();
  });
})();

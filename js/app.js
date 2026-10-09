// Wer ist der Spion? – Version 2
// Ablauf: Einrichtung → Rollen verteilen (Gedrückthalten) → Runde mit Timer → nächste Runde.
(function () {
  'use strict';

  const VERSION = '2.0.0';
  const KEY = { settings: 'spy.v2.settings', used: 'spy.v2.used', news: 'spy.v2.news' };
  const LIMITS = { players: [3, 20], minutes: [0, 20] };

  // ---------- Speicher (fällt still aus, wenn der Browser ihn sperrt) ----------
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } }
  };

  // ---------- Pakete laden ----------
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
      s.onerror = () => { console.warn(`Paket ${id} konnte nicht geladen werden`); resolve(); };
      document.head.appendChild(s);
    }))).then(() => {
      packs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      // Dubletten über Pakete hinweg nur einmal zählen
      const seen = new Set();
      packs.forEach((p) => {
        p.places = p.places.filter((pl) => {
          const k = norm(pl.name);
          if (seen.has(k)) { console.warn(`Doppelter Ort ignoriert: ${pl.name} (${p.id})`); return false; }
          seen.add(k); return true;
        });
      });
    });
  }
  const norm = (s) => s.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');

  // ---------- Einstellungen ----------
  const defaults = { players: 4, spies: 1, minutes: 8, roles: true, useNames: false, names: [], packs: null };
  const settings = Object.assign({}, defaults, store.get(KEY.settings, {}));
  const save = () => store.set(KEY.settings, settings);

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const screens = { setup: $('screen-setup'), deal: $('screen-deal'), play: $('screen-play') };
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove('is-active'));
    screens[name].classList.add('is-active');
    window.scrollTo(0, 0);
  }

  const playerName = (i) => (settings.useNames && (settings.names[i] || '').trim()) || `Spieler ${i + 1}`;

  // ---------- Einrichtung ----------
  function clampSettings() {
    settings.players = Math.min(LIMITS.players[1], Math.max(LIMITS.players[0], settings.players));
    settings.spies = Math.min(Math.max(1, settings.players - 2), Math.max(1, settings.spies));
    settings.minutes = Math.min(LIMITS.minutes[1], Math.max(LIMITS.minutes[0], settings.minutes));
  }

  function renderSetup() {
    clampSettings();
    $('out-players').textContent = settings.players;
    $('out-spies').textContent = settings.spies;
    $('out-minutes').textContent = settings.minutes ? `${settings.minutes} Min.` : 'Aus';
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
      input.value = settings.names[i] || '';
      input.addEventListener('input', () => { settings.names[i] = input.value; save(); });
      box.appendChild(input);
    }
  }

  function selectedIds() {
    if (!Array.isArray(settings.packs)) return packs.map((p) => p.id);
    return settings.packs.filter((id) => packs.some((p) => p.id === id));
  }

  function renderPacks() {
    const box = $('packs');
    const sel = new Set(selectedIds());
    if (!box.children.length) {
      packs.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pack';
        b.dataset.id = p.id;
        const icon = document.createElement('span'); icon.textContent = p.icon; icon.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span'); name.textContent = p.name;
        const count = document.createElement('span'); count.className = 'count'; count.textContent = p.places.length;
        b.append(icon, name, count);
        b.addEventListener('click', () => {
          const now = new Set(selectedIds());
          now.has(p.id) ? now.delete(p.id) : now.add(p.id);
          settings.packs = packs.map((x) => x.id).filter((id) => now.has(id));
          save(); renderPacks(); validate();
        });
        box.appendChild(b);
      });
    }
    box.querySelectorAll('.pack').forEach((b) => b.setAttribute('aria-pressed', sel.has(b.dataset.id)));
    const total = packs.reduce((n, p) => n + p.places.length, 0);
    const chosen = packs.filter((p) => sel.has(p.id)).reduce((n, p) => n + p.places.length, 0);
    $('pack-summary').textContent = `${chosen} von ${total}`;
  }

  function validate() {
    const err = selectedIds().length ? '' : 'Wähle mindestens ein Ortspaket.';
    $('setup-error').textContent = err;
    $('btn-start').disabled = !!err;
    return !err;
  }

  document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    settings[b.dataset.step] += Number(b.dataset.dir);
    save(); renderSetup();
  }));
  $('opt-roles').addEventListener('change', (e) => { settings.roles = e.target.checked; save(); });
  $('opt-names').addEventListener('change', (e) => { settings.useNames = e.target.checked; save(); renderNames(); });
  $('packs-all').addEventListener('click', () => { settings.packs = packs.map((p) => p.id); save(); renderPacks(); validate(); });
  $('packs-none').addEventListener('click', () => { settings.packs = []; save(); renderPacks(); validate(); });

  // ---------- Ort ziehen, ohne Wiederholung ----------
  function drawPlace() {
    const sel = new Set(selectedIds());
    const pool = [];
    packs.forEach((p) => { if (sel.has(p.id)) p.places.forEach((pl) => pool.push({ ...pl, key: `${p.id}:${norm(pl.name)}` })); });
    const used = new Set(store.get(KEY.used, []));
    let available = pool.filter((pl) => !used.has(pl.key));
    if (!available.length) {          // alle gewählten Orte waren dran → von vorn
      pool.forEach((pl) => used.delete(pl.key));
      available = pool;
    }
    const place = available[Math.floor(Math.random() * available.length)];
    used.add(place.key);
    store.set(KEY.used, [...used]);
    return place;
  }

  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  // ---------- Runde vorbereiten ----------
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
    showDeal();
  }

  // ---------- Verteilung mit Gedrückthalten ----------
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
    $('deal-name-inline').textContent = name;
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
    $('card-place').textContent = card.spy ? '' : round.place.name;
    $('card-role').textContent = card.spy ? '' : (card.role ? `Deine Rolle: ${card.role}` : '');
  }

  function clearCard() {
    ['card-emoji', 'card-label', 'card-place', 'card-role'].forEach((id) => { $(id).textContent = ''; });
    dossier.classList.remove('is-spy');
  }

  let clearTimer = null;
  function openCard() {
    clearTimeout(clearTimer);
    fillCard();
    isOpen = true;
    dossier.classList.add('is-open');
    hold.classList.add('is-open');
    $('dossier-inside').setAttribute('aria-hidden', 'false');
    if (navigator.vibrate) navigator.vibrate(30);
    $('btn-next').disabled = false;
  }

  function closeCard(immediate) {
    clearTimeout(holdTimer);
    hold.classList.remove('is-holding', 'is-open');
    dossier.classList.remove('is-open');
    $('dossier-inside').setAttribute('aria-hidden', 'true');
    isOpen = false;
    clearTimeout(clearTimer);
    if (immediate) clearCard();
    else clearTimer = setTimeout(clearCard, 500); // erst leeren, wenn die Mappe zu ist
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
    if (round.current < settings.players) showDeal();
    else startPlay();
  });

  // ---------- Spielrunde ----------
  let clock = { remaining: 0, deadline: 0, running: false, tick: null };
  let audioCtx = null;
  let wakeLock = null;

  function startPlay() {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; }
    $('play-info').textContent = settings.spies > 1 ? `${settings.spies} Spione sind unter euch` : '1 Spion ist unter euch';
    $('starter-name').textContent = playerName(round.starter);
    $('reveal').hidden = true;
    $('btn-reveal').hidden = false;
    $('reveal-place').textContent = `${round.place.emoji} ${round.place.name}`;
    const spyNames = [...round.spies].sort((a, b) => a - b).map(playerName);
    $('reveal-spies').textContent = `${spyNames.length > 1 ? 'Spione' : 'Spion'}: ${spyNames.join(', ')}`;
    const hasClock = settings.minutes > 0;
    $('clock').hidden = !hasClock;
    $('btn-pause').parentElement.hidden = !hasClock;
    show('play');
    requestWakeLock();
    if (hasClock) { clock.remaining = settings.minutes * 60000; resumeClock(); }
  }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function renderClock() {
    const left = clock.running ? clock.deadline - Date.now() : clock.remaining;
    const el = $('clock');
    el.textContent = fmt(left);
    el.classList.toggle('is-low', left <= 60000 && left > 0);
    el.classList.toggle('is-over', left <= 0);
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
    } catch { /* kein Ton */ }
  }
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; }
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch { /* egal */ } wakeLock = null; }

  $('btn-pause').addEventListener('click', () => {
    if (clock.running) { stopClock(); $('btn-pause').textContent = 'Weiter'; renderClock(); }
    else resumeClock();
  });
  $('btn-reveal').addEventListener('click', () => {
    stopClock(); renderClock();
    $('reveal').hidden = false; $('btn-reveal').hidden = true;
  });
  function leavePlay() { stopClock(); releaseWakeLock(); $('btn-pause').disabled = false; }
  $('btn-again').addEventListener('click', () => { leavePlay(); newRound(); });
  $('btn-setup').addEventListener('click', () => { leavePlay(); renderSetup(); show('setup'); });
  $('btn-start').addEventListener('click', () => { if (validate()) newRound(); });

  // ---------- Was ist neu ----------
  const news = $('news');
  $('btn-news').addEventListener('click', () => news.showModal());
  news.addEventListener('close', () => store.set(KEY.news, VERSION));

  // ---------- Start ----------
  loadPacks().then(() => {
    renderSetup();
    if (store.get(KEY.news, '') !== VERSION && typeof news.showModal === 'function') news.showModal();
  });
})();

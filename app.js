(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Launcher downloads ---------- */
  async function updateDownloadCount() {
    const count = $('#launcher-download-count');
    const releases = 'https://api.github.com/repos/AnimeOnCraft/animeoncraft.github.io/releases';
    const mirror = 'https://github.com/AnimeOnCraft/animeoncraft.github.io/releases/download/launcher-downloads/';
    const installerName = /^AnimeOnCraft_\d+\.\d+\.\d+_x64-setup\.exe$/;
    const response = await fetch(releases);
    if (!response.ok) return;

    const published = await response.json();
    const release = published.find(item => item.tag_name === 'launcher-downloads');
    if (!Array.isArray(release?.assets)) return;

    const installers = new Map();
    for (const { name, state, download_count: downloads } of release.assets) {
      if (state === 'uploaded' && installerName.test(name) && Number.isSafeInteger(downloads) && downloads >= 0) {
        installers.set(name, downloads);
      }
    }
    if (!installers.size) return;

    const total = [...installers.values()].reduce((sum, downloads) => sum + downloads, Number(count.dataset.baseline));
    count.textContent = `≈${total.toLocaleString('ru-RU')}`;
    for (const link of $$('.mini-download, .hero-actions .cta')) {
      const name = new URL(link.href).pathname.split('/').pop();
      if (installers.has(name)) link.href = mirror + name;
    }
  }
  updateDownloadCount().catch(() => {
    // Keep the estimate and the direct links when GitHub is unavailable.
  });

  /* ---------- Tabs ---------- */
  const VIEWS = ['home', 'map', 'news'];
  let mapReady = false, refreshMap = () => {};
  function show(view) {
    if (!VIEWS.includes(view)) view = 'home';
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== view; });
    $$('.tabs a').forEach(a => { if (a.dataset.tab === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (view === 'map') { if (!mapReady) { mapReady = true; initMap(); } else refreshMap(); }
  }
  const fromHash = () => (location.hash || '#home').slice(1);
  addEventListener('hashchange', () => { show(fromHash()); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); });
  $('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    $('#content').focus();
  });

  /* ---------- News ---------- */
  const NEWS = window.AOC_NEWS || [];
  const fmt = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const list = $('#news-list'), art = $('#news-article');
  function openNews(i) {
    const n = NEWS[i]; if (!n) return;
    $$('button', list).forEach((b, j) => b.setAttribute('aria-current', String(i === j)));
    art.innerHTML = `<div class="nh"><span class="ver">${n.v}</span><time datetime="${n.date}">${fmt(n.date)}</time></div><h3 class="title"></h3><div class="news-body">${n.html}</div>`;
    $('.title', art).textContent = n.title;
    $$('table', art).forEach(t => { const w = document.createElement('div'); w.className = 'tbl'; t.replaceWith(w); w.append(t); });
  }
  NEWS.forEach((n, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.innerHTML = `<span class="nv">${n.v} · ${fmt(n.date)}</span><span class="nt"></span>`;
    $('.nt', b).textContent = n.title; b.addEventListener('click', () => openNews(i));
    li.append(b); list.append(li);
  });
  openNews(0);
  if (NEWS[0]) {
    const { v, title } = NEWS[0];
    $('#teaser-news .t-title').textContent = title.includes(v) ? title : `${v}: ${title}`;
  }

  /* ---------- Map ---------- */
  function initMap() {
    const W = window.AOC_WORLD; if (!W) return;
    const R = W.R, NS = 'http://www.w3.org/2000/svg', svg = $('#map-svg'), frame = $('#map-frame'), card = $('#map-card');
    const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const COLORS = { sora: '#ffffff', res: '#ffd36b', place: '#c9d2e3', event: '#c06bff' };
    const root = el('g'); svg.append(root);
    const defs = el('defs'); const cp = el('clipPath', { id: 'world-clip' }); cp.append(el('circle', { cx: 0, cy: 0, r: R * .995 })); defs.append(cp); svg.append(defs);
    const relief = W.relief || { x0: -R, z0: -R, w: 2 * R, h: 2 * R };
    root.append(el('image', { href: 'assets/relief.webp', x: relief.x0, y: relief.z0, width: relief.w, height: relief.h, 'clip-path': 'url(#world-clip)', preserveAspectRatio: 'none' }));
    root.append(el('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
    const shade = el('circle', { cx: 0, cy: 0, r: R, fill: 'rgba(22,12,43,.38)' }); root.append(shade);
    const lands = el('g', { 'data-layer': 'territories' }); root.append(lands);
    (W.territories || []).forEach(t => { const color = W.clans[t.k], polygon = el('polygon', { points: t.p.map(p => p.join(',')).join(' '), fill: color, 'fill-opacity': .16, stroke: color, 'stroke-opacity': .7, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }); const title = el('title'); title.textContent = t.n; polygon.append(title); lands.append(polygon); });
    const roads = el('g', { 'data-layer': 'roads' }); root.append(roads);
    W.roads.forEach(rd => roads.append(el('polyline', { points: rd.p.map(p => p.join(',')).join(' '), fill: 'none', stroke: rd.s === 'main' ? 'rgba(255,240,225,.85)' : 'rgba(255,240,225,.5)', 'stroke-width': rd.s === 'main' ? 2.4 : 1.4, 'stroke-dasharray': rd.s === 'cross' ? '4 4' : '', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' })));
    const layers = {}; ['res', 'place', 'event', 'clan', 'sora'].forEach(k => { layers[k] = el('g', { 'data-layer': k }); root.append(layers[k]); });
    const pois = W.points.map(p => {
      const col = p.k ? W.clans[p.k] : COLORS[p.c];
      const big = p.t.startsWith('Столица') || p.c === 'sora' && p.x === 0 && p.z === 0;
      const g = el('g', { class: 'poi', tabindex: 0, role: 'button', 'aria-label': `${p.n}, ${p.t}` });
      const halo = el('circle', { fill: col, opacity: .28 }), dot = el('circle', { fill: col, stroke: '#140a26', 'vector-effect': 'non-scaling-stroke', 'stroke-width': 2 });
      g.append(halo, dot);
      let label = null;
      if (big) { label = el('text', { class: 'poi-label', 'text-anchor': 'middle' }); label.textContent = p.n.replace('Сора — столица Одного Неба', 'Сора').replace('Столица ', ''); g.append(label); }
      layers[p.c].append(g);
      const pick = () => { card.hidden = false; $('.mc-type', card).textContent = p.t; $('.mc-name', card).textContent = p.n; $('.mc-xz', card).textContent = `X ${p.x}, Z ${p.z}`; };
      g.addEventListener('pointerenter', pick); g.addEventListener('focus', pick); g.addEventListener('click', e => { e.stopPropagation(); pick(); });
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
      return { p, g, halo, dot, label, big };
    });
    // Sora is drawn on top of its own ring; nudge the guild and the gate apart a little in screen space when zoomed out.
    const legend = $('#map-legend');
    legend.innerHTML = Object.entries(W.clans).map(([k, c]) => `<span><i class="dot" style="background:${c}"></i>${(W.names && W.names[k]) || k}</span>`).join('');

    let view = { x: -R, y: -R, w: 2 * R }, home;
    function fit() { const b = frame.getBoundingClientRect(); if (!b.width) return; const aspect = b.height / b.width, w = 2 * R * 1.04 * Math.max(1, 1 / aspect); home = { x: -w / 2, y: -w * aspect / 2, w }; }
    function apply() {
      const b0 = frame.getBoundingClientRect(); if (!b0.width || !home) return;
      const b = b0, aspect = b.height / b.width, h = view.w * aspect;
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${h}`);
      const u = view.w / b.width; // world units per screen pixel
      pois.forEach(o => {
        const s = o.big ? 7 : 4.5; o.dot.setAttribute('cx', o.p.x); o.dot.setAttribute('cy', o.p.z); o.dot.setAttribute('r', s * u);
        o.halo.setAttribute('cx', o.p.x); o.halo.setAttribute('cy', o.p.z); o.halo.setAttribute('r', s * 2.1 * u);
        if (o.label) { o.label.setAttribute('x', o.p.x); o.label.setAttribute('y', o.p.z - 13 * u); o.label.setAttribute('font-size', 13 * u); o.label.style.strokeWidth = 4 * u; }
      });
      // show the guild and the gate labels only when Sora is close enough to tell them apart
      const close = u < 3;
      pois.forEach(o => { if (!o.label && close && !o.lab2 && o.p.c === 'sora') { o.lab2 = el('text', { class: 'poi-label', 'text-anchor': 'middle' }); o.lab2.textContent = o.p.n; o.g.append(o.lab2); }
        if (o.lab2) { o.lab2.style.display = close ? '' : 'none'; o.lab2.setAttribute('x', o.p.x); o.lab2.setAttribute('y', o.p.z + 22 * u); o.lab2.setAttribute('font-size', 12 * u); o.lab2.style.strokeWidth = 4 * u; } });
    }
    function zoom(f, cx, cy) {
      const b = frame.getBoundingClientRect(); cx ??= b.width / 2; cy ??= b.height / 2;
      const u = view.w / b.width, wx = view.x + cx * u, wy = view.y + cy * u;
      const nw = Math.min(Math.max(view.w * f, 260), home.w * 1.2);
      const nu = nw / b.width; view = { x: wx - cx * nu, y: wy - cy * nu, w: nw }; apply();
    }
    fit(); if (home) view = { ...home }; apply();
    addEventListener('resize', () => { fit(); apply(); });
    refreshMap = () => { fit(); if (!view.w || view.w > home.w * 1.2) view = { ...home }; apply(); };
    frame.addEventListener('wheel', e => { e.preventDefault(); const b = frame.getBoundingClientRect(); zoom(Math.exp(e.deltaY * .0015), e.clientX - b.left, e.clientY - b.top); }, { passive: false });
    const ptrs = new Map(); let pinch = 0;
    frame.addEventListener('pointerdown', e => { if (e.target.closest('.map-zoom')) return; e.target.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); frame.classList.add('drag'); });
    frame.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return; const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const b = frame.getBoundingClientRect(), u = view.w / b.width;
      if (ptrs.size === 1) { view.x -= (e.clientX - prev.x) * u; view.y -= (e.clientY - prev.y) * u; apply(); }
      else if (ptrs.size === 2) { const [a, c] = [...ptrs.values()], d = Math.hypot(a.x - c.x, a.y - c.y); if (pinch) zoom(pinch / d, (a.x + c.x) / 2 - b.left, (a.y + c.y) / 2 - b.top); pinch = d; }
    });
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (!ptrs.size) frame.classList.remove('drag'); };
    frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
    $('#zoom-in').addEventListener('click', () => zoom(.6)); $('#zoom-out').addEventListener('click', () => zoom(1 / .6));
    $('#zoom-home').addEventListener('click', () => { view = { ...home }; apply(); });
    $$('.map-filters .pill').forEach(b => b.addEventListener('click', () => {
      const on = !b.classList.contains('on'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
      const g = $(`[data-layer="${b.dataset.layer}"]`, svg); if (g) g.style.display = on ? '' : 'none';
      if (b.dataset.layer === 'clan') lands.style.display = on ? '' : 'none';
    }));
    // start with Sora's neighbourhood readable: open on the whole world but show Sora's card
    const sora = pois.find(o => o.p.c === 'sora'); if (sora) { card.hidden = false; $('.mc-type', card).textContent = sora.p.t; $('.mc-name', card).textContent = sora.p.n; $('.mc-xz', card).textContent = 'X 0, Z 0'; }
  }

  show(fromHash());
})();

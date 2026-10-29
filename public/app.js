(() => {
'use strict';

/* ---------- konstanter ---------- */
const GREEN = '#009933';
const SIZES = {
  '45':  { w:1080, h:1350, label:'4:5 feed' },
  '11':  { w:1080, h:1080, label:'1:1' },
  '916': { w:1080, h:1920, label:'9:16 story' }
};
const TPL = {
  headline: { label:'Headline v1', photo:true },
  article:  { label:'Article Text', photo:true },
  cta:      { label:'CTA-slide' },
  quote1:   { label:'Quote v1', photo:true },
  quote2:   { label:'Quote v2', photo:true },
  tlHead:   { label:'Top list headline', photo:true },
  tlSlide:  { label:'Top list slide', photo:true },
  tr1:      { label:'Transfer Template v1', photo:true, cutout:true, bgword:true },
  tr2:      { label:'Transfer Template v2', photo:true, logos:true },
  tr3:      { label:'Transfer Template v3', photo:true, cutout:true, bgword:true, logos:true }
};
const FORMATS = [
  { id:'std',   group:'Artikel-historier', name:'Standardhistorie', slides:[['headline'],['article'],['cta',{text:'Læs hele historien på Tipsbladet.dk'}]] },
  { id:'debat', group:'Artikel-historier', name:'Debat-historie',   slides:[['headline'],['article'],['cta',{text:'Hvad mener du?'}]] },
  { id:'citat', group:'Citathistorier',    name:'Citat i fokus',    slides:[['quote1'],['article'],['quote2']] },
  { id:'hist',  group:'Citathistorier',    name:'Historie i fokus', slides:[['headline'],['article'],['quote2']] },
  { id:'liste', group:'Karruseller',       name:'Listeformat',      slides:[['tlHead'],['tlSlide']] },
  { id:'afsl',  group:'Transfers',         name:'Afsløring',        slides:[['tr1'],['article']] },
  { id:'rygte', group:'Transfers',         name:'Nyhed/rygte',      slides:[['tr2'],['article']] },
  { id:'break', group:'Transfers',         name:'Breaking',         slides:[['tr3'],['article']] }
];
const DEF = {
  headline:{ text:'Skriv overskriften her:\n*Anden linje i grøn*', fs:84, badge:true },
  article: { text:'Skriv brødteksten her. Teksten ombrydes automatisk og bliver mindre, hvis der er for meget.', fs:44 },
  cta:     { text:'Skriv teaser eller spørgsmål her', fs:78 },
  quote1:  { text:'Skriv citatet her', name:'Navn Efternavn', source:'Til kilde', fs:60 },
  quote2:  { text:'-  Skriv citatet her', attr:'Siger Navn Efternavn til Kilde', fs:46 },
  tlHead:  { text:'*Vælg* _din_ *Danmark-XI:*\n*Angrebskæde*', fs:84, badge:true, chev:true },
  tlSlide: { text:'Spillerens navn', fs:96 },
  tr1:     { text:'*Afsløring: Klub* _gør noget_ *Spiller*', fs:84, badge:true, bgword:'AFSLØRING', dim:30 },
  tr2:     { text:'*Klub* Overvejer\n*Spillernavn*', fs:84, badge:true },
  tr3:     { text:'*Breaking: Klub* _henter_ *Spiller*', fs:84, badge:true, bgword:'BREAKING', dim:30, glow:true }
};

/* ---------- tilstand ---------- */
const imgs = { icon:null, white:null };
const builtin = { icon:null, iconWhite:null, white:null };
const ICON_GREEN_SRC = 'assets/ikon-groen.png';
const ICON_WHITE_SRC = 'assets/ikon-hvid.png';
const lib = [];
const cache = {};
let sizeKey = '45';
let fmt = FORMATS[0];
let slides = [];
let pickerRenders = [];
const cardEls = [];
const supportsFilter = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

const uid = () => Math.random().toString(36).slice(2, 10);
const isImg = f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|svg|gif)$/i.test(f.name);
const fmtN = v => String(Math.round(v * 100) / 100);

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}
const $ = id => document.getElementById(id);

let toastT = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- lager (IndexedDB) ---------- */
const idb = {
  db:null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open('tb-some-studie', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.db;
  },
  async get(k) {
    try {
      const db = await this.open();
      return await new Promise((res, rej) => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
      });
    } catch { return undefined; }
  },
  async set(k, v) {
    try {
      const db = await this.open();
      await new Promise((res, rej) => {
        const t = db.transaction('kv', 'readwrite');
        t.objectStore('kv').put(v, k);
        t.oncomplete = res; t.onerror = () => rej(t.error);
      });
    } catch { /* lager er ikke tilgængeligt */ }
  },
  async del(k) {
    try {
      const db = await this.open();
      await new Promise((res, rej) => {
        const t = db.transaction('kv', 'readwrite');
        t.objectStore('kv').delete(k);
        t.oncomplete = res; t.onerror = () => rej(t.error);
      });
    } catch { /* ingen handling */ }
  }
};
const persistLib = () => idb.set('library', lib.filter(l => !l.builtin).map(({ id, name, src }) => ({ id, name, src })));

/* ---------- billeder ---------- */
const readDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Billedet kunne ikke læses')); i.src = src; });

async function shrink(file, max = 700) {
  const raw = await readDataURL(file);
  const img = await loadImg(raw);
  const w = img.naturalWidth || 600, hh = img.naturalHeight || 600;
  const isSvg = /svg/.test(file.type) || /\.svg$/i.test(file.name);
  const k = isSvg ? max / Math.max(w, hh) : Math.min(1, max / Math.max(w, hh));
  if (!isSvg && k === 1 && /png/.test(file.type)) return raw;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(hh * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
const pretty = n => n.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- tekst-hjælpere ---------- */
function parseRich(str) {
  const lines = [];
  for (const raw of String(str).split('\n')) {
    const toks = [];
    let green = false, reg = false, cur = '', pend = false;
    const push = () => { if (cur) { toks.push({ t:cur, g:green, r:reg, sp:pend }); cur = ''; pend = false; } };
    for (const ch of raw) {
      if (ch === '*') { push(); green = !green; }
      else if (ch === '_') { push(); reg = !reg; }
      else if (ch === ' ') { push(); pend = true; }
      else cur += ch;
    }
    push();
    lines.push(toks);
  }
  return lines;
}
const fontFor = (tk, fs) => `${tk.r ? 400 : 700} ${fs}px "Barlow Condensed","Arial Narrow",sans-serif`;
const txtFor = tk => tk.r ? tk.t : tk.t.toUpperCase();

function layoutRich(ctx, lines, fs, maxW) {
  const out = [];
  for (const toks of lines) {
    let cur = [], w = 0;
    for (const tk of toks) {
      ctx.font = fontFor(tk, fs);
      const tw = ctx.measureText(txtFor(tk)).width;
      const spw = (tk.sp && cur.length) ? ctx.measureText(' ').width * 0.95 : 0;
      if (cur.length && w + spw + tw > maxW) { out.push({ toks:cur, w }); cur = []; w = 0; }
      const sp = (tk.sp && cur.length) ? spw : 0;
      cur.push({ tk, tw, sp }); w += sp + tw;
    }
    out.push({ toks:cur, w });
  }
  return out;
}
function drawRich(ctx, L, cx, lastBase, lh, fs, opt = {}) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  L.forEach((line, k) => {
    const y = lastBase - (L.length - 1 - k) * lh;
    let x = cx - line.w / 2;
    for (const it of line.toks) {
      x += it.sp;
      ctx.font = fontFor(it.tk, fs);
      ctx.fillStyle = it.tk.g ? (opt.green || GREEN) : '#fff';
      ctx.fillText(txtFor(it.tk), x, y);
      x += it.tw;
    }
  });
}
function wrapPlain(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    const atoms = [];
    para.split(/\s+/).filter(Boolean).forEach(w => {
      w.split(/(?<=-)(?=[^-])/).forEach((part, k) => atoms.push({ t:part, join:k > 0 }));
    });
    let line = '';
    for (const a of atoms) {
      const test = line ? line + (a.join ? '' : ' ') + a.t : a.t;
      if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = a.t; }
      else line = test;
    }
    lines.push(line);
  }
  return lines;
}

/* ---------- tegne-hjælpere ---------- */
const bm = b => sizeKey === '916' ? b + 190 : sizeKey === '11' ? Math.max(b - 50, 60) : b;
const topSafe = () => sizeKey === '916' ? 150 : 0;

function drawCover(ctx, img, x, y, w, hh, zoom, ox, oy) {
  const s = Math.max(w / img.width, hh / img.height) * zoom;
  const iw = img.width * s, ih = img.height * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2 + ox, y + (hh - ih) / 2 + oy, iw, ih);
  ctx.restore();
}
function bgPhoto(ctx, s, W, H, p) {
  if (!p) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a342e'); g.addColorStop(1, '#0c110e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 44px "Barlow Condensed",sans-serif';
    ctx.fillText('Tilføj billede', W / 2, H * 0.4);
    return;
  }
  drawCover(ctx, p.img, 0, 0, W, H, s.zoom, s.ox, s.oy);
}
function fade(ctx, W, H, y0, y1) {
  y0 = Math.max(0, y0);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, 'rgba(0,0,0,.72)'); g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
}
function drawIcon(ctx, cx, cy, r) {
  const im = imgs.icon || builtin.icon;
  if (im) {
    const a = im.width / im.height;
    ctx.drawImage(im, cx - r * a, cy - r, 2 * r * a, 2 * r); return;
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = GREEN; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - r * .64, cy - r * .5, r * 1.28, r * .34);
  ctx.fillRect(cx - r * .17, cy - r * .5, r * .34, r * 1.6);
  ctx.restore();
}
function badge(ctx, s) { if (s.badge) drawIcon(ctx, 72, 72 + topSafe(), 35); }
function drawWhiteLogo(ctx, cx, cy) {
  const wl = imgs.white || builtin.white;
  if (wl) {
    const w = 208, hh = w * wl.height / wl.width;
    ctx.drawImage(wl, cx - w / 2, cy - hh / 2, w, hh); return;
  }
  const r = 22.5, gap = 10;
  ctx.font = '700 40px "Barlow Condensed",sans-serif';
  const fs = 40 * (208 - 2 * r - gap) / ctx.measureText('Tipsbladet').width;
  ctx.font = `700 ${fs}px "Barlow Condensed",sans-serif`;
  let x = cx - 104;
  if (builtin.iconWhite) ctx.drawImage(builtin.iconWhite, x, cy - r, 2 * r, 2 * r);
  else {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(x + r - r * .64, cy - r * .5, r * 1.28, r * .34);
    ctx.fillRect(x + r - r * .17, cy - r * .5, r * .34, r * 1.45);
  }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('Tipsbladet', x + 2 * r + gap, cy + 2);
  ctx.textBaseline = 'alphabetic';
}
function drawChevrons(ctx, cx, cy) {
  const n = 5, step = 27, w = 30, hh = 19;
  const c0 = [0, 153, 51], c1 = [220, 247, 228];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const col = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
    const x = cx - (n * step) / 2 + i * step;
    ctx.fillStyle = `rgb(${col})`;
    ctx.beginPath();
    ctx.moveTo(x, cy - hh); ctx.lineTo(x + 14, cy - hh); ctx.lineTo(x + w, cy);
    ctx.lineTo(x + 14, cy + hh); ctx.lineTo(x, cy + hh); ctx.lineTo(x + 16, cy);
    ctx.closePath(); ctx.fill();
  }
}
function bgRows(ctx, word, W, H) {
  if (!word) return;
  const fs = 80, rowTop = 258 + (sizeKey === '916' ? 140 : sizeKey === '11' ? -28 : 0), pitch = 88;
  const rows = Math.max(3, Math.round((H * 0.63 - rowTop) / pitch) + 1);
  ctx.font = `700 ${fs}px Montserrat,"Barlow Condensed",sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const ww = ctx.measureText(word).width, gap = 52;
  for (let k = 0; k < rows; k++) {
    const a = (k % 2 === 0 ? .85 : .5) * Math.max(.12, 1 - (k / rows) * .95);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (let x = 55; x < W; x += ww + gap) ctx.fillText(word, x, rowTop + k * pitch);
  }
}
function drawCutout(ctx, s, W, H) {
  if (!s.cutout) return;
  const im = s.cutout.img, sc = (H * 0.82 / im.height) * s.cz;
  const iw = im.width * sc, ih = im.height * sc;
  ctx.drawImage(im, (W - iw) / 2 + s.cx, H * 0.86 - ih + s.cy, iw, ih);
}
function drawLogos(ctx, s, W, cy) {
  const items = s.logos.map(id => lib.find(l => l.id === id)).filter(Boolean);
  if (!items.length) return;
  cy += s.ly;
  ctx.fillStyle = '#fff'; ctx.fillRect(70, cy - 1.5, W - 140, 3);
  const gap = 50, n = items.length;
  const box = Math.min(250 * s.lz, ((W - 200) - gap * (n - 1)) / n);
  const sized = items.map(l => { const k = Math.min(box / l.img.width, box * .92 / l.img.height); return { l, w:l.img.width * k, hh:l.img.height * k }; });
  const total = sized.reduce((a, b) => a + b.w, 0) + gap * (n - 1);
  let x = (W - total) / 2 + s.lx;
  ctx.save();
  if (s.glow) { ctx.shadowColor = 'rgba(255,255,255,.95)'; ctx.shadowBlur = 46; }
  for (const it of sized) {
    ctx.drawImage(it.l.img, x, cy - it.hh / 2, it.w, it.hh);
    if (s.glow) ctx.drawImage(it.l.img, x, cy - it.hh / 2, it.w, it.hh);
    x += it.w + gap;
  }
  ctx.restore();
}
function drawTransferBg(ctx, s, W, H, p) {
  if (supportsFilter && s.blur > 0 && p) {
    const pad = s.blur * 3;
    ctx.save(); ctx.filter = `blur(${s.blur}px)`;
    drawCover(ctx, p.img, -pad, -pad, W + 2 * pad, H + 2 * pad, s.zoom, s.ox, s.oy);
    ctx.restore();
  } else bgPhoto(ctx, s, W, H, p);
  if (s.dim > 0) { ctx.fillStyle = `rgba(0,0,0,${s.dim / 100})`; ctx.fillRect(0, 0, W, H); }
}
function headlineBlock(ctx, s, W, H, margin) {
  const tb = H - bm(margin);
  const L = layoutRich(ctx, parseRich(s.text), s.fs, W - 120);
  const lh = s.fs * 1.04;
  const first = tb - (L.length - 1) * lh;
  return { tb, L, lh, first };
}

/* ---------- skabeloner ---------- */
const R = {};
R.headline = (ctx, s, W, H, p) => {
  bgPhoto(ctx, s, W, H, p);
  const b = headlineBlock(ctx, s, W, H, 230);
  fade(ctx, W, H, b.first - s.fs * .7 - 260, b.tb + 70);
  drawRich(ctx, b.L, W / 2, b.tb, b.lh, s.fs);
  badge(ctx, s);
};
R.article = (ctx, s, W, H, p) => {
  bgPhoto(ctx, s, W, H, p);
  const last = H - bm(115);
  let fs = s.fs, lines;
  for (;;) {
    ctx.font = `400 ${fs}px "Barlow Condensed",sans-serif`;
    lines = wrapPlain(ctx, s.text, W - 180);
    if (lines.length * fs * 1.12 < H * .46 || fs <= 22) break;
    fs -= 2;
  }
  const lh = fs * 1.12, first = last - (lines.length - 1) * lh;
  fade(ctx, W, H, first - fs - 170, last + 25);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${fs}px "Barlow Condensed",sans-serif`;
  lines.forEach((l, k) => ctx.fillText(l, W / 2, first + k * lh));
};
R.cta = (ctx, s, W, H) => {
  /* mål taget direkte på den originale CTA-slide (4:5) */
  const g = ctx.createLinearGradient(0, 0, 0, H);
  [[0,[0,129,43]],[.2,[1,89,28]],[.4,[1,58,18]],[.5,[0,44,13]],[.6,[1,28,9]],[.667,[0,17,5]],[.733,[0,7,2]],[.8,[0,0,0]]]
    .forEach(([t, c]) => g.addColorStop(t, `rgb(${c})`));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const ax = 195, ay = -420, dy = H - ay;
  const rg = ctx.createLinearGradient(0, 0, 0, 1350);
  rg.addColorStop(0, 'rgba(255,255,255,.05)'); rg.addColorStop(.55, 'rgba(255,255,255,.025)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  [[-0.03, 0.20], [0.59, 0.90], [1.30, 1.53]].forEach(([t0, t1]) => {
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.lineTo(ax + t0 * dy, H); ctx.lineTo(ax + t1 * dy, H);
    ctx.closePath(); ctx.fill();
  });
  const L = layoutRich(ctx, parseRich(s.text.replace(/[*_]/g, '')), s.fs, W - 180);
  const lh = s.fs * 1.05;
  const last = H * .4911 + ((L.length - 1) * lh) / 2;
  drawRich(ctx, L, W / 2 + 16, last, lh, s.fs);
  drawWhiteLogo(ctx, W / 2, H - bm(101));
};
R.quote1 = (ctx, s, W, H, p) => {
  bgPhoto(ctx, s, W, H, p);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,.97)'); g.addColorStop(.35, 'rgba(0,0,0,.85)');
  g.addColorStop(.6, 'rgba(0,0,0,.35)'); g.addColorStop(.85, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const x = 92, top = topSafe();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = '700 260px "Barlow Condensed",sans-serif';
  ctx.fillText('\u201C\u201D', x - 6, 300 + top);
  let fs = s.fs, lines, first, lh, k;
  for (;;) {
    ctx.font = `700 ${fs}px "Barlow Condensed",sans-serif`;
    lines = wrapPlain(ctx, s.text, 570);
    lh = fs * 1.15; k = fs / 60; first = 268 + top;
    const bottom = first + (lines.length - 1) * lh + 138 * k;
    if (bottom < H - 110 || fs <= 24) break;
    fs -= 2;
  }
  ctx.font = `700 ${fs}px "Barlow Condensed",sans-serif`; ctx.fillStyle = '#fff';
  lines.forEach((l, i) => ctx.fillText(l, x, first + i * lh));
  const last = first + (lines.length - 1) * lh;
  const nameY = last + 85 * k, srcY = nameY + 53 * k;
  ctx.fillStyle = GREEN;
  ctx.font = `700 ${fs * .77}px "Barlow Condensed",sans-serif`;
  ctx.fillText(s.name.toUpperCase(), x, nameY);
  ctx.font = `italic 400 ${fs * .77}px "Barlow Condensed",sans-serif`;
  ctx.fillText(s.source, x, srcY);
};
R.quote2 = (ctx, s, W, H, p) => {
  bgPhoto(ctx, s, W, H, p);
  const attrB = H - bm(78), fs = s.fs;
  ctx.font = `400 ${fs}px "Barlow Condensed",sans-serif`;
  const lines = wrapPlain(ctx, s.text, W - 170);
  const lh = fs * 1.07, lastB = attrB - 108, first = lastB - (lines.length - 1) * lh;
  fade(ctx, W, H, first - 260, lastB + 28);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, first + i * lh));
  let af = fs * 50 / 46;
  const at = s.attr.toUpperCase();
  for (;;) {
    ctx.font = `italic 700 ${af}px "Barlow Condensed",sans-serif`;
    if (ctx.measureText(at).width < W - 120 || af < 24) break;
    af -= 2;
  }
  ctx.fillText(at, W / 2, attrB);
};
R.tlHead = (ctx, s, W, H, p) => {
  bgPhoto(ctx, s, W, H, p);
  const b = headlineBlock(ctx, s, W, H, 185);
  fade(ctx, W, H, b.first - s.fs * .7 - 260, b.tb + 70);
  drawRich(ctx, b.L, W / 2, b.tb, b.lh, s.fs);
  if (s.chev) drawChevrons(ctx, W / 2, H - bm(95));
  badge(ctx, s);
};
R.tlSlide = (ctx, s, W, H, p) => {
  bgPhoto(ctx, s, W, H, p);
  const base = H - bm(85);
  fade(ctx, W, H, base - 400, base - 75);
  let fs = s.fs; const t = s.text.toUpperCase();
  for (;;) {
    ctx.font = `700 ${fs}px "Barlow Condensed",sans-serif`;
    if (ctx.measureText(t).width < W - 120 || fs < 30) break;
    fs -= 2;
  }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, W / 2, base);
};
function transfer(ctx, s, W, H, p, withCutout, withLogos) {
  drawTransferBg(ctx, s, W, H, p);
  if (withCutout) { bgRows(ctx, s.bgword, W, H); drawCutout(ctx, s, W, H); }
  const b = headlineBlock(ctx, s, W, H, 230);
  fade(ctx, W, H, b.first - s.fs * .7 - 260, b.tb + 70);
  if (withLogos) drawLogos(ctx, s, W, b.first - s.fs * .7 - 150);
  drawRich(ctx, b.L, W / 2, b.tb, b.lh, s.fs);
  badge(ctx, s);
}
R.tr1 = (ctx, s, W, H, p) => transfer(ctx, s, W, H, p, true, false);
R.tr2 = (ctx, s, W, H, p) => transfer(ctx, s, W, H, p, false, true);
R.tr3 = (ctx, s, W, H, p) => transfer(ctx, s, W, H, p, true, true);

/* ---------- tilstand for slides ---------- */
function mkSlide(tpl, over = {}) {
  return Object.assign({
    tpl, text:'', name:'', source:'', attr:'', fs:60,
    photo:null, usePrev:false, zoom:1, ox:0, oy:0,
    cutout:null, cz:1, cx:0, cy:0,
    logos:[], lz:1, lx:0, ly:0, glow:false,
    bgword:'', dim:30, blur:0, chev:false, badge:false, drag:'photo'
  }, DEF[tpl], over);
}
function getSlides(f) {
  if (!cache[f.id]) {
    cache[f.id] = f.slides.map(([t, o], i) => mkSlide(t, { ...(o || {}), usePrev: i > 0 && !!TPL[t].photo && t !== 'tlSlide' }));
  }
  return cache[f.id];
}
function photoOf(list, i) {
  const s = list[i];
  if (!TPL[s.tpl].photo) return null;
  if (s.usePrev) {
    for (let j = i - 1; j >= 0; j--) {
      if (TPL[list[j].tpl].photo) { const p = photoOf(list, j); if (p) return p; }
    }
  }
  return s.photo;
}

/* ---------- tegning ---------- */
const dirty = new Set(); let raf = 0;
function draw(i) {
  dirty.add(i);
  if (!raf) raf = requestAnimationFrame(() => {
    raf = 0;
    for (const k of dirty) paint(k);
    dirty.clear();
  });
}
const drawAll = () => slides.forEach((_, i) => draw(i));
function paint(i) {
  const s = slides[i]; if (!s || !s._c) return;
  const { w:W, h:H } = SIZES[sizeKey], c = s._c;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  R[s.tpl](ctx, s, W, H, photoOf(slides, i));
}

/* ---------- kort (kontroller pr. slide) ---------- */
function slider(label, min, max, step, val, on) {
  const out = h('output', { text:fmtN(val) });
  const inp = h('input', { type:'range', min, max, step, value:val, oninput:e => { const v = +e.target.value; out.textContent = fmtN(v); on(v); } });
  return h('label', { class:'ctl' }, h('span', { class:'lab' }, label, out), inp);
}
function fileBtn(label, accept, onfile) {
  const inp = h('input', { type:'file', accept, class:'hid' });
  inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (f) { try { await onfile(f); } catch (e) { toast('Filen kunne ikke læses'); } }
    inp.value = '';
  });
  return h('label', { class:'btn small' }, label, inp);
}
function textField(label, val, on, rows) {
  const el = rows
    ? h('textarea', { rows, value:val, oninput:e => on(e.target.value) })
    : h('input', { type:'text', value:val, oninput:e => on(e.target.value) });
  return h('label', { class:'ctl' }, h('span', { class:'lab' }, label), el);
}
function checkbox(label, val, on) {
  return h('label', { class:'chk' }, h('input', { type:'checkbox', checked:val, onchange:e => on(e.target.checked) }), label);
}
function refreshCard(i) {
  const el = buildCard(i);
  cardEls[i].replaceWith(el); cardEls[i] = el;
  drawAll();
}
function logoPicker(i) {
  const s = slides[i];
  const grid = h('div', { class:'lgrid' });
  const sum = h('summary');
  const det = h('details', { class:'picker' }, sum, grid);
  const render = () => {
    sum.textContent = `Klublogoer (${s.logos.filter(id => lib.some(l => l.id === id)).length})`;
    grid.replaceChildren();
    if (!lib.length) { grid.append(h('p', { class:'empty', text:'Ingen logoer endnu. Læg dem i biblioteket øverst på siden.' })); return; }
    lib.forEach(l => {
      grid.append(h('button', {
        type:'button', class:'lg' + (s.logos.includes(l.id) ? ' on' : ''), title:l.name,
        onclick:() => { const k = s.logos.indexOf(l.id); if (k >= 0) s.logos.splice(k, 1); else s.logos.push(l.id); render(); draw(i); }
      }, h('img', { src:l.src, alt:l.name }), h('span', { text:l.name })));
    });
  };
  render(); pickerRenders.push(render);
  return det;
}
function dragTarget(s) {
  if (s.drag === 'cutout' && s.cutout) return 'cutout';
  if (s.drag === 'logo' && s.logos.length) return 'logo';
  return 'photo';
}
function attachDrag(c, i) {
  let on = false, lx = 0, ly = 0;
  c.addEventListener('pointerdown', e => { on = true; lx = e.clientX; ly = e.clientY; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => {
    if (!on) return;
    const k = c.width / c.getBoundingClientRect().width;
    const dx = (e.clientX - lx) * k, dy = (e.clientY - ly) * k;
    lx = e.clientX; ly = e.clientY;
    const s = slides[i], t = dragTarget(s);
    if (t === 'cutout') { s.cx += dx; s.cy += dy; }
    else if (t === 'logo') { s.lx += dx; s.ly += dy; }
    else { s.ox += dx; s.oy += dy; }
    draw(i);
  });
  ['pointerup', 'pointercancel'].forEach(ev => c.addEventListener(ev, () => { on = false; }));
}
function slugify(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function buildCard(i) {
  const s = slides[i], T = TPL[s.tpl], dim = SIZES[sizeKey];
  const c = h('canvas', { class:'cv', width:dim.w, height:dim.h, 'aria-label':`Forhåndsvisning af slide ${i + 1}` });
  s._c = c; attachDrag(c, i);
  const ctl = [];
  const rich = ['headline', 'cta', 'tlHead', 'tr1', 'tr2', 'tr3'].includes(s.tpl);

  /* tekst */
  if (s.tpl === 'quote1') {
    ctl.push(textField('Citat', s.text, v => { s.text = v; draw(i); }, 4));
    ctl.push(textField('Navn', s.name, v => { s.name = v; draw(i); }));
    ctl.push(textField('Kilde (fx “Til TV 2”)', s.source, v => { s.source = v; draw(i); }));
  } else if (s.tpl === 'quote2') {
    ctl.push(textField('Citat', s.text, v => { s.text = v; draw(i); }, 3));
    ctl.push(textField('Afsender (fx “Siger … til …”)', s.attr, v => { s.attr = v; draw(i); }));
  } else if (s.tpl === 'tlSlide') {
    ctl.push(textField('Navn', s.text, v => { s.text = v; draw(i); }));
  } else if (s.tpl === 'article') {
    ctl.push(textField('Brødtekst', s.text, v => { s.text = v; draw(i); }, 5));
    ctl.push(slider('Tekststørrelse', 28, 64, 1, s.fs, v => { s.fs = v; draw(i); }));
  } else {
    ctl.push(textField('Tekst', s.text, v => { s.text = v; draw(i); }, 3));
    if (s.tpl !== 'cta') ctl.push(h('p', { class:'hint', text:'*tekst* giver grøn fed tekst. _tekst_ giver lille hvid tekst. Linjeskift med Enter.' }));
    ctl.push(slider('Tekststørrelse', 40, 130, 1, s.fs, v => { s.fs = v; draw(i); }));
  }
  if (s.tpl === 'tlHead') ctl.push(checkbox('Vis pile nederst', s.chev, v => { s.chev = v; draw(i); }));
  if (TPL[s.tpl].bgword) ctl.push(textField('Gentaget baggrundsord', s.bgword, v => { s.bgword = v.toUpperCase(); draw(i); }));
  if (['headline', 'tlHead', 'tr1', 'tr2', 'tr3'].includes(s.tpl)) ctl.push(checkbox('Vis Tipsbladet-ikon øverst til venstre', s.badge, v => { s.badge = v; draw(i); }));

  /* billede */
  if (T.photo) {
    ctl.push(h('div', { class:'sub', text:T.cutout || T.logos ? 'Baggrundsfoto' : 'Billede' }));
    const canShare = i > 0 && s.tpl !== 'tlSlide' && slides.slice(0, i).some(x => TPL[x.tpl].photo);
    if (canShare) ctl.push(checkbox('Brug samme billede som forrige slide', s.usePrev, v => { s.usePrev = v; draw(i); }));
    const nameEl = h('span', { class:'fname', text:s.photo ? s.photo.name : 'Intet billede valgt' });
    ctl.push(h('div', { class:'line' },
      fileBtn('Vælg billede', 'image/*', async f => {
        const img = await loadImg(URL.createObjectURL(f));
        s.photo = { img, name:f.name }; s.usePrev = false; s.ox = 0; s.oy = 0; s.zoom = 1;
        refreshCard(i);
      }),
      nameEl,
      h('button', { type:'button', class:'btn small', onclick:() => { s.ox = 0; s.oy = 0; s.zoom = 1; refreshCard(i); } }, 'Centrér')));
    ctl.push(slider('Zoom', 1, 3, .01, s.zoom, v => { s.zoom = v; draw(i); }));
    if (T.cutout || T.logos) {
      ctl.push(slider('Mørkere baggrund', 0, 80, 1, s.dim, v => { s.dim = v; draw(i); }));
      if (supportsFilter && T.cutout) ctl.push(slider('Sløring af baggrund', 0, 30, 1, s.blur, v => { s.blur = v; draw(i); }));
    }
  }
  if (T.cutout) {
    ctl.push(h('div', { class:'sub', text:'Fritlagt spiller' }));
    ctl.push(h('div', { class:'line' },
      fileBtn('Vælg PNG', 'image/png,image/webp', async f => {
        const img = await loadImg(URL.createObjectURL(f));
        s.cutout = { img, name:f.name }; s.drag = 'cutout'; refreshCard(i);
      }),
      h('span', { class:'fname', text:s.cutout ? s.cutout.name : 'Ingen fritlagt spiller (valgfri)' }),
      s.cutout ? h('button', { type:'button', class:'btn small', onclick:() => { s.cutout = null; s.drag = 'photo'; refreshCard(i); } }, 'Fjern') : null));
    ctl.push(slider('Størrelse på spiller', .4, 2, .01, s.cz, v => { s.cz = v; draw(i); }));
  }
  if (T.logos) {
    ctl.push(h('div', { class:'sub', text:'Klublogo' }));
    ctl.push(logoPicker(i));
    ctl.push(slider('Logostørrelse', .4, 1.6, .01, s.lz, v => { s.lz = v; draw(i); }));
    ctl.push(checkbox('Hvid glød bag logo', s.glow, v => { s.glow = v; draw(i); }));
  }
  if (T.cutout || T.logos) {
    const opts = [['photo', 'Baggrund'], ['cutout', 'Spiller'], ['logo', 'Logo']].filter(o => o[0] === 'photo' || (o[0] === 'cutout' && T.cutout) || (o[0] === 'logo' && T.logos));
    const seg = h('div', { class:'seg', role:'group', 'aria-label':'Hvad skal flyttes, når du trækker i billedet' });
    const paintSeg = () => [...seg.children].forEach((b, k) => b.setAttribute('aria-pressed', String(s.drag === opts[k][0])));
    opts.forEach(o => seg.append(h('button', { type:'button', onclick:() => { s.drag = o[0]; paintSeg(); } }, o[1])));
    paintSeg();
    ctl.push(h('div', { class:'ctl' }, h('span', { class:'lab', text:'Træk i billedet for at flytte' }), seg));
  } else if (T.photo) {
    ctl.push(h('p', { class:'hint', text:'Træk i billedet for at flytte motivet.' }));
  }

  const removable = s.tpl === 'tlSlide' && slides.filter(x => x.tpl === 'tlSlide').length > 1;
  const head = h('header', { class:'ch' },
    h('span', { class:'num', text:String(i + 1) }),
    h('strong', { text:T.label }),
    h('span', { class:'gap' }),
    removable ? h('button', { type:'button', class:'btn small', onclick:() => { slides.splice(i, 1); build(); } }, 'Fjern slide') : null);
  const foot = h('footer', { class:'cfoot' },
    h('button', { type:'button', class:'btn small dlbtn', onclick:() => savePng(i) }, 'Hent png'));
  return h('article', { class:'card' }, head, h('div', { class:'cvwrap' }, c), h('div', { class:'ctls' }, ctl), foot);
}

function build() {
  pickerRenders = [];
  const wrap = $('cards'); wrap.replaceChildren(); cardEls.length = 0;
  slides.forEach((_, i) => { const el = buildCard(i); cardEls.push(el); wrap.append(el); });
  if (fmt.id === 'liste') {
    const add = h('button', { type:'button', class:'btn', style:'align-self:center;justify-self:start', onclick:() => {
      slides.push(mkSlide('tlSlide')); build();
    } }, '+ Tilføj slide til listen');
    wrap.append(add);
  }
  $('flow').textContent = slides.map(s => TPL[s.tpl].label).join('  ›  ');
  setZipLabels();
  drawAll(); updateDl();
}

/* ---------- format og størrelse ---------- */
function renderFormats() {
  const box = $('fmts'); box.replaceChildren();
  [...new Set(FORMATS.map(f => f.group))].forEach(g => {
    const row = h('div', { class:'row' });
    FORMATS.filter(f => f.group === g).forEach(f => {
      row.append(h('button', { type:'button', class:'chip', 'aria-pressed':String(f.id === fmt.id), onclick:() => selectFormat(f) }, f.name));
    });
    box.append(h('div', { class:'grp' }, h('h3', { text:g }), row));
  });
}
function renderSizes() {
  const box = $('sizes'); box.replaceChildren();
  Object.entries(SIZES).forEach(([k, v]) => {
    box.append(h('button', { type:'button', 'aria-pressed':String(k === sizeKey), onclick:() => { sizeKey = k; renderSizes(); build(); } }, v.label));
  });
}
function selectFormat(f) {
  const prev = slides;
  const carry = prev.length ? prev.map((_, i) => photoOf(prev, i)).find(Boolean) : null;
  fmt = f; slides = getSlides(f);
  if (carry && !slides.some(s => s.photo)) { const first = slides.find(s => TPL[s.tpl].photo); if (first) first.photo = carry; }
  renderFormats(); build();
}

/* ---------- download ---------- */
function updateDl() {
  document.querySelectorAll('.dlbtn').forEach(b => { b.disabled = zipping; });
  $('zipBtn').disabled = zipping; $('zipBtn2').disabled = zipping;
}
const fname = i => `${fmt.id}-${String(i + 1).padStart(2, '0')}-${slugify(TPL[slides[i].tpl].label)}-${sizeKey}`;
const toBlob = c => new Promise(r => c.toBlob(r, 'image/png'));
async function save({ filename, data }) {
  const blob = data instanceof Blob ? data : new Blob([data], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href:url, download:filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Filen er hentet');
}
async function savePng(i) {
  paint(i);
  const blob = await toBlob(slides[i]._c);
  await save({ filename:`${fname(i)}.png`, data:blob });
}
let zipping = false;
function setZipLabels(busy) {
  const txt = busy || `Hent alle ${slides.length} slides (.zip)`;
  $('zipBtn').textContent = txt; $('zipBtn2').textContent = txt;
  $('zipInfo').textContent = `${fmt.name} · ${SIZES[sizeKey].label} · ${slides.length} billeder i én fil`;
}
async function saveZip() {
  if (zipping) return;
  if (typeof JSZip === 'undefined') { toast('Zip-biblioteket kunne ikke indlæses'); return; }
  zipping = true; updateDl(); setZipLabels('Samler slides…');
  try {
    const zip = new JSZip();
    for (let i = 0; i < slides.length; i++) { paint(i); zip.file(`${fname(i)}.png`, await toBlob(slides[i]._c)); }
    const blob = await zip.generateAsync({ type:'blob' });
    await save({ filename:`tipsbladet-${fmt.id}-${sizeKey}.zip`, data:blob });
  } finally { zipping = false; updateDl(); setZipLabels(); }
}

/* ---------- logobibliotek ---------- */
const renderPickers = () => pickerRenders.forEach(f => f());
function renderLib() {
  const q = $('libSearch').value.trim().toLowerCase();
  const grid = $('libGrid'); grid.replaceChildren();
  $('libSum').textContent = lib.length ? `(${lib.length} klublogoer)` : '';
  const shown = lib.filter(l => !q || l.name.toLowerCase().includes(q));
  if (!shown.length) { grid.append(h('p', { class:'empty', text:lib.length ? 'Ingen logoer matcher søgningen.' : 'Ingen klublogoer endnu.' })); return; }
  shown.forEach(l => {
    grid.append(h('div', { class:'li' },
      h('img', { src:l.src, alt:'' }),
      h('input', { class:'nm', type:'text', readonly:!!l.builtin, value:l.name, 'aria-label':'Navn på logo', onchange:e => { l.name = e.target.value.trim() || l.name; persistLib(); renderPickers(); } }),
      l.builtin ? null : h('button', { type:'button', class:'x', title:'Fjern logo', onclick:() => {
        lib.splice(lib.indexOf(l), 1); persistLib();
        Object.values(cache).forEach(arr => arr.forEach(s => { s.logos = s.logos.filter(id => id !== l.id); }));
        renderLib(); renderPickers(); drawAll();
      } }, '\u00D7')));
  });
}
async function addLogos(files) {
  const list = [...files].filter(isImg); let n = 0;
  for (const f of list) {
    try {
      const src = await shrink(f), img = await loadImg(src), name = pretty(f.name);
      const ex = lib.find(l => !l.builtin && l.name.toLowerCase() === name.toLowerCase());
      if (ex) { ex.src = src; ex.img = img; } else lib.push({ id:uid(), name, src, img });
      n++;
    } catch { /* spring over ulæselige filer */ }
  }
  lib.sort((a, b) => a.name.localeCompare(b.name, 'da'));
  persistLib(); renderLib(); renderPickers(); drawAll();
  toast(n ? `${n} ${n === 1 ? 'logo' : 'logoer'} lagt i biblioteket` : 'Ingen billedfiler fundet');
}
async function filesFromDrop(dt) {
  const out = [], items = [...(dt.items || [])];
  if (items.length && items[0].webkitGetAsEntry) {
    const entries = items.map(i => i.webkitGetAsEntry()).filter(Boolean);
    const walk = async en => {
      if (en.isFile) out.push(await new Promise((res, rej) => en.file(res, rej)));
      else if (en.isDirectory) {
        const rd = en.createReader(); let batch;
        do { batch = await new Promise((res, rej) => rd.readEntries(res, rej)); for (const e of batch) await walk(e); } while (batch.length);
      }
    };
    for (const e of entries) await walk(e);
  } else out.push(...dt.files);
  return out;
}
function brandRow(boxId, kind, label) {
  const box = $(boxId); box.replaceChildren();
  const st = h('span', { class:'st' + (imgs[kind] ? ' ok' : ''), text:imgs[kind] ? 'Uploadet' : (kind === 'icon' || builtin.white ? 'Standardlogo bruges' : 'Ikonet er rigtigt, teksten er en tilnærmelse') });
  box.append(
    h('strong', { text:label }),
    fileBtn('Vælg PNG', 'image/*', async f => {
      const src = await shrink(f, 1200); imgs[kind] = await loadImg(src);
      idb.set('brand-' + kind, src); brandRow(boxId, kind, label); drawAll();
    }),
    imgs[kind] ? h('button', { type:'button', class:'btn small', onclick:() => { imgs[kind] = null; idb.del('brand-' + kind); brandRow(boxId, kind, label); drawAll(); } }, 'Fjern') : null,
    st);
}
function setupLib() {
  brandRow('brandIcon', 'icon', 'Ikon (grøn cirkel med T)');
  brandRow('brandWhite', 'white', 'Logo (hvidt, med tekst)');
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async e => { const files = await filesFromDrop(e.dataTransfer); addLogos(files); });
  $('pickFiles').addEventListener('change', e => { addLogos(e.target.files); e.target.value = ''; });
  $('pickDir').addEventListener('change', e => { addLogos(e.target.files); e.target.value = ''; });
  $('libSearch').addEventListener('input', renderLib);
  $('libSave').addEventListener('click', () => {
    if (!lib.length) { toast('Der er ingen logoer at gemme'); return; }
    save({ filename:'tipsbladet-klublogoer.json', data:JSON.stringify({ version:1, logos:lib.map(({ name, src }) => ({ name, src })) }) });
  });
  $('libLoad').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const data = JSON.parse(await f.text()); let n = 0;
      for (const l of (data.logos || [])) {
        if (!l.name || !l.src || !/^data:image\//.test(l.src)) continue;
        const img = await loadImg(l.src);
        const ex = lib.find(x => !x.builtin && x.name.toLowerCase() === l.name.toLowerCase());
        if (ex) { ex.src = l.src; ex.img = img; } else lib.push({ id:uid(), name:l.name, src:l.src, img });
        n++;
      }
      lib.sort((a, b) => a.name.localeCompare(b.name, 'da'));
      persistLib(); renderLib(); renderPickers(); drawAll();
      toast(`${n} logoer indlæst`);
    } catch { toast('Filen kunne ikke læses som logobibliotek'); }
  });
  renderLib();
}
async function loadBuiltinLogos() {
  try {
    const r = await fetch('logos/logos.json', { cache:'no-cache' });
    if (!r.ok) return;
    const list = await r.json();
    await Promise.all(list.map(async it => {
      try {
        const src = 'logos/' + encodeURIComponent(it.file);
        lib.push({ id:'b:' + it.file, name:it.name, src, img:await loadImg(src), builtin:true });
      } catch { /* spring over */ }
    }));
  } catch { /* ingen husets samling endnu */ }
}
async function loadStored() {
  const [stored, ic, wh] = await Promise.all([idb.get('library'), idb.get('brand-icon'), idb.get('brand-white')]);
  if (Array.isArray(stored)) {
    for (const l of stored) { try { lib.push({ id:l.id, name:l.name, src:l.src, img:await loadImg(l.src) }); } catch { /* spring over */ } }
  }
  if (ic) { try { imgs.icon = await loadImg(ic); } catch { /* ignorer */ } }
  if (wh) { try { imgs.white = await loadImg(wh); } catch { /* ignorer */ } }
}
async function loadFonts() {
  const sample = 'AaØøÆæÅå\u201C\u201D';
  const specs = ['400 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', 'italic 400 40px "Barlow Condensed"', 'italic 700 40px "Barlow Condensed"', '700 40px Montserrat'];
  const all = Promise.all(specs.map(f => document.fonts.load(f, sample).catch(() => null)));
  await Promise.race([all, new Promise(r => setTimeout(r, 5000))]);
}

/* ---------- start ---------- */
async function init() {
  $('resetFmt').addEventListener('click', () => { delete cache[fmt.id]; slides = getSlides(fmt); build(); toast('Formatet er nulstillet'); });
  $('zipBtn').addEventListener('click', saveZip);
  $('zipBtn2').addEventListener('click', saveZip);
  renderSizes();
  await loadFonts();
  await loadBuiltinLogos();
  await loadStored();
  lib.sort((a, b) => a.name.localeCompare(b.name, 'da'));
  try { builtin.icon = await loadImg(ICON_GREEN_SRC); builtin.iconWhite = await loadImg(ICON_WHITE_SRC); } catch { /* bruger tegnet tilnærmelse */ }
  try { builtin.white = await loadImg('assets/tipsbladet-logo-hvid.png'); } catch { /* ingen standardfil endnu */ }
  setupLib();
  slides = getSlides(fmt);
  renderFormats(); build();
  updateDl();
}
init();
})();

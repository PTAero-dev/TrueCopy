(() => {
  'use strict';

  // ======================================================================
  // 0. Small helpers
  // ======================================================================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ic = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const rafThrottle = (fn) => { let q = false; return () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(); }); }; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const fmtKB = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10240 ? 0 : 1)} MB` : `${Math.round(kb)} KB`);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(`tcproto_${k}`); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(`tcproto_${k}`, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
    clear() { try { Object.keys(localStorage).filter((k) => k.startsWith('tcproto_')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ } }
  };

  const mq = {
    wide: matchMedia('(min-width: 900px) and (min-height: 521px)'),
    landShort: matchMedia('(orientation: landscape) and (max-height: 520px)'),
    col: matchMedia('(min-width: 1280px) and (min-height: 521px)'),
    dark: matchMedia('(prefers-color-scheme: dark)')
  };
  const isStacked = () => !mq.wide.matches && !mq.landShort.matches;

  // ======================================================================
  // 1. Language + theme
  // ======================================================================
  let lang = store.get('lang', 'th') === 'en' ? 'en' : 'th';
  const L = (th, en) => (lang === 'en' ? en : th);

  function setBi(el, th, en) { if (!el) return; el.dataset.th = th; el.dataset.en = en; el.textContent = lang === 'en' ? en : th; }

  function applyLang() {
    document.documentElement.lang = lang;
    $$('[data-en]').forEach((el) => {
      if (el.dataset.th == null) el.dataset.th = el.textContent;
      el.textContent = lang === 'en' ? el.dataset.en : el.dataset.th;
    });
    $$('[data-en-ph]').forEach((el) => {
      if (el.dataset.thPh == null) el.dataset.thPh = el.getAttribute('placeholder') || '';
      el.setAttribute('placeholder', lang === 'en' ? el.dataset.enPh : el.dataset.thPh);
    });
    $$('[data-en-title]').forEach((el) => {
      if (el.dataset.thTitle == null) el.dataset.thTitle = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      const v = lang === 'en' ? el.dataset.enTitle : el.dataset.thTitle;
      el.setAttribute('aria-label', v);
      el.setAttribute('title', v);
    });
    $('#navLangLabel').textContent = lang === 'en' ? 'ภาษาไทย' : 'English';
    $('#lockLangLabel').textContent = lang === 'en' ? 'ภาษาไทย' : 'English';
    $$('#langSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    applyTheme();
  }

  const hostTheme = document.documentElement.getAttribute('data-theme');
  let theme = store.get('theme', 'system');
  function isDark() {
    const a = document.documentElement.getAttribute('data-theme');
    if (a === 'dark' || a === 'light') return a === 'dark';
    return mq.dark.matches;
  }
  function applyTheme() {
    const root = document.documentElement;
    if (theme === 'system') { if (hostTheme) root.setAttribute('data-theme', hostTheme); else root.removeAttribute('data-theme'); }
    else root.setAttribute('data-theme', theme);
    const dark = isDark();
    $('#navThemeLabel').textContent = dark ? L('โหมดสว่าง', 'Light mode') : L('โหมดมืด', 'Dark mode');
    $('#navThemeIcon use').setAttribute('href', dark ? '#i-sun' : '#i-moon');
    $$('#themeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeV === theme)));
  }
  mq.dark.addEventListener?.('change', applyTheme);

  // ======================================================================
  // 2. Settings + state
  // ======================================================================
  const TH_LINE = 'ใช้เพื่อยื่น {purpose} กับ{org} เท่านั้น';
  const EN_LINE = 'For submitting {purpose} to {org} only';
  const DEFAULTS = {
    purpose: 'Refinance', org: 'ธนาคารกรุงไทย', templateLine: TH_LINE,
    showLines: true, lineStyle: 'dashed', certifyText: 'รับรองสำเนาถูกต้อง',
    color: '#0D33BF', font: 'Sarabun', fontWeight: '600', fontSize: 26, opacity: 0.85, multiplyInk: true,
    stampScale: 0.93, angle: 35, posX: 0.5, posY: 0.5, flatten: true,
    showSignerName: false, signerName: '', sigId: 'sig_sample', sigThreshold: 200, tintSignature: true, sigScale: 1,
    showDate: false, dateValue: '', dateEra: 'BE', dateFormat: 'long', useThaiDigits: false,
    watermarkEnabled: false, watermarkOpacity: 0.1, watermarkText: '', showPageNo: false
  };
  const TPL_KEYS = ['templateLine', 'purpose', 'org', 'certifyText', 'showLines', 'lineStyle', 'color', 'font', 'fontWeight', 'fontSize', 'opacity', 'multiplyInk',
    'stampScale', 'angle', 'posX', 'posY', 'flatten', 'showSignerName', 'signerName', 'tintSignature', 'sigScale', 'showDate', 'dateEra', 'dateFormat', 'useThaiDigits',
    'watermarkEnabled', 'watermarkOpacity', 'watermarkText', 'showPageNo'];

  let S = Object.assign({}, DEFAULTS, store.get('settings', {}));
  const st = {
    view: 'certify', files: [], activeId: null, scope: 'all', overrides: {}, zoom: 1, handles: true, compare: false,
    tab: store.get('tab', 'text'), panelH: 0, panelRatio: store.get('panelRatio', 0), collapsed: false, disp: null, lastRatio: 0.42,
    generated: null, tplActive: store.get('tplActive', null),
    exportOpts: Object.assign({ pattern: 'p1', combine: false, combinedName: '' }, store.get('exportOpts', {})),
    lockView: null, pinEntry: '', customFonts: []
  };
  let sigs = store.get('sigs', null);
  let templates = store.get('templates', null);
  let defaultTplId = store.get('defaultTpl', null);
  let historyList = store.get('history', null);
  const sec = Object.assign({ pin: '', autoLock: 5, tabLeave: true, sessionOnly: true, signedIn: true }, store.get('sec', {}));
  const persistSoon = debounce(() => { store.set('settings', S); store.set('exportOpts', st.exportOpts); store.set('tplActive', st.tplActive); }, 400);
  const saveSigs = () => store.set('sigs', sigs);
  const saveTemplates = () => { store.set('templates', templates); store.set('defaultTpl', defaultTplId); };
  const saveHistory = () => store.set('history', historyList);
  const saveSec = () => store.set('sec', sec);

  // App style (Settings › Appearance) + "app colour follows stamp ink"
  const SKINS = [
    { id: 'ink', th: 'หมึกและกระดาษ', en: 'Ink & paper', dth: 'อ่านง่ายที่สุด เบาเครื่องที่สุด', den: 'Easiest to read, lightest on the device', bg: '#eceef2', panel: '#ffffff', line: '#0d33bf', btn: '#0d33bf' },
    { id: 'glass', th: 'กระจก', en: 'Glass', dth: 'ค่าเริ่มต้น โปร่งแสง เบลอพื้นหลัง', den: 'Default; translucent and blurred', bg: 'radial-gradient(70% 80% at 10% 10%, #a5b4fc, transparent 60%), radial-gradient(60% 70% at 95% 20%, #fbcfe8, transparent 60%), radial-gradient(80% 70% at 50% 110%, #a5f3fc, transparent 60%), #e4e9ff', panel: 'rgba(255,255,255,.6)', line: '#ffffff', btn: '#0d33bf' },
    { id: 'navy', th: 'กรมท่าทอง', en: 'Navy & gold', dth: 'ทางการ แบบเอกสารราชการ', den: 'Formal, like official paperwork', bg: '#eef0f3', panel: '#ffffff', line: '#b8892b', btn: '#16295f' },
    { id: 'graphite', th: 'เทาเข้ม', en: 'Graphite', dth: 'เรียบ ไม่มีสีรบกวน', den: 'Plain, no colour distractions', bg: '#eceef2', panel: '#ffffff', line: '#9ca3af', btn: '#1f2937' }
  ];
  // Glass is the default style (user's choice, 2026-11-20); anyone who picked a style keeps it
  SKINS.unshift(...SKINS.splice(SKINS.findIndex((x) => x.id === 'glass'), 1));
  let skin = SKINS.some((x) => x.id === store.get('skin', 'glass')) ? store.get('skin', 'glass') : 'glass';
  let inkAccent = !!store.get('inkAccent', false);
  function applySkin() {
    const r = document.documentElement;
    if (skin === 'ink') delete r.dataset.skin; else r.dataset.skin = skin;
    if (inkAccent) { r.dataset.inkAccent = 'on'; r.style.setProperty('--ink', S.color || '#0D33BF'); } else { delete r.dataset.inkAccent; r.style.removeProperty('--ink'); }
  }
  function renderSkinGrid() {
    const g = $('#skinGrid'); if (!g) return;
    g.innerHTML = SKINS.map((k) => `<button class="skin-card" type="button" data-action="skin-set" data-id="${k.id}" aria-pressed="${k.id === skin}">
      <span class="skin-prev" style="background:${k.bg}" aria-hidden="true"><span class="sp-panel" style="background:${k.panel}"></span><span class="sp-line" style="background:${k.line}"></span><span class="sp-btn" style="background:${k.btn}"></span></span>
      <b>${L(k.th, k.en)}</b><small>${L(k.dth, k.den)}</small></button>`).join('');
    const c = $('#chkInkAccent'); if (c) c.checked = inkAccent;
  }

  // ======================================================================
  // 3. Stamp wording helpers
  // ======================================================================
  const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const MONTHS_TH_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const thaiDigits = (s) => String(s).replace(/[0-9]/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]);
  const hasThai = (s) => /[฀-๿]/.test(s || '');
  const stampIsEnglish = (s = S) => !hasThai(s.certifyText) && !hasThai(s.templateLine);
  const resolvedLine = (s = S) => String(s.templateLine || '').replace(/\{purpose\}/gi, s.purpose || '').replace(/\{org\}/gi, s.org || '').replace(/\s+/g, ' ').trim();
  const signerText = (s = S) => { const n = String(s.signerName || '').trim(); return s.showSignerName && n ? `(${n})` : ''; };

  function formatDate(s = S, force = false) {
    if (!s.showDate && !force) return '';
    const d = s.dateValue ? new Date(`${s.dateValue}T00:00:00`) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDate(); const m = d.getMonth(); const y = d.getFullYear();
    const yr = s.dateEra === 'BE' ? y + 543 : y;
    const en = s.dateEra === 'CE' && stampIsEnglish(s);
    let out;
    if (s.dateFormat === 'numeric') out = `${day}/${m + 1}/${yr}`;
    else if (s.dateFormat === 'short') out = en ? `${day} ${MONTHS_EN[m].slice(0, 3)} ${yr}` : `${day} ${MONTHS_TH_S[m]} ${yr}`;
    else out = en ? `${day} ${MONTHS_EN[m]} ${yr}` : `${day} ${MONTHS_TH[m]} ${s.dateEra === 'BE' ? 'พ.ศ.' : 'ค.ศ.'} ${yr}`;
    return s.useThaiDigits ? thaiDigits(out) : out;
  }
  function pageNoText(pg) {
    if (!S.showPageNo || !pg) return '';
    const f = fileOf(pg); if (!f) return '';
    const act = f.pages.filter((p) => !p.excluded);
    const i = act.indexOf(pg);
    const n = i < 0 ? '–' : i + 1;
    const out = stampIsEnglish() ? `Page ${n} of ${act.length}` : `หน้า ${n}/${act.length}`;
    return S.useThaiDigits ? thaiDigits(out) : out;
  }
  const watermarkText = () => String(S.watermarkText || '').trim() || [resolvedLine(), formatDate(S, true)].filter(Boolean).join(' · ');

  // ======================================================================
  // 4. Signatures
  // ======================================================================
  function sampleSignatureDataUrl() {
    const c = mkCanvas(620, 230); const x = c.getContext('2d');
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#18213a';
    x.lineWidth = 7.5;
    x.beginPath();
    x.moveTo(46, 158);
    x.bezierCurveTo(64, 42, 128, 30, 116, 112);
    x.bezierCurveTo(106, 176, 62, 164, 94, 122);
    x.bezierCurveTo(134, 72, 164, 146, 196, 112);
    x.bezierCurveTo(216, 90, 226, 58, 248, 92);
    x.bezierCurveTo(262, 118, 256, 146, 278, 122);
    x.bezierCurveTo(298, 96, 310, 80, 330, 108);
    x.bezierCurveTo(344, 128, 356, 134, 376, 102);
    x.bezierCurveTo(396, 70, 410, 40, 420, 82);
    x.bezierCurveTo(428, 118, 410, 156, 442, 134);
    x.bezierCurveTo(482, 104, 512, 98, 556, 108);
    x.stroke();
    x.lineWidth = 5.5;
    x.beginPath(); x.moveTo(72, 186); x.bezierCurveTo(200, 168, 390, 196, 574, 156); x.stroke();
    return trimCanvas(c).toDataURL('image/png');
  }
  function trimCanvas(c) {
    const x = c.getContext('2d'); const { width: w, height: h } = c;
    const d = x.getImageData(0, 0, w, h).data;
    let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      if (d[(y * w + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return c;
    const pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
    const out = mkCanvas(x1 - x0 + 1, y1 - y0 + 1);
    out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }
  const imgCache = new Map();
  function loadImg(src) {
    if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }));
    return imgCache.get(src);
  }
  const activeSig = () => sigs.find((g) => g.id === S.sigId) || null;
  const tintCache = new Map();
  async function sigImageFor(s) {
    const g = sigs.find((x) => x.id === s.sigId); if (!g) return null;
    let im; try { im = await loadImg(g.dataUrl); } catch (e) { return null; }
    if (!s.tintSignature) return im;
    const key = `${g.id}|${g.dataUrl.length}|${s.color}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = mkCanvas(im.naturalWidth, im.naturalHeight); const x = c.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = s.color; x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
    return c;
  }
  async function cleanSignature(rawUrl, threshold) {
    const im = await loadImg(rawUrl);
    const c = mkCanvas(im.naturalWidth, im.naturalHeight); const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height); const d = id.data; const feather = 26;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let a;
      if (lum >= threshold + feather / 2) a = 0;
      else if (lum <= threshold - feather / 2) a = 255;
      else a = Math.round(255 * (1 - (lum - (threshold - feather / 2)) / feather));
      d[i + 3] = Math.min(d[i + 3], a);
      d[i] *= 0.7; d[i + 1] *= 0.7; d[i + 2] *= 0.7;
    }
    x.putImageData(id, 0, 0);
    return trimCanvas(c).toDataURL('image/png');
  }

  // ======================================================================
  // 5. Stamp rendering (same layout rules as the live app)
  // ======================================================================
  // SIPA "TH" fonts draw ~1.45× smaller than Google's Sarabun at the same px (measured on Thai + x-height),
  // so they are enlarged by this factor to keep the chosen point size looking the same.
  const FONT_SCALE = { 'TH SarabunPSK Italic': 1.45 };
  const fscale = (fam) => FONT_SCALE[fam] || 1;
  const BUILTIN_FONTS = [
    { f: 'Sarabun', th: 'Sarabun (สารบรรณ)', en: 'Sarabun' },
    { f: 'Niramit', th: 'Niramit (นิรมิต)', en: 'Niramit' },
    { f: 'TH SarabunPSK Italic', th: 'TH Sarabun ตัวเอียง', en: 'TH Sarabun Italic' }
  ];
  async function ensureFont(fam, w) { try { await document.fonts.load(`${w} 40px "${fam}"`); } catch (e) { /* fallback font */ } }
  const stampCache = new Map();
  async function buildStamp(s, extra = {}, SS = 2) {
    const sigImg = extra.noSig ? null : await sigImageFor(s);
    const g = sigs.find((x) => x.id === s.sigId);
    const key = JSON.stringify([s.templateLine, s.purpose, s.org, s.certifyText, s.showLines, s.lineStyle, s.color, s.font, s.fontWeight, s.fontSize,
      s.showSignerName, s.signerName, s.showDate, s.dateValue, s.dateEra, s.dateFormat, s.useThaiDigits, sigImg ? s.sigId : '', g ? g.dataUrl.length : 0,
      s.tintSignature, s.sigScale, extra.pageText || '', SS]);
    if (stampCache.has(key)) return stampCache.get(key);
    const fam = s.font || 'Sarabun'; const fw = s.fontWeight || '700';
    await ensureFont(fam, fw);
    const W = 820;
    const mainText = resolvedLine(s); const cert = String(s.certifyText || '').trim();
    const signer = signerText(s); const date = formatDate(s); const pageText = extra.pageText || '';
    const base = (Number(s.fontSize) || 26) * 1.25 * fscale(fam);
    const m = mkCanvas(10, 10).getContext('2d');
    let mainPx = base;
    if (mainText) {
      m.font = `${fw} ${mainPx}px "${fam}", "Sarabun", sans-serif`;
      const mw = m.measureText(mainText).width;
      if (mw > W - 24) mainPx = Math.max(14, mainPx * ((W - 24) / mw));
    }
    const certPx = Math.max(14, base * 0.8); const signerPx = Math.max(12, base * 0.68); const datePx = Math.max(12, base * 0.66);
    const lw = Math.max(2.2, base * 0.075);
    let y = 10; let topY = null; let mainY = null; let botY = null;
    if (s.showLines) { topY = y + lw / 2; y += lw; }
    if (mainText) { y += mainPx * 0.72; mainY = y + mainPx * 0.42; y += mainPx * 0.82 + mainPx * 0.56; } else if (s.showLines) y += mainPx * 0.6;
    if (s.showLines) { botY = y + lw / 2; y += lw + mainPx * 0.55; } else if (mainText) y += mainPx * 0.33;
    let certY = null;
    if (cert) { certY = y + certPx * 0.55; y += certPx * 1.35 + (sigImg || signer || date || pageText ? mainPx * 0.35 : 8); }
    let sigBox = null;
    if (sigImg && sigImg.width > 0) {
      const th = Math.max(26, base * 2.1 * (Number(s.sigScale) || 1)); const maxW = W * 0.52; const ar = sigImg.width / sigImg.height;
      let dw = th * ar; let dh = th; if (dw > maxW) { dw = maxW; dh = dw / ar; }
      sigBox = { x: (W - dw) / 2, y, w: dw, h: dh }; y += dh + (signer || date || pageText ? 10 : 8);
    }
    let signerY = null; if (signer) { signerY = y + signerPx * 0.55; y += signerPx * 1.45 + (date ? 2 : 0); }
    let dateY = null; if (date) { dateY = y + datePx * 0.55; y += datePx * 1.42; }
    let pageY = null; if (pageText) { pageY = y + datePx * 0.55; y += datePx * 1.42; }
    const H = Math.max(60, Math.ceil(y + 8));
    const c = mkCanvas(W * SS, H * SS); const x = c.getContext('2d');
    x.scale(SS, SS); x.fillStyle = s.color; x.strokeStyle = s.color; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (s.showLines) {
      x.lineWidth = lw; x.setLineDash(s.lineStyle === 'dashed' ? [16, 11] : []);
      [topY, botY].forEach((ly) => { if (ly == null) return; x.beginPath(); x.moveTo(4, ly); x.lineTo(W - 4, ly); x.stroke(); });
      x.setLineDash([]);
    }
    if (mainText) { x.font = `${fw} ${mainPx}px "${fam}", "Sarabun", sans-serif`; x.fillText(mainText, W / 2, mainY); }
    if (cert) { x.font = `${fw} ${certPx}px "${fam}", "Sarabun", sans-serif`; x.fillText(cert, W / 2, certY); }
    if (sigBox) x.drawImage(sigImg, sigBox.x, sigBox.y, sigBox.w, sigBox.h);
    if (signer) { x.font = `600 ${signerPx}px "${fam}", "Sarabun", sans-serif`; x.fillText(signer, W / 2, signerY); }
    if (date) { x.font = `600 ${datePx}px "${fam}", "Sarabun", sans-serif`; x.fillText(date, W / 2, dateY); }
    if (pageText) { x.font = `600 ${datePx}px "${fam}", "Sarabun", sans-serif`; x.fillText(pageText, W / 2, pageY); }
    if (stampCache.size > 60) stampCache.delete(stampCache.keys().next().value);
    stampCache.set(key, c);
    return c;
  }
  const stampFor = (pg) => buildStamp(S, { pageText: pageNoText(pg) });

  function drawStampOn(ctx, W, H, stamp, pl) {
    const sw = W * pl.stampScale; const sh = sw * (stamp.height / stamp.width);
    ctx.save();
    ctx.translate(W * pl.posX, H * pl.posY); ctx.rotate((-pl.angle * Math.PI) / 180);
    ctx.globalAlpha = Number(S.opacity) || 0.85;
    ctx.globalCompositeOperation = S.multiplyInk ? 'multiply' : 'source-over';
    ctx.drawImage(stamp, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }
  function drawWatermark(ctx, W, H) {
    if (!S.watermarkEnabled) return;
    const text = watermarkText(); if (!text) return;
    const fs = Math.max(8, Math.round(Math.min(W, H) * 0.026 * fscale(S.font)));
    ctx.save();
    ctx.font = `600 ${fs}px "${S.font}", "Sarabun", sans-serif`;
    const mw = Math.max(fs * 6, ctx.measureText(text).width); const stepX = mw + fs * 3.5; const stepY = Math.max(fs * 5.2, Math.min(W, H) * 0.22);
    ctx.translate(W / 2, H / 2); ctx.rotate((-30 * Math.PI) / 180);
    ctx.fillStyle = S.color; ctx.globalAlpha = clamp(Number(S.watermarkOpacity) || 0.1, 0.02, 0.4);
    ctx.globalCompositeOperation = S.multiplyInk ? 'multiply' : 'source-over';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const diag = Math.hypot(W, H) * 0.72; let row = 0;
    for (let yy = -diag; yy <= diag; yy += stepY) { const off = (row % 2) * stepX * 0.5; for (let xx = -diag - stepX; xx <= diag + stepX; xx += stepX) ctx.fillText(text, xx + off, yy); row++; }
    ctx.restore();
  }

  // ======================================================================
  // 6. Documents: sample pages, images, PDFs
  // ======================================================================
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function drawSamplePage(spec, W, H) {
    const c = mkCanvas(W, H); const x = c.getContext('2d');
    const r = rng(spec.seed); const u = W / 1000; const m = W * 0.075;
    x.fillStyle = spec.photo ? '#f3f1ea' : '#ffffff'; x.fillRect(0, 0, W, H);
    if (spec.photo) {
      const g = x.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.85);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,50,30,0.16)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    x.beginPath(); x.arc(m + 30 * u, m + 30 * u, 30 * u, 0, Math.PI * 2); x.fillStyle = '#d5dae3'; x.fill();
    x.fillStyle = '#5b6577'; x.font = `700 ${22 * u}px Sarabun`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(spec.logo, m + 30 * u, m + 31 * u);
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#111827'; x.font = `700 ${26 * u}px Sarabun`; x.fillText(spec.org, m + 76 * u, m + 26 * u);
    x.fillStyle = '#6b7280'; x.font = `400 ${17 * u}px Sarabun`; x.fillText(spec.orgSub, m + 76 * u, m + 52 * u);
    x.textAlign = 'right'; x.fillText(spec.docNo, W - m, m + 26 * u); x.fillText(`หน้า ${spec.page}/${spec.of}`, W - m, m + 52 * u); x.textAlign = 'left';
    x.fillStyle = '#111827'; x.fillRect(m, m + 74 * u, W - 2 * m, 2.2 * u);
    x.font = `700 ${34 * u}px Sarabun`; x.textAlign = 'center'; x.fillText(spec.title, W / 2, m + 134 * u); x.textAlign = 'left';
    let y = m + 192 * u; x.font = `400 ${19 * u}px Sarabun`;
    for (const [k, v] of spec.info) { x.fillStyle = '#6b7280'; x.fillText(k, m, y); x.fillStyle = '#111827'; x.fillText(v, m + 210 * u, y); y += 33 * u; }
    y += 16 * u;
    const tw = W - 2 * m; const cols = spec.cols;
    x.fillStyle = '#eceff4'; x.fillRect(m, y, tw, 42 * u);
    x.fillStyle = '#374151'; x.font = `600 ${17 * u}px Sarabun`;
    let cx = m;
    cols.forEach((col) => { const cw = col.w * tw; x.textAlign = col.r ? 'right' : 'left'; x.fillText(col.t, col.r ? cx + cw - 12 * u : cx + 12 * u, y + 27 * u); cx += cw; });
    y += 42 * u; x.font = `400 ${17 * u}px Sarabun`;
    const rows = spec.rows(r);
    for (let i = 0; i < rows.length; i++) {
      if (y > H - m - 190 * u) break;
      if (i % 2) { x.fillStyle = '#f7f8fa'; x.fillRect(m, y, tw, 37 * u); }
      x.fillStyle = '#111827'; cx = m;
      rows[i].forEach((val, j) => { const col = cols[j]; const cw = col.w * tw; x.textAlign = col.r ? 'right' : 'left'; x.fillText(val, col.r ? cx + cw - 12 * u : cx + 12 * u, y + 25 * u); cx += cw; });
      y += 37 * u;
    }
    x.textAlign = 'left'; x.fillStyle = '#cfd4dc'; x.fillRect(m, y + 6 * u, tw, 1.6 * u);
    if (spec.total) {
      x.font = `700 ${21 * u}px Sarabun`; x.fillStyle = '#111827'; x.fillText(spec.totalLabel, m + 12 * u, y + 44 * u);
      x.textAlign = 'right'; x.fillText(spec.total, W - m - 12 * u, y + 44 * u); x.textAlign = 'left';
    }
    x.font = `400 ${15 * u}px Sarabun`; x.fillStyle = '#9aa1ad'; x.textAlign = 'center';
    x.fillText('เอกสารตัวอย่างสำหรับทดลองต้นแบบ ไม่ใช่เอกสารจริง (SAMPLE)', W / 2, H - m * 0.55);
    return c;
  }

  const SAMPLE_FILES = [
    {
      name: 'ตัวอย่าง_สลิปเงินเดือน.pdf', pages: 2, W: 1000, H: 1414,
      spec: (p, of) => ({
        seed: 11 + p, page: p, of, logo: 'ตก', org: 'บริษัท ตัวอย่างการค้า จำกัด', orgSub: 'ฝ่ายทรัพยากรบุคคล · สำนักงานใหญ่', docNo: `เลขที่ PS-2569-${100 + p}`,
        title: 'สลิปเงินเดือน (ตัวอย่าง)', info: [['ชื่อพนักงาน', 'นาย ตัวอย่าง ทดสอบระบบ'], ['รหัสพนักงาน', 'EMP-00421'], ['งวดเดือน', p === 1 ? 'กันยายน 2569' : 'ตุลาคม 2569']],
        cols: [{ t: 'รายการ', w: 0.62 }, { t: 'จำนวนเงิน (บาท)', w: 0.38, r: true }],
        rows: (r) => [['เงินเดือน', money(48500)], ['ค่าครองชีพ', money(2500)], ['ค่าล่วงเวลา', money(Math.round(r() * 6000) + 1200)], ['เบี้ยขยัน', money(1000)],
          ['หัก ภาษีหัก ณ ที่จ่าย', `-${money(Math.round(r() * 900) + 2100)}`], ['หัก ประกันสังคม', '-750.00'], ['หัก กองทุนสำรองเลี้ยงชีพ', `-${money(2425)}`]],
        total: money(47600 + p * 315), totalLabel: 'รับสุทธิ'
      })
    },
    {
      name: 'ตัวอย่าง_รายการเดินบัญชี.pdf', pages: 3, W: 1000, H: 1294,
      spec: (p, of) => ({
        seed: 31 + p, page: p, of, logo: 'สธ', org: 'ธนาคารสาธิต จำกัด (มหาชน)', orgSub: 'Demo Bank · ใช้เพื่อทดลองเท่านั้น', docNo: 'บัญชี 123-4-56789-0',
        title: 'รายการเดินบัญชี (ตัวอย่าง)', info: [['ชื่อบัญชี', 'นาย ตัวอย่าง ทดสอบระบบ'], ['ประเภท', 'ออมทรัพย์'], ['ช่วงวันที่', '1 ส.ค. – 31 ต.ค. 2569']],
        cols: [{ t: 'วันที่', w: 0.16 }, { t: 'รายการ', w: 0.34 }, { t: 'ถอน', w: 0.16, r: true }, { t: 'ฝาก', w: 0.16, r: true }, { t: 'คงเหลือ', w: 0.18, r: true }],
        rows: (r) => {
          let bal = 182340.55 + p * 1200; const out = []; const desc = ['โอนเงินเดือน', 'ชำระบัตรเครดิต', 'ถอน ATM', 'โอนพร้อมเพย์', 'ชำระค่าไฟฟ้า', 'ดอกเบี้ย', 'ซื้อสินค้า', 'รับโอน'];
          for (let i = 0; i < 18; i++) {
            const dep = r() > 0.6; const amt = Math.round((dep ? 2000 + r() * 30000 : 150 + r() * 9000) * 100) / 100; bal += dep ? amt : -amt;
            out.push([`${String(1 + ((i * 3 + p * 5) % 28)).padStart(2, '0')}/${String(7 + p).padStart(2, '0')}`, desc[Math.floor(r() * desc.length)], dep ? '' : money(amt), dep ? money(amt) : '', money(bal)]);
          }
          return out;
        }
      })
    },
    {
      name: 'ตัวอย่าง_ใบเสร็จ.jpg', pages: 1, W: 900, H: 1200, photo: true,
      spec: () => ({
        seed: 77, page: 1, of: 1, photo: true, logo: 'รช', org: 'ร้าน ตัวอย่างเครื่องใช้ไฟฟ้า', orgSub: 'ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ', docNo: 'เลขที่ RC-58821',
        title: 'ใบเสร็จรับเงิน (ตัวอย่าง)', info: [['วันที่', '12 ตุลาคม 2569'], ['ลูกค้า', 'คุณ ตัวอย่าง ทดสอบ']],
        cols: [{ t: 'สินค้า', w: 0.5 }, { t: 'จำนวน', w: 0.16, r: true }, { t: 'ราคา', w: 0.34, r: true }],
        rows: () => [['เครื่องฟอกอากาศ', '1', money(8990)], ['ไส้กรอง HEPA', '2', money(1780)], ['ค่าจัดส่ง', '1', money(150)], ['ส่วนลด', '', '-500.00']],
        total: money(10420), totalLabel: 'รวมทั้งสิ้น'
      })
    }
  ];

  function mkPage(file, idx, w, h, baseFn, thumbFn) {
    const pg = {
      id: uid('pg'), fileId: file.id, idx, w, h, excluded: false, _bp: null, _tp: null,
      getBase() { if (!this._bp) this._bp = Promise.resolve().then(baseFn); return this._bp; },
      getThumb() {
        if (!this._tp) {
          this._tp = thumbFn ? Promise.resolve().then(thumbFn) : this.getBase().then((b) => { const tw = 240; const c = mkCanvas(tw, (tw * b.height) / b.width); c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); return c; });
        }
        return this._tp;
      }
    };
    return pg;
  }
  function makeSampleFile(def, opts = {}) {
    const f = { id: uid('f'), name: opts.name || def.name, kind: def.photo ? 'image' : 'pdf', locked: !!opts.locked, pages: [] };
    for (let p = 1; p <= def.pages; p++) {
      const spec = def.spec(p, def.pages);
      f.pages.push(mkPage(f, p - 1, def.W, def.H, () => drawSamplePage(spec, def.W, def.H)));
    }
    return f;
  }
  const makeSampleFiles = () => SAMPLE_FILES.map((d) => makeSampleFile(d));

  function fileToImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => res(im); im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); }; im.src = url;
    });
  }
  function imageFile(name, im) {
    const f = { id: uid('f'), name, kind: 'image', locked: false, pages: [] };
    const w = im.naturalWidth; const h = im.naturalHeight;
    f.pages.push(mkPage(f, 0, w, h, () => { const s = Math.min(1, 1600 / Math.max(w, h)); const c = mkCanvas(w * s, h * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c; }));
    return f;
  }

  let pdfjsP = null;
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function ensurePdfjs() {
    if (!pdfjsP) {
      const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
      pdfjsP = (async () => {
        await loadScript(`${base}pdf.min.js`);
        await loadScript(`${base}pdf.worker.min.js`);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}pdf.worker.min.js`;
        return window.pdfjsLib;
      })().catch((e) => { pdfjsP = null; throw e; });
    }
    return pdfjsP;
  }
  async function loadPdfFile(file) {
    const lib = await ensurePdfjs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    let needed = false;
    const task = lib.getDocument({ data: bytes });
    task.onPassword = (update, reason) => {
      needed = true;
      askPassword(file.name, reason === lib.PasswordResponses.INCORRECT_PASSWORD).then((pw) => { if (pw == null) task.destroy(); else update(pw); });
    };
    let doc;
    try { doc = await task.promise; } catch (e) { if (needed) return null; throw e; }
    const f = { id: uid('f'), name: file.name, kind: 'pdf', locked: needed, pages: [] };
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i); const vp1 = page.getViewport({ scale: 1 });
      const render = async (maxPx) => { const sc = Math.min(2.4, maxPx / Math.max(vp1.width, vp1.height)); const vp = page.getViewport({ scale: sc }); const c = mkCanvas(vp.width, vp.height); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await page.render({ canvasContext: x, viewport: vp }).promise; return c; };
      f.pages.push(mkPage(f, i - 1, vp1.width, vp1.height, () => render(1500), () => render(240)));
    }
    return f;
  }

  async function readFiles(list) {
    const out = [];
    for (const file of Array.from(list || [])) {
      try {
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          toast(L(`กำลังเปิด ${file.name}…`, `Opening ${file.name}…`), { ms: 1600 });
          const f = await loadPdfFile(file); if (f) out.push(f);
        } else if (/^image\//.test(file.type)) {
          out.push(imageFile(file.name || L('รูปถ่ายเอกสาร.jpg', 'photo.jpg'), await fileToImage(file)));
        } else toast(L(`ไม่รองรับไฟล์ ${file.name}`, `Unsupported file: ${file.name}`));
      } catch (e) {
        console.warn(e);
        toast(L(`เปิดไฟล์ ${file.name} ไม่ได้`, `Couldn't open ${file.name}`));
      }
    }
    return out;
  }
  async function addFilesToCertify(list) {
    const added = await readFiles(list); if (!added.length) return;
    st.files.push(...added);
    st.activeId = added[0].pages[0].id;
    st.generated = null;
    renderCertifyAll();
    toast(L(`เพิ่ม ${added.length} ไฟล์แล้ว`, `Added ${added.length} file(s)`));
  }

  // ======================================================================
  // 7. Certify workspace
  // ======================================================================
  const allPages = () => st.files.flatMap((f) => f.pages);
  const fileOf = (pg) => st.files.find((f) => f.id === pg.fileId);
  function activePage() { const ps = allPages(); return ps.find((p) => p.id === st.activeId) || ps[0] || null; }
  const activeCount = () => allPages().filter((p) => !p.excluded).length;
  const basePlacement = () => ({ stampScale: S.stampScale, angle: S.angle, posX: S.posX, posY: S.posY });
  const getPlacement = (pid) => (st.overrides[pid] ? { ...st.overrides[pid] } : basePlacement());
  const editsPage = () => { const pg = activePage(); return !!pg && (st.scope === 'page' || !!st.overrides[pg.id]); };

  function setPlacement(patch, live = false) {
    const pg = activePage();
    if (pg && editsPage()) st.overrides[pg.id] = { ...getPlacement(pg.id), ...patch };
    else Object.assign(S, patch);
    schedulePreview(); syncPlacementControls();
    if (!live) { commitSoon(); persistSoon(); scheduleThumbs(); markOutdated(); renderScope(); }
  }

  // ---- preview ----
  let renderToken = 0;
  async function renderPreview() {
    const tok = ++renderToken;
    const pg = activePage();
    renderStageChrome();
    const paper = $('#paper');
    if (!pg) { paper.hidden = true; $('#stampBox').hidden = true; return; }
    paper.hidden = false;
    const base = await pg.getBase(); if (tok !== renderToken) return;
    const showStamp = !st.compare && !pg.excluded;
    const stamp = showStamp ? await stampFor(pg) : null; if (tok !== renderToken) return;
    const sc = $('#stageScroll'); const pad = mq.wide.matches ? 48 : 28;
    const availW = Math.max(60, sc.clientWidth - pad); const availH = Math.max(60, sc.clientHeight - pad);
    const ratio = base.width / base.height;
    let dw = availW; let dh = dw / ratio; if (dh > availH) { dh = availH; dw = dh * ratio; }
    dw = Math.floor(dw * st.zoom); dh = Math.floor(dh * st.zoom);
    let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    while (dw * dh * dpr * dpr > 14e6 && dpr > 1) dpr -= 0.25;
    const cv = $('#pv'); cv.width = Math.round(dw * dpr); cv.height = Math.round(dh * dpr); cv.style.width = `${dw}px`; cv.style.height = `${dh}px`;
    const x = cv.getContext('2d');
    x.drawImage(base, 0, 0, cv.width, cv.height);
    if (stamp) { drawWatermark(x, cv.width, cv.height); drawStampOn(x, cv.width, cv.height, stamp, getPlacement(pg.id)); st.lastRatio = stamp.height / stamp.width; }
    paper.classList.toggle('excluded', !!pg.excluded);
    st.disp = { w: dw, h: dh };
    $('#stage').classList.toggle('fit', st.zoom === 1);
    positionStampBox();
  }
  const schedulePreview = rafThrottle(() => { renderPreview(); });

  function positionStampBox() {
    const box = $('#stampBox'); const pg = activePage();
    if (!pg || st.compare || pg.excluded || !st.disp) { box.hidden = true; return; }
    box.hidden = false;
    const p = getPlacement(pg.id); const { w, h } = st.disp;
    const bw = p.stampScale * w; const bh = bw * st.lastRatio;
    box.style.width = `${bw}px`; box.style.height = `${bh}px`;
    box.style.left = `${p.posX * w - bw / 2}px`; box.style.top = `${p.posY * h - bh / 2}px`;
    box.style.transform = `rotate(${-p.angle}deg)`;
    box.classList.toggle('no-handles', !st.handles);
  }

  function renderStageChrome() {
    const ps = allPages(); const pg = activePage(); const has = !!pg;
    $('#emptyState').hidden = has;
    $$('#stage .ov').forEach((o) => { if (o.id !== 'exclBanner') o.hidden = !has; });
    if (!has) { $('#exclBanner').hidden = true; return; }
    const i = ps.indexOf(pg);
    $('#btnPrev').disabled = i <= 0; $('#btnNext').disabled = i >= ps.length - 1;
    $('.ov-ml').hidden = ps.length < 2; $('.ov-mr').hidden = ps.length < 2;
    const f = fileOf(pg);
    $('#pagePill').innerHTML = `${st.overrides[pg.id] ? '<i class="ovr-dot" title="ตำแหน่งเฉพาะหน้านี้"></i>' : ''}<span class="tnum">${L('หน้า', 'Page')} ${i + 1} / ${ps.length}</span>${st.files.length > 1 ? `<span style="color:var(--text-3)">· ${L('ไฟล์', 'File')} ${st.files.indexOf(f) + 1}</span>` : ''}`;
    $('#exclBanner').hidden = !pg.excluded;
    $('#btnHandles').setAttribute('aria-pressed', String(st.handles));
    $('#zoomLabel').textContent = st.zoom === 1 ? L('พอดี', 'Fit') : `${Math.round(st.zoom * 100)}%`;
  }

  function goPage(delta) {
    const ps = allPages(); const i = ps.indexOf(activePage()); const n = clamp(i + delta, 0, ps.length - 1);
    if (n !== i) setActive(ps[n].id);
  }
  function setActive(pid) {
    st.activeId = pid;
    const pg = activePage();
    st.scope = pg && st.overrides[pg.id] ? 'page' : (st.scope === 'page' ? 'page' : 'all');
    schedulePreview(); renderStripActive(); renderDocsPane(); renderScope(); syncPlacementControls();
  }

  // ---- filmstrip ----
  function renderStrip() {
    const el = $('#strip');
    if (!st.files.length) { el.innerHTML = `<button class="strip-add" type="button" data-action="pick-files" aria-label="${L('เพิ่มไฟล์', 'Add files')}">${ic('plus')}<span class="strip-add-label">${L('เพิ่มไฟล์', 'Add files')}</span></button>`; return; }
    let n = 0;
    el.innerHTML = st.files.map((f, fi) => `
      <div class="strip-group" data-fid="${f.id}">
        <button class="strip-tag" type="button" data-action="file-go" data-id="${f.id}" title="${esc(f.name)}">${fi + 1}</button>
        <div class="strip-head"><span class="badge tnum">${fi + 1}</span><span class="fname" title="${esc(f.name)}">${esc(f.name)}</span>${f.locked ? ic('unlock', 'i-sm') : ''}<button class="icon-btn" type="button" data-action="file-remove" data-id="${f.id}" aria-label="${L('นำไฟล์ออก', 'Remove file')}">${ic('x', 'i-sm')}</button></div>
        <div class="thumbs">${f.pages.map((p) => { n++; return `<button class="thumb${p.excluded ? ' excluded' : ''}" type="button" data-pid="${p.id}" aria-label="${L('หน้า', 'Page')} ${n}"><canvas width="1" height="1"></canvas><span class="tn">${n}</span>${st.overrides[p.id] ? '<i class="td"></i>' : ''}</button>`; }).join('')}</div>
      </div>`).join('') + `<button class="strip-add" type="button" data-action="pick-files" aria-label="${L('เพิ่มไฟล์', 'Add files')}">${ic('plus')}<span class="strip-add-label">${L('เพิ่มไฟล์', 'Add files')}</span></button>`;
    renderStripActive();
    renderThumbs();
  }
  function renderStripActive() {
    const pg = activePage();
    $$('#strip .thumb').forEach((t) => {
      const on = pg && t.dataset.pid === pg.id;
      t.classList.toggle('active', !!on);
      if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  let thumbToken = 0;
  async function renderThumbs() {
    const tok = ++thumbToken;
    for (const t of $$('#strip .thumb')) {
      const pg = allPages().find((p) => p.id === t.dataset.pid); if (!pg) continue;
      const th = await pg.getThumb(); if (tok !== thumbToken) return;
      const stamp = pg.excluded ? null : await stampFor(pg); if (tok !== thumbToken) return;
      const c = t.querySelector('canvas'); if (!c) continue;
      c.width = th.width; c.height = th.height;
      const x = c.getContext('2d'); x.drawImage(th, 0, 0);
      if (stamp) { drawWatermark(x, c.width, c.height); drawStampOn(x, c.width, c.height, stamp, getPlacement(pg.id)); }
      t.classList.toggle('excluded', !!pg.excluded);
      const dot = t.querySelector('.td');
      if (st.overrides[pg.id] && !dot) t.insertAdjacentHTML('beforeend', '<i class="td"></i>'); else if (!st.overrides[pg.id] && dot) dot.remove();
    }
  }
  const scheduleThumbs = debounce(renderThumbs, 260);

  // ---- docs pane ----
  function renderDocsPane() {
    $('#docsCount').textContent = String(st.files.length);
    const pg = activePage();
    $('#fileList').innerHTML = st.files.length ? st.files.map((f, fi) => {
      const ex = f.pages.filter((p) => p.excluded).length;
      const ext = (f.name.split('.').pop() || '').toUpperCase().slice(0, 4);
      return `<div class="file-row${pg && pg.fileId === f.id ? ' active' : ''}" role="button" tabindex="0" data-action="file-go" data-id="${f.id}">
        <span class="file-ico">${esc(ext)}</span>
        <span class="file-info"><span class="file-name">${fi + 1}. ${esc(f.name)}</span>
          <span class="file-meta"><span class="badge tnum">${f.pages.length} ${L('หน้า', 'pages')}</span>${ex ? `<span class="badge badge-bad tnum">${L('นำออก', 'removed')} ${ex}</span>` : ''}${f.locked ? `<span class="badge badge-accent">${ic('unlock', 'i-sm')}${L('ปลดล็อกแล้ว', 'Unlocked')}</span>` : ''}</span></span>
        <button class="icon-btn" type="button" data-action="file-remove" data-id="${f.id}" aria-label="${L('นำไฟล์ออก', 'Remove file')}">${ic('trash')}</button>
      </div>`;
    }).join('') : `<div class="empty-list">${L('ยังไม่มีไฟล์', 'No files yet')}</div>`;
    $('#pageGroup').hidden = !pg;
    if (pg) {
      const ps = allPages(); const f = fileOf(pg);
      $('#curPageTitle').textContent = `${L('หน้า', 'Page')} ${ps.indexOf(pg) + 1} · ${f ? f.name : ''}`;
      const b = $('#btnExclude');
      b.classList.toggle('btn-danger', !pg.excluded); b.classList.toggle('btn-primary', !!pg.excluded);
      b.querySelector('span').textContent = pg.excluded ? L('กู้คืนหน้านี้', 'Restore page') : L('นำหน้านี้ออก', 'Remove page');
      $('#btnRestoreAll').hidden = !ps.some((p) => p.excluded);
    }
  }
  function renderSummary() {
    const ps = allPages(); const ex = ps.filter((p) => p.excluded).length;
    $('#certSummary').textContent = st.files.length
      ? `${st.files.length} ${L('ไฟล์', 'files')} · ${ps.length - ex} ${L('หน้า', 'pages')}${ex ? ` · ${L('นำออก', 'removed')} ${ex}` : ''}`
      : L('ยังไม่มีเอกสาร', 'No documents yet');
  }
  function renderGenButton() {
    const b = $('#btnGenerate'); const ready = st.generated && !st.generated.outdated;
    b.classList.toggle('btn-primary', !ready); b.classList.toggle('btn-ok', !!ready);
    $('#genIcon use').setAttribute('href', ready ? '#i-check' : '#i-stamp');
    $('#genLabel').textContent = ready ? L(`ไฟล์พร้อม (${st.generated.outputs.length})`, `Ready (${st.generated.outputs.length})`) : L('สร้าง PDF', 'Create PDF');
    b.disabled = activeCount() === 0;
  }
  function markOutdated() { if (st.generated && !st.generated.outdated) { st.generated.outdated = true; renderGenButton(); } }
  function renderCertifyAll() {
    renderSummary(); renderStrip(); renderDocsPane(); renderScope(); renderGenButton(); syncControls(); schedulePreview();
    $('#navEdCount').textContent = String(ed.items.length);
  }

  // ---- controls binding ----
  const FMT = { pct: (v) => `${Math.round(v * 100)}%`, deg: (v) => `${Math.round(v)}°`, pt: (v) => `${Math.round(v)} pt`, raw: (v) => String(v ?? '') };
  function setRangeFill(el) { const p = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100; el.style.setProperty('--fill', `${clamp(p, 0, 100)}%`); }
  function readEl(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range') return Number(el.value) / Number(el.dataset.scale || 1);
    return el.value;
  }
  function writeEl(el, v) {
    if (el.classList.contains('seg')) { $$('button[data-v]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); return; }
    if (el.type === 'checkbox') { el.checked = !!v; return; }
    if (el.type === 'range') { el.value = String(Math.round(Number(v) * Number(el.dataset.scale || 1))); setRangeFill(el); return; }
    if (document.activeElement === el) return;
    if (el.type === 'color') { el.value = String(v || '#000000').toLowerCase(); return; }
    el.value = v ?? '';
  }
  function syncPlacementControls() {
    const pg = activePage(); const p = pg ? getPlacement(pg.id) : basePlacement();
    $$('[data-p]').forEach((el) => writeEl(el, p[el.dataset.p]));
    $$('[data-out-p]').forEach((o) => { o.textContent = FMT[o.dataset.fmt](p[o.dataset.outP]); });
    $$('#angleChips [data-angle]').forEach((b) => b.setAttribute('aria-pressed', String(Math.round(p.angle) === Number(b.dataset.angle))));
    $$('#posGrid [data-pos]').forEach((b) => { const [px, py] = b.dataset.pos.split(',').map(Number); b.setAttribute('aria-pressed', String(Math.abs(px - p.posX) < 0.02 && Math.abs(py - p.posY) < 0.02)); });
  }
  function syncControls() {
    $$('[data-s]').forEach((el) => writeEl(el, S[el.dataset.s]));
    $$('[data-out]').forEach((o) => { o.textContent = FMT[o.dataset.fmt](S[o.dataset.out]); });
    $$('[data-show-if]').forEach((el) => { el.hidden = !S[el.dataset.showIf]; });
    $$('#swatches [data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color.toLowerCase() === String(S.color).toLowerCase())));
    $$('#presetSeg [data-preset]').forEach((b) => {
      const on = b.dataset.preset === 'th' ? S.templateLine === TH_LINE && S.certifyText === DEFAULTS.certifyText : S.templateLine === EN_LINE && S.certifyText === 'Certified True Copy';
      b.setAttribute('aria-pressed', String(on));
    });
    const line = resolvedLine();
    const rl = $('#resolvedLine'); rl.textContent = line || L('(ไม่มีข้อความ)', '(no text)'); rl.style.fontFamily = `"${S.font}", "Sarabun", sans-serif`; rl.style.color = S.color; rl.style.fontSize = `${16 * fscale(S.font)}px`;
    const dp = $('#datePreview'); dp.textContent = formatDate(S, true); dp.style.fontFamily = `"${S.font}", "Sarabun", sans-serif`;
    const g = activeSig();
    $('#sigAdjust').hidden = !g;
    $('#thresholdField').hidden = !(g && g.kind === 'upload');
    $('#signDot').hidden = !!g;
    syncPlacementControls();
  }
  function setS(key, v) {
    if (S[key] === v) return;
    S[key] = v;
    if (TPL_KEYS.includes(key) && st.tplActive) { st.tplActive = null; renderTplChips(); }
    afterSettingsChange(key);
  }
  function afterSettingsChange(key) {
    syncControls(); schedulePreview(); scheduleThumbs(); commitSoon(); persistSoon(); markOutdated();
    if (key === 'sigThreshold') reprocessSigSoon();
    if (key === 'color' || key === 'font' || key === 'fontWeight' || key === '*') renderFontCards();
    if ((key === 'color' || key === '*') && inkAccent) applySkin();
    if (key === 'sigId' || key === 'tintSignature' || key === 'color' || key === '*') renderSigRow();
  }
  function bindControls() {
    $$('[data-s]').forEach((el) => {
      const key = el.dataset.s;
      if (el.classList.contains('seg')) {
        el.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) setS(key, b.dataset.v); });
        return;
      }
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => { if (el.type === 'range') setRangeFill(el); setS(key, readEl(el)); });
    });
    $$('[data-p]').forEach((el) => el.addEventListener('input', () => { setRangeFill(el); setPlacement({ [el.dataset.p]: readEl(el) }); }));
    $$('#swatches [data-color]').forEach((b) => b.addEventListener('click', () => setS('color', b.dataset.color)));
    $$('#angleChips [data-angle]').forEach((b) => b.addEventListener('click', () => setPlacement({ angle: Number(b.dataset.angle) })));
    $$('#posGrid [data-pos]').forEach((b) => b.addEventListener('click', () => { const [px, py] = b.dataset.pos.split(',').map(Number); setPlacement({ posX: px, posY: py }); }));
    $$('[data-scope]').forEach((b) => b.addEventListener('click', () => setScope(b.dataset.scope)));
    $$('[data-insert]').forEach((b) => b.addEventListener('click', () => {
      const inp = $('#inTplLine'); const tok = b.dataset.insert; const s0 = inp.selectionStart ?? inp.value.length; const s1 = inp.selectionEnd ?? inp.value.length;
      inp.value = inp.value.slice(0, s0) + tok + inp.value.slice(s1); inp.focus(); inp.setSelectionRange(s0 + tok.length, s0 + tok.length); setS('templateLine', inp.value);
    }));
    $$('#presetSeg [data-preset]').forEach((b) => b.addEventListener('click', () => {
      const en = b.dataset.preset === 'en';
      Object.assign(S, { templateLine: en ? EN_LINE : TH_LINE, certifyText: en ? 'Certified True Copy' : DEFAULTS.certifyText, dateEra: en ? 'CE' : 'BE' });
      st.tplActive = null; renderTplChips(); afterSettingsChange('*');
      toast(en ? L('ใช้ข้อความตราภาษาอังกฤษ', 'English stamp wording applied') : L('ใช้ข้อความตราภาษาไทย', 'Thai stamp wording applied'));
    }));
    $$('.tab').forEach((t) => t.addEventListener('click', () => { if (!suppressTabClick) setTab(t.dataset.tab); }));
    $('#toolpanel').addEventListener('focusin', (e) => {
      if (!e.target.matches('input[type="text"], input[type="date"], input:not([type]), textarea')) return;
      if (isStacked()) { document.body.classList.add('kbd'); schedulePreview(); setTimeout(() => e.target.scrollIntoView({ block: 'nearest' }), 280); }
    });
    $('#toolpanel').addEventListener('focusout', () => { setTimeout(() => { if (!$('#toolpanel').contains(document.activeElement)) { document.body.classList.remove('kbd'); schedulePreview(); } }, 60); });
  }
  function setTab(tab) {
    st.tab = tab; store.set('tab', tab);
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    $$('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === tab));
    if (st.collapsed) setCollapsed(false);
  }
  function setScope(v) {
    const pg = activePage();
    if (v === 'all' && pg && st.overrides[pg.id]) {
      toast(L('หน้านี้มีตำแหน่งเฉพาะ จะใช้ตำแหน่งร่วมไหม?', 'This page has its own position. Use the shared one?'), { action: L('ใช้ตำแหน่งร่วม', 'Use shared'), onAction: () => { delete st.overrides[pg.id]; st.scope = 'all'; afterOverrideChange(); }, ms: 5200 });
      return;
    }
    st.scope = v; renderScope();
  }
  function afterOverrideChange() { renderScope(); renderStageChrome(); syncPlacementControls(); schedulePreview(); scheduleThumbs(); commitSoon(); markOutdated(); }
  function renderScope() {
    const pg = activePage(); const ovr = pg && st.overrides[pg.id]; const eff = editsPage() ? 'page' : 'all';
    $$('[data-scope]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scope === eff)));
    const n = Object.keys(st.overrides).length;
    const note = $('#scopeNote'); note.classList.toggle('is-page', eff === 'page');
    $('#scopeText').textContent = eff === 'page'
      ? (ovr ? L('หน้านี้ใช้ตำแหน่งเฉพาะของตัวเอง', 'This page uses its own position') : L('การปรับต่อไปจะมีผลเฉพาะหน้านี้', 'Changes will apply to this page only'))
      : (n ? L(`ใช้ตำแหน่งร่วมกันทุกหน้า (ยกเว้น ${n} หน้าที่ปรับเฉพาะ)`, `Shared position on all pages (except ${n} adjusted page${n > 1 ? 's' : ''})`) : L('ใช้ตำแหน่งร่วมกันทุกหน้า', 'Same position on every page'));
    $('#btnResetPage').hidden = !ovr; $('#btnApplyAll').hidden = !ovr;
  }

  // ---- gestures on the preview (drag, rotate handle, resize handle, two-finger pinch/twist) ----
  const gest = { mode: null, pts: new Map(), s: null };
  function showHud() { const pg = activePage(); if (!pg) return; const p = getPlacement(pg.id); const h = $('#hud'); h.textContent = `${Math.round(p.angle)}° · ${Math.round(p.stampScale * 100)}%`; h.classList.add('show'); }
  const hideHud = debounce(() => $('#hud').classList.remove('show'), 500);
  function setupGestures() {
    const stage = $('#stage');
    stage.addEventListener('pointerdown', (e) => {
      const pg = activePage(); if (!pg || pg.excluded || st.compare || e.button > 0) return;
      if (e.target.closest('.ov')) return;
      gest.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gest.pts.size === 2 && (st.zoom === 1 || gest.mode)) { startPinch(); e.preventDefault(); return; }
      let mode = null;
      if (e.target.closest('.h-rot')) mode = 'rotate'; else if (e.target.closest('.h-size')) mode = 'resize'; else if (e.target.closest('#stampBox')) mode = 'move';
      if (!mode) return;
      e.preventDefault();
      const r = $('#pv').getBoundingClientRect(); const p = getPlacement(pg.id);
      const cx = r.left + p.posX * r.width; const cy = r.top + p.posY * r.height;
      gest.mode = mode; gest.s = { x: e.clientX, y: e.clientY, p, r, cx, cy, dist: Math.max(10, Math.hypot(e.clientX - cx, e.clientY - cy)) };
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!gest.pts.has(e.pointerId)) return;
      gest.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (gest.mode === 'pinch') { updatePinch(); return; }
      if (!gest.mode) return;
      const s = gest.s; let patch;
      if (gest.mode === 'move') patch = { posX: clamp(s.p.posX + (e.clientX - s.x) / s.r.width, 0.02, 0.98), posY: clamp(s.p.posY + (e.clientY - s.y) / s.r.height, 0.02, 0.98) };
      else if (gest.mode === 'rotate') {
        let a = (Math.atan2(-(e.clientX - s.cx), -(e.clientY - s.cy)) * 180) / Math.PI;
        for (const snap of [0, 35, -35, 90, -90]) if (Math.abs(a - snap) < 2.5) a = snap;
        patch = { angle: Math.round(clamp(a, -90, 90)) };
      } else patch = { stampScale: clamp((s.p.stampScale * Math.hypot(e.clientX - s.cx, e.clientY - s.cy)) / s.dist, 0.3, 1.15) };
      setPlacement(patch, true); showHud();
    });
    const end = (e) => {
      if (!gest.pts.has(e.pointerId)) return;
      gest.pts.delete(e.pointerId);
      if (gest.mode === 'pinch' && gest.pts.size < 2) { gest.mode = null; finishGesture(); }
      else if (gest.mode && gest.mode !== 'pinch' && gest.pts.size === 0) { gest.mode = null; finishGesture(); }
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    const box = $('#stampBox');
    box.addEventListener('keydown', (e) => {
      const pg = activePage(); if (!pg) return; const p = getPlacement(pg.id); const step = e.shiftKey ? 0.05 : 0.01; let patch = null;
      if (e.key === 'ArrowLeft') patch = { posX: clamp(p.posX - step, 0.02, 0.98) }; else if (e.key === 'ArrowRight') patch = { posX: clamp(p.posX + step, 0.02, 0.98) };
      else if (e.key === 'ArrowUp') patch = { posY: clamp(p.posY - step, 0.02, 0.98) }; else if (e.key === 'ArrowDown') patch = { posY: clamp(p.posY + step, 0.02, 0.98) };
      if (patch) { e.preventDefault(); e.stopPropagation(); setPlacement(patch); }
    });
  }
  function startPinch() {
    const pg = activePage(); const [a, b] = [...gest.pts.values()]; const r = $('#pv').getBoundingClientRect();
    gest.mode = 'pinch';
    gest.s = { p: getPlacement(pg.id), r, d0: Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)), t0: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
  function updatePinch() {
    const [a, b] = [...gest.pts.values()]; if (!b) return; const s = gest.s;
    const d = Math.hypot(b.x - a.x, b.y - a.y); const t = Math.atan2(b.y - a.y, b.x - a.x);
    const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
    setPlacement({
      stampScale: clamp((s.p.stampScale * d) / s.d0, 0.3, 1.15),
      angle: Math.round(clamp(s.p.angle - ((t - s.t0) * 180) / Math.PI, -90, 90)),
      posX: clamp(s.p.posX + (mx - s.mx) / s.r.width, 0.02, 0.98), posY: clamp(s.p.posY + (my - s.my) / s.r.height, 0.02, 0.98)
    }, true);
    showHud();
  }
  function finishGesture() { hideHud(); commitSoon(); persistSoon(); scheduleThumbs(); markOutdated(); renderScope(); renderStageChrome(); }

  // ---- resizable split between preview and tools (phones / iPad portrait) ----
  let suppressTabClick = false;
  const viewH = () => $('#viewCertify').clientHeight || window.innerHeight;
  function maxPanelH() { return Math.max(180, viewH() - 58 - 150 - 74 - 56); }
  function applyPanelH(h) {
    st.panelH = clamp(h, 120, maxPanelH()); st.panelRatio = st.panelH / viewH();
    $('#viewCertify').style.setProperty('--panel-h', `${Math.round(st.panelH)}px`);
  }
  function setCollapsed(c) { st.collapsed = c; $('#viewCertify').classList.toggle('collapsed', c); schedulePreview(); }
  function initPanelH() { const vh = viewH(); applyPanelH(st.panelRatio > 0 ? st.panelRatio * vh : clamp(vh * 0.42, 210, 440)); }
  function setupPanelResize() {
    const tabs = $('#tooltabs'); let drag = null;
    tabs.addEventListener('pointerdown', (e) => { if (!isStacked()) return; drag = { y: e.clientY, h: st.collapsed ? 0 : st.panelH, id: e.pointerId, moved: false, onGrip: !!e.target.closest('.grip') }; });
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = drag.y - e.clientY;
      if (!drag.moved && Math.abs(dy) < 8) return;
      if (!drag.moved) { drag.moved = true; try { tabs.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      const h = drag.h + dy;
      if (h < 90) { if (!st.collapsed) setCollapsed(true); } else { if (st.collapsed) setCollapsed(false); applyPanelH(h); schedulePreview(); }
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) { suppressTabClick = true; setTimeout(() => { suppressTabClick = false; }, 80); store.set('panelRatio', st.panelRatio); }
      else if (drag.onGrip) setCollapsed(!st.collapsed);
      drag = null;
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    $('#grip').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(!st.collapsed); } });
  }

  // ---- undo / redo for stamp settings ----
  const hist = { stack: [], idx: -1 };
  const snapshot = () => JSON.stringify({ S, O: st.overrides, E: allPages().filter((p) => p.excluded).map((p) => p.id) });
  function commitHistory() {
    const s = snapshot(); if (hist.stack[hist.idx] === s) return;
    hist.stack = hist.stack.slice(0, hist.idx + 1); hist.stack.push(s);
    if (hist.stack.length > 100) hist.stack.shift();
    hist.idx = hist.stack.length - 1; renderUndo();
  }
  const commitSoon = debounce(commitHistory, 450);
  function restoreSnap(s) {
    const o = JSON.parse(s); S = Object.assign({}, DEFAULTS, o.S); st.overrides = o.O || {};
    const ex = new Set(o.E || []); allPages().forEach((p) => { p.excluded = ex.has(p.id); });
    persistSoon(); markOutdated(); renderCertifyAll(); renderFontCards(); renderSigRow(); renderUndo();
  }
  function undo() { if (hist.idx <= 0) return; hist.idx--; restoreSnap(hist.stack[hist.idx]); toast(L('ย้อนกลับแล้ว', 'Undone'), { ms: 1200 }); }
  function redo() { if (hist.idx >= hist.stack.length - 1) return; hist.idx++; restoreSnap(hist.stack[hist.idx]); }
  function renderUndo() { $('#btnUndo').disabled = hist.idx <= 0; $('#btnRedo').disabled = hist.idx >= hist.stack.length - 1; }

  // ---- signatures in the Sign pane ----
  function renderSigRow() {
    const none = `<button class="sig-card" type="button" data-action="sig-use" data-id="" aria-pressed="${!activeSig()}"><span class="sig-face">${ic('slash', 'i-lg')}</span><span class="sig-name">${L('ไม่ใส่ลายเซ็น', 'No signature')}</span></button>`;
    const cards = sigs.map((g) => `<button class="sig-card" type="button" data-action="sig-use" data-id="${g.id}" aria-pressed="${g.id === S.sigId}"><span class="sig-face"><img alt="" src="${g.dataUrl}"></span><span class="sig-name">${esc(g.name)}</span></button>`).join('');
    const adds = `<button class="sig-card add" type="button" data-action="sig-draw"><span class="sig-face">${ic('pencil', 'i-lg')}</span><span class="sig-name">${L('เซ็นบนจอ', 'Draw')}</span></button>
      <button class="sig-card add" type="button" data-action="sig-upload"><span class="sig-face">${ic('camera', 'i-lg')}</span><span class="sig-name">${L('อัปโหลด / ถ่ายรูป', 'Upload / photo')}</span></button>`;
    $('#sigRow').innerHTML = none + cards + adds;
    $('#sigRow').querySelectorAll('img').forEach((im) => { im.style.filter = S.tintSignature ? 'none' : 'none'; });
    setBi($('#sigSyncNote'), sec.signedIn ? 'ซิงก์แล้ว' : 'เก็บในเครื่องนี้', sec.signedIn ? 'Synced' : 'This device only');
  }
  const reprocessSigSoon = debounce(async () => {
    const g = activeSig(); if (!g || g.kind !== 'upload' || !g.raw) return;
    g.dataUrl = await cleanSignature(g.raw, S.sigThreshold); g.threshold = S.sigThreshold;
    saveSigs(); renderSigRow(); schedulePreview(); scheduleThumbs();
  }, 220);
  function useSig(id) { setS('sigId', id || null); renderSigRow(); }

  function renderFontCards() {
    const fonts = [...BUILTIN_FONTS.map((b) => ({ f: b.f, n: L(b.th, b.en) })), ...st.customFonts.map((f) => ({ f, n: `${f} · ${L('อัปโหลด', 'uploaded')}` }))];
    $('#fontCards').innerHTML = fonts.map((x) => `<button class="font-card" type="button" data-font="${esc(x.f)}" aria-pressed="${x.f === S.font}"><span class="fs" style="font-family:'${esc(x.f)}', sans-serif;font-weight:${S.fontWeight};color:${S.color};font-size:${19 * fscale(x.f)}px">${esc(S.certifyText || 'รับรองสำเนาถูกต้อง')}</span><span class="fn">${esc(x.n)}</span></button>`).join('');
    $$('#fontCards [data-font]').forEach((b) => b.addEventListener('click', () => setS('font', b.dataset.font)));
  }

  // ---- templates & recent purposes in the Text pane ----
  function renderTplChips() {
    $('#tplChips').innerHTML = templates.map((t) => `<button class="chip" type="button" data-action="tpl-use" data-id="${t.id}" aria-pressed="${t.id === st.tplActive}">${t.id === defaultTplId ? ic('star', 'i-sm') : ''}<span>${esc(t.name)}</span></button>`).join('')
      + `<button class="chip chip-dashed" type="button" data-action="tpl-new">${ic('plus', 'i-sm')}<span>${L('บันทึกเป็นเทมเพลต', 'Save as template')}</span></button>`;
  }
  function recentPairs() {
    const seen = new Set(); const out = [];
    for (const h of historyList) { if (!h.purpose && !h.org) continue; const k = `${h.purpose}|${h.org}`; if (seen.has(k)) continue; seen.add(k); out.push(h); if (out.length >= 4) break; }
    return out;
  }
  function renderRecent() {
    const r = recentPairs(); $('#recentGroup').hidden = !r.length;
    $('#recentChips').innerHTML = r.map((h) => `<button class="chip" type="button" data-action="recent-use" data-id="${h.id}" aria-pressed="${h.purpose === S.purpose && h.org === S.org}">${ic('history', 'i-sm')}<span>${esc(h.purpose)} · ${esc(h.org)}</span></button>`).join('');
  }
  function tplFromCurrent(name) { const t = { id: uid('tpl'), name, createdAt: Date.now(), s: {} }; TPL_KEYS.forEach((k) => { t.s[k] = S[k]; }); return t; }
  function applyTemplate(t) {
    Object.assign(S, t.s); st.tplActive = t.id;
    renderTplChips(); renderRecent(); afterSettingsChange('*');
    toast(L(`ใช้เทมเพลต “${t.name}”`, `Template “${t.name}” applied`));
  }

  // ======================================================================
  // 8. Create PDF: check → progress → result (file writing is simulated)
  // ======================================================================
  function outName(file, fi) {
    const base = file.name.replace(/\.[^.]+$/, '');
    const org = (S.org || '').trim(); const d = new Date();
    const date = `${d.getFullYear() + (stampIsEnglish() ? 0 : 543)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const word = stampIsEnglish() ? 'certified' : 'รับรองสำเนา';
    const p = st.exportOpts.pattern;
    let n = p === 'p2' ? `${base}_${word}` : p === 'p3' ? `${date}_${org}_${base}` : `${base}_${word}${org ? `_${org}` : ''}`;
    n = n.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').replace(/_+/g, '_').trim();
    return `${n || `document_${fi + 1}`}.pdf`;
  }
  const exportModal = () => $('#exportModal');
  function openExport() {
    if (!activeCount()) { toast(L('ยังไม่มีหน้าเอกสารให้รับรอง', 'There are no pages to certify')); return; }
    if (st.generated && !st.generated.outdated) showDone(); else showCheck();
    openModal('#exportModal');
  }
  function checkItems() {
    const ps = allPages(); const ex = ps.filter((p) => p.excluded).length; const line = resolvedLine(); const g = activeSig();
    const extras = [signerText(), formatDate(), S.showPageNo ? L('เลขหน้า', 'page numbers') : ''].filter(Boolean);
    const nOvr = Object.keys(st.overrides).length;
    return [
      { s: 'ok', t: L('เอกสาร', 'Documents'), d: `${st.files.length} ${L('ไฟล์', 'files')} · ${ps.length - ex} ${L('หน้าที่จะประทับตรา', 'pages to stamp')}${ex ? ` · ${L('นำออก', 'removed')} ${ex}` : ''}` },
      line ? { s: 'ok', t: L('ข้อความจำกัดวัตถุประสงค์', 'Restricted-use line'), d: line, stamp: true } : { s: 'warn', t: L('ยังไม่มีข้อความวัตถุประสงค์', 'No restricted-use line'), d: L('ควรระบุว่าใช้ยื่นกับหน่วยงานใด เพื่อป้องกันการนำสำเนาไปใช้ผิดวัตถุประสงค์', 'Name the organisation so the copy can’t be reused elsewhere.'), fix: 'text' },
      g ? { s: 'ok', t: L('ลายเซ็น', 'Signature'), d: g.name } : { s: 'warn', t: L('ยังไม่ได้ใส่ลายเซ็น', 'No signature yet'), d: L('สำเนาที่รับรองถูกต้องต้องมีลายเซ็นเจ้าของเอกสาร', 'A certified copy needs the owner’s signature.'), fix: 'sign' },
      { s: 'info', t: L('ใต้ลายเซ็น', 'Under the signature'), d: extras.length ? extras.join(' · ') : L('ไม่แสดงชื่อ วันที่ หรือเลขหน้า', 'No name, date or page number') },
      ...(nOvr ? [{ s: 'info', t: L('ตำแหน่งเฉพาะหน้า', 'Per-page positions'), d: L(`${nOvr} หน้าใช้ตำแหน่งของตัวเอง`, `${nOvr} page(s) use their own position`) }] : []),
      S.flatten ? { s: 'ok', t: L('ป้องกันการแก้ไข', 'Tamper protection'), d: `Flatten ${L('เปิด', 'on')}${S.watermarkEnabled ? ` · ${L('ลายน้ำ', 'watermark')} ${L('เปิด', 'on')}` : ''}` }
        : { s: 'warn', t: L('Flatten ปิดอยู่', 'Flatten is off'), d: L('ผู้อื่นอาจลบตราหรือดึงลายเซ็นออกด้วยโปรแกรมแก้ PDF', 'Someone could remove the stamp or copy your signature in a PDF editor.'), fix: 'protect' }
    ];
  }
  function showCheck() {
    exportModal().dataset.step = 'check';
    $('#exportIco').innerHTML = ic('listcheck');
    $('#exportTitle').textContent = L('ตรวจก่อนสร้างไฟล์', 'Check before creating');
    $('#exportSub').innerHTML = `${L('ทบทวนให้ครบก่อนส่งให้หน่วยงาน', 'Review everything before you send it')} <span class="new">${L('ใหม่', 'New')}</span>`;
    const items = checkItems(); const files = st.files.filter((f) => f.pages.some((p) => !p.excluded));
    const o = st.exportOpts;
    $('#exportBody').innerHTML = `
      <div class="check-list">${items.map((it) => `<div class="check-item ${it.s}"><span class="check-ico">${ic(it.s === 'ok' ? 'check' : it.s === 'warn' ? 'alert' : 'info')}</span><span class="check-text"><b>${esc(it.t)}</b><small class="${it.stamp ? 'stampish' : ''}">${esc(it.d)}</small></span>${it.fix ? `<button class="btn btn-sm btn-soft check-fix" type="button" data-action="check-fix" data-id="${it.fix}">${L('แก้ไข', 'Fix')}</button>` : ''}</div>`).join('')}</div>
      <div class="group">
        <div class="group-title"><span>${L('ไฟล์ผลลัพธ์', 'Output files')}</span></div>
        <div class="field"><label class="label" for="selPattern">${L('ตั้งชื่อไฟล์', 'File names')}</label>
          <select class="select" id="selPattern">
            <option value="p1"${o.pattern === 'p1' ? ' selected' : ''}>${L('ชื่อเดิม_รับรองสำเนา_หน่วยงาน', 'name_certified_organisation')}</option>
            <option value="p2"${o.pattern === 'p2' ? ' selected' : ''}>${L('ชื่อเดิม_รับรองสำเนา', 'name_certified')}</option>
            <option value="p3"${o.pattern === 'p3' ? ' selected' : ''}>${L('วันที่_หน่วยงาน_ชื่อเดิม', 'date_organisation_name')}</option>
          </select>
          <p class="hint" id="namePreview" style="overflow-wrap:anywhere"></p></div>
        ${files.length > 1 ? `<div class="row"><div class="row-text"><b>${L('รวมทุกไฟล์เป็น PDF เดียว', 'Combine into one PDF')} <span class="new">${L('ใหม่', 'New')}</span></b><small>${L('สะดวกเมื่อหน่วยงานรับไฟล์เดียว', 'Handy when the bank accepts one upload')}</small></div><input class="switch" type="checkbox" id="chkCombine"${o.combine ? ' checked' : ''} aria-label="${L('รวมเป็นไฟล์เดียว', 'Combine')}"></div>` : ''}
      </div>`;
    const prev = () => {
      const fs = st.files.filter((f) => f.pages.some((p) => !p.excluded));
      $('#namePreview').textContent = o.combine && fs.length > 1 ? `→ ${combinedName()}` : `→ ${outName(fs[0], 0)}${fs.length > 1 ? L(` และอีก ${fs.length - 1} ไฟล์`, ` and ${fs.length - 1} more`) : ''}`;
    };
    $('#selPattern').addEventListener('change', (e) => { o.pattern = e.target.value; persistSoon(); prev(); });
    $('#chkCombine')?.addEventListener('change', (e) => { o.combine = e.target.checked; persistSoon(); prev(); });
    prev();
    const n = activeCount();
    $('#exportFoot').innerHTML = `<button class="btn" type="button" data-action="export-close">${L('กลับไปแก้ไข', 'Keep editing')}</button><button class="btn btn-primary" type="button" data-action="export-run" title="${n} ${L('หน้า', 'pages')}">${ic('stamp')}<span>${L('สร้าง PDF', 'Create PDF')}</span></button>`;
  }
  function combinedName() {
    const org = (S.org || '').trim();
    return `${(stampIsEnglish() ? `certified_copies${org ? `_${org}` : ''}` : `รวมเอกสารรับรองสำเนา${org ? `_${org}` : ''}`).replace(/[\\/:*?"<>|]+/g, '-')}.pdf`;
  }
  async function runExport() {
    exportModal().dataset.step = 'progress';
    $('#exportIco').innerHTML = ic('stamp');
    $('#exportTitle').textContent = L('กำลังประทับตราทุกหน้า…', 'Stamping every page…');
    $('#exportSub').textContent = L('ประมวลผลในเครื่องนี้ ไม่มีการอัปโหลดเอกสาร', 'Processed on this device. Nothing is uploaded.');
    $('#exportBody').innerHTML = `<div class="progress"><i id="progBar"></i></div><div class="prog-meta"><span id="progText">…</span><span id="progPct">0%</span></div>`;
    $('#exportFoot').innerHTML = '';
    const files = st.files.filter((f) => f.pages.some((p) => !p.excluded)); const total = activeCount(); let done = 0;
    for (const [fi, f] of files.entries()) {
      const pages = f.pages.filter((p) => !p.excluded);
      for (const [pi, p] of pages.entries()) {
        await p.getBase(); await stampFor(p); await sleep(70);
        done++;
        if (!$('#progBar')) return;
        $('#progBar').style.width = `${(done / total) * 100}%`;
        $('#progPct').textContent = `${Math.round((done / total) * 100)}%`;
        $('#progText').textContent = `${L('ไฟล์', 'File')} ${fi + 1}/${files.length} · ${L('หน้า', 'page')} ${pi + 1}/${pages.length}`;
      }
    }
    const perPage = S.flatten ? 168 : 64;
    let outputs = files.map((f, fi) => { const n = f.pages.filter((p) => !p.excluded).length; return { name: outName(f, fi), pages: n, kb: n * perPage * (0.85 + ((fi * 37) % 30) / 100) }; });
    if (st.exportOpts.combine && outputs.length > 1) outputs = [{ name: combinedName(), pages: total, kb: outputs.reduce((a, b) => a + b.kb, 0) }];
    st.generated = { outputs, outdated: false, at: Date.now() };
    historyList.unshift({ id: uid('h'), createdAt: Date.now(), fileNames: files.map((f) => f.name), purposeText: resolvedLine() || S.certifyText, purpose: S.purpose, org: S.org,
      templateLine: S.templateLine, pageCount: total, outputPath: outputs.map((o) => o.name).join(', '), templateName: templates.find((t) => t.id === st.tplActive)?.name || '' });
    historyList = historyList.slice(0, 100); saveHistory(); renderRecent(); renderNavCounts(); renderGenButton();
    showDone();
  }
  function showDone() {
    exportModal().dataset.step = 'done';
    const g = st.generated; const kb = g.outputs.reduce((a, b) => a + b.kb, 0);
    $('#exportIco').innerHTML = ic('check');
    $('#exportTitle').textContent = L('ไฟล์รับรองสำเนาพร้อมแล้ว', 'Your certified files are ready');
    $('#exportSub').textContent = L('บันทึกลงประวัติแล้ว', 'Saved to history');
    $('#exportBody').innerHTML = `
      <div class="done-hero">${ic('check')}<span>${g.outputs.length} ${L('ไฟล์', 'file(s)')} · ${g.outputs.reduce((a, b) => a + b.pages, 0)} ${L('หน้า', 'pages')} · ${fmtKB(kb)}</span></div>
      <div class="out-list">${g.outputs.map((o, i) => `<div class="out-row"><span class="file-ico">PDF</span><span class="out-info"><span class="out-name">${esc(o.name)}</span><span class="out-meta">${o.pages} ${L('หน้า', 'pages')} · ${fmtKB(o.kb)}</span></span>
        <span class="out-actions"><button class="btn btn-sm" type="button" data-action="out-download" data-id="${i}">${ic('download', 'i-sm')}<span>${L('ดาวน์โหลด', 'Download')}</span></button><button class="btn btn-sm btn-soft" type="button" data-action="out-share" data-id="${i}">${ic('share', 'i-sm')}<span>${L('แชร์', 'Share')}</span></button></span></div>`).join('')}</div>
      <p class="hint">${L('ปุ่ม “แชร์” ส่งไฟล์ไป LINE อีเมล OneDrive หรือแอปอื่นได้โดยตรง', 'Use “Share” to send files to LINE, email, OneDrive or other apps directly.')}</p>`;
    $('#exportFoot').innerHTML = `${g.outputs.length > 1 ? `<button class="btn" type="button" data-action="out-zip">${ic('archive', 'i-sm')}<span>${L('ดาวน์โหลดทั้งหมด (.zip)', 'Download all (.zip)')}</span></button><button class="btn" type="button" data-action="out-share-all">${ic('share', 'i-sm')}<span>${L('แชร์ทุกไฟล์', 'Share all')}</span></button>` : ''}
      <button class="btn" type="button" data-action="out-to-editor">${ic('fileedit', 'i-sm')}<span>${L('ส่งไปแก้ไข PDF', 'Open in Edit PDF')}</span></button>
      <button class="btn btn-primary" type="button" data-action="export-close">${L('เสร็จสิ้น', 'Done')}</button>`;
  }

  // ======================================================================
  // 9. History
  // ======================================================================
  function dayKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  function dayLabel(ts) {
    const now = new Date(); const d = new Date(ts);
    if (dayKey(ts) === dayKey(now)) return L('วันนี้', 'Today');
    const y = new Date(now); y.setDate(now.getDate() - 1); if (dayKey(ts) === dayKey(y)) return L('เมื่อวาน', 'Yesterday');
    return lang === 'en' ? `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}` : `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  const timeStr = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function renderHistory() {
    const q = ($('#inHistSearch').value || '').trim().toLowerCase();
    const list = historyList.filter((h) => !q || `${h.fileNames.join(' ')} ${h.purposeText} ${h.outputPath} ${h.templateName}`.toLowerCase().includes(q));
    if (!list.length) { $('#histList').innerHTML = `<div class="empty-list">${historyList.length ? L('ไม่พบรายการที่ค้นหา', 'Nothing matches your search') : L('ยังไม่มีประวัติ สร้าง PDF ครั้งแรกแล้วรายการจะแสดงที่นี่', 'No history yet. Your first certified PDF will show up here.')}</div>`; return; }
    let last = ''; let html = '';
    for (const h of list) {
      const dl = dayLabel(h.createdAt); if (dl !== last) { html += `<div class="h-day">${esc(dl)}</div>`; last = dl; }
      html += `<article class="h-item">
        <div class="h-top"><span class="when">${timeStr(h.createdAt)}</span><span class="badge badge-ok tnum">${h.pageCount} ${L('หน้า', 'pages')}</span>${h.templateName ? `<span class="badge">${ic('stamp', 'i-sm')}${esc(h.templateName)}</span>` : ''}</div>
        <div class="h-purpose">${esc(h.purposeText)}</div>
        <div class="h-files">${ic('file', 'i-sm')} ${esc(h.fileNames.join(', '))}</div>
        <div class="h-actions"><button class="btn btn-sm btn-soft" type="button" data-action="hist-reuse" data-id="${h.id}">${ic('refresh', 'i-sm')}<span>${L('ใช้ข้อความนี้อีกครั้ง', 'Use this wording again')}</span></button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="hist-delete" data-id="${h.id}">${ic('trash', 'i-sm')}<span>${L('ลบ', 'Delete')}</span></button></div>
      </article>`;
    }
    $('#histList').innerHTML = html;
  }
  function renderNavCounts() { $('#navHistCount').textContent = String(historyList.length); $('#navEdCount').textContent = String(ed.items.length); }

  // ======================================================================
  // 10. Library (templates + signatures)
  // ======================================================================
  let libTab = 'tpl';
  function renderLibrary() {
    $$('#libSeg [data-lib]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lib === libTab)));
    $('#libTpl').hidden = libTab !== 'tpl'; $('#libSig').hidden = libTab !== 'sig';
    if (libTab === 'tpl') renderTplGrid(); else renderSigGrid();
  }
  function renderTplGrid() {
    if (!templates.length) { $('#tplGrid').innerHTML = `<div class="empty-list">${L('ยังไม่มีเทมเพลต', 'No templates yet')}</div>`; return; }
    $('#tplGrid').innerHTML = templates.map((t) => `<article class="tpl-card${t.id === defaultTplId ? ' is-default' : ''}">
      <div class="tpl-preview"><canvas data-tpl="${t.id}" width="10" height="10"></canvas></div>
      <div class="tpl-body"><div class="tpl-name">${esc(t.name)}${t.id === defaultTplId ? `<span class="badge badge-accent">${ic('star', 'i-sm')}${L('ค่าเริ่มต้น', 'Default')}</span>` : ''}${t.id === st.tplActive ? `<span class="badge badge-ok">${L('กำลังใช้', 'In use')}</span>` : ''}</div>
        <div class="tpl-meta">${esc(t.s.font)} · ${esc(t.s.color)} · ${Math.round(t.s.angle)}° · ${Math.round(t.s.stampScale * 100)}%</div>
        <div class="btn-row"><button class="btn btn-sm btn-primary" type="button" data-action="tpl-use" data-id="${t.id}">${L('ใช้งาน', 'Use')}</button>
          <button class="btn btn-sm" type="button" data-action="tpl-default" data-id="${t.id}"${t.id === defaultTplId ? ' disabled' : ''}>${L('ตั้งเป็นค่าเริ่มต้น', 'Make default')}</button>
          <button class="btn btn-sm btn-soft" type="button" data-action="tpl-update" data-id="${t.id}">${L('อัปเดตจากค่าปัจจุบัน', 'Update from current')}</button>
          <button class="btn btn-sm btn-ghost" type="button" data-action="tpl-delete" data-id="${t.id}" aria-label="${L('ลบ', 'Delete')}">${ic('trash', 'i-sm')}</button></div></div>
    </article>`).join('');
    $$('#tplGrid canvas[data-tpl]').forEach(async (cv) => {
      const t = templates.find((x) => x.id === cv.dataset.tpl); if (!t) return;
      const s = Object.assign({}, DEFAULTS, t.s, { sigId: S.sigId });
      const stamp = await buildStamp(s, {}, 1);
      const w = 300; const h = Math.round((w * stamp.height) / stamp.width);
      cv.width = w * 2; cv.height = h * 2; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      const x = cv.getContext('2d'); x.globalAlpha = t.s.opacity || 0.85; x.drawImage(stamp, 0, 0, cv.width, cv.height);
    });
  }
  function renderSigGrid() {
    $('#sigGrid').innerHTML = sigs.length ? sigs.map((g) => `<article class="sig-tile"><div class="sig-face"><img alt="" src="${g.dataUrl}"></div>
      <div class="sig-tile-body"><div class="sig-tile-name">${esc(g.name)}${g.id === S.sigId ? `<span class="badge badge-ok">${L('กำลังใช้', 'In use')}</span>` : ''}</div>
      <div class="btn-row"><button class="btn btn-sm btn-primary" type="button" data-action="sig-use" data-id="${g.id}"${g.id === S.sigId ? ' disabled' : ''}>${L('ใช้', 'Use')}</button>
      <button class="btn btn-sm" type="button" data-action="sig-rename" data-id="${g.id}">${L('เปลี่ยนชื่อ', 'Rename')}</button>
      <button class="btn btn-sm btn-ghost" type="button" data-action="sig-delete" data-id="${g.id}" aria-label="${L('ลบ', 'Delete')}">${ic('trash', 'i-sm')}</button></div></div></article>`).join('')
      : `<div class="empty-list">${L('ยังไม่มีลายเซ็น', 'No signatures yet')}</div>`;
  }

  // ======================================================================
  // 11. Edit PDF board
  // ======================================================================
  const ed = { items: [], sel: new Set(), undo: [], anchor: null, quality: 'bank', size: 'original', outName: '', result: null, busy: false, thumbs: new Map(), rangeOpen: false };
  const Q = { original: { kb: 250, th: 'ต้นฉบับ', en: 'Original', dth: 'ไม่บีบอัด คมชัดสุด', den: 'No compression, sharpest' },
    high: { kb: 175, th: 'คมชัดสูง', en: 'High', dth: '~180 DPI ลดขนาดปานกลาง', den: '~180 DPI, moderate saving' },
    bank: { kb: 112, th: 'มาตรฐานส่งธนาคาร', en: 'Bank standard', dth: '~140 DPI ตัวเลขยังชัด', den: '~140 DPI, numbers stay sharp', rec: true },
    small: { kb: 64, th: 'ขนาดเล็กพิเศษ', en: 'Extra small', dth: '~105 DPI สำหรับเว็บจำกัด 1–2 MB', den: '~105 DPI for 1–2 MB upload limits' } };
  const edItem = (page, name, num) => ({ id: uid('ep'), page, rot: 0, ann: [], name, num, v: 0 });
  const edSnap = () => ed.items.map((it) => ({ ...it, ann: JSON.parse(JSON.stringify(it.ann)) }));
  function edPush() { ed.undo.push(edSnap()); if (ed.undo.length > 40) ed.undo.shift(); $('#btnEdUndo').disabled = false; ed.result = null; }
  function edUndo() { const s = ed.undo.pop(); if (!s) return; ed.items = s; ed.items.forEach((it) => { it.v++; }); ed.sel.clear(); $('#btnEdUndo').disabled = !ed.undo.length; renderBoard(); toast(L('ย้อนกลับแล้ว', 'Undone'), { ms: 1200 }); }

  function renderAnnotations(ctx, W, H, list) {
    for (const a of list) {
      ctx.save();
      const lw = Math.max(1, (a.size * W) / 500);
      ctx.strokeStyle = a.color; ctx.fillStyle = a.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = lw;
      if (a.type === 'pen' || a.type === 'highlight') {
        if (a.type === 'highlight') { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.38; ctx.lineWidth = lw * 3.4; }
        const p = a.pts; ctx.beginPath(); ctx.moveTo(p[0][0] * W, p[0][1] * H);
        if (p.length < 3) { p.forEach((q) => ctx.lineTo(q[0] * W + 0.01, q[1] * H)); }
        else { for (let i = 1; i < p.length - 1; i++) { const mx = ((p[i][0] + p[i + 1][0]) / 2) * W; const my = ((p[i][1] + p[i + 1][1]) / 2) * H; ctx.quadraticCurveTo(p[i][0] * W, p[i][1] * H, mx, my); } ctx.lineTo(p[p.length - 1][0] * W, p[p.length - 1][1] * H); }
        ctx.stroke();
      } else if (a.type === 'line' || a.type === 'arrow') {
        const x1 = a.x1 * W; const y1 = a.y1 * H; const x2 = a.x2 * W; const y2 = a.y2 * H;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (a.type === 'arrow') { const ang = Math.atan2(y2 - y1, x2 - x1); const hl = Math.max(10, lw * 4.2); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45)); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45)); ctx.stroke(); }
      } else if (a.type === 'rect' || a.type === 'ellipse' || a.type === 'poly') {
        // hl = shape made from a highlighter stroke: keep the translucent marker look
        if (a.hl) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.38; ctx.lineWidth = lw * 3.4; }
        ctx.beginPath();
        if (a.type === 'poly') { a.pts.forEach((p, i) => (i ? ctx.lineTo(p[0] * W, p[1] * H) : ctx.moveTo(p[0] * W, p[1] * H))); ctx.closePath(); }
        else {
          const x = Math.min(a.x1, a.x2) * W; const y = Math.min(a.y1, a.y2) * H; const w = Math.abs(a.x2 - a.x1) * W; const h = Math.abs(a.y2 - a.y1) * H;
          if (a.type === 'rect') ctx.rect(x, y, w, h); else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        }
        if (a.fill === 'tint') { const g = ctx.globalAlpha; ctx.globalAlpha = g * (a.hl ? 0.5 : 0.2); ctx.fill(); ctx.globalAlpha = g; } else if (a.fill === 'solid') ctx.fill();
        ctx.stroke();
      } else if (a.type === 'text') {
        const fs = (((12 + a.size * 2.6) * W) / 500) * fscale(a.font); ctx.font = `${a.bold ? 700 : 400} ${fs}px "${a.font}", "Sarabun", sans-serif`; ctx.textBaseline = 'top';
        const lines = String(a.text).split('\n'); const lh = fs * 1.35; const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
        if (a.bg !== 'none') { ctx.fillStyle = a.bg === 'yellow' ? 'rgba(253,224,71,0.85)' : 'rgba(255,255,255,0.92)'; ctx.fillRect(a.x * W - fs * 0.25, a.y * H - fs * 0.15, tw + fs * 0.5, lines.length * lh + fs * 0.2); ctx.fillStyle = a.color; }
        lines.forEach((l, i) => ctx.fillText(l, a.x * W, a.y * H + i * lh));
      } else if (a.type === 'blur') {
        const x = Math.round(Math.min(a.x1, a.x2) * W); const y = Math.round(Math.min(a.y1, a.y2) * H); const w = Math.max(2, Math.round(Math.abs(a.x2 - a.x1) * W)); const h = Math.max(2, Math.round(Math.abs(a.y2 - a.y1) * H));
        if (a.mode === 'solid') { ctx.fillStyle = '#0b0b0b'; ctx.fillRect(x, y, w, h); }
        else {
          const block = a.mode === 'mosaic' ? Math.max(6, W / 70) : Math.max(4, W / 160);
          const sw = Math.max(1, Math.round(w / block)); const sh = Math.max(1, Math.round(h / block)); const t = mkCanvas(sw, sh);
          t.getContext('2d').drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh);
          ctx.imageSmoothingEnabled = a.mode !== 'mosaic'; ctx.drawImage(t, 0, 0, sw, sh, x, y, w, h);
        }
      }
      ctx.restore();
    }
  }
  function rotateCanvas(src, rot) {
    if (!rot) return src; const swap = rot % 180 !== 0;
    const c = mkCanvas(swap ? src.height : src.width, swap ? src.width : src.height); const x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.rotate((rot * Math.PI) / 180); x.drawImage(src, -src.width / 2, -src.height / 2); return c;
  }
  async function composeItem(it, useThumb = true) {
    const b = useThumb ? await it.page.getThumb() : await it.page.getBase();
    const c = mkCanvas(b.width, b.height); const x = c.getContext('2d'); x.drawImage(b, 0, 0); renderAnnotations(x, c.width, c.height, it.ann);
    return rotateCanvas(c, it.rot);
  }
  async function itemThumb(it) {
    const k = `${it.id}|${it.v}|${it.rot}`; const hit = ed.thumbs.get(it.id);
    if (hit && hit.k === k) return hit.c;
    const c = await composeItem(it, true); ed.thumbs.set(it.id, { k, c }); return c;
  }
  function renderBoard() {
    const b = $('#board'); $('#edEmpty').hidden = ed.items.length > 0;
    b.innerHTML = ed.items.map((it, i) => `<div class="pcard${ed.sel.has(it.id) ? ' sel' : ''}${dragState && dragState.id === it.id ? ' dragging' : ''}" role="button" tabindex="0" aria-pressed="${ed.sel.has(it.id)}" data-id="${it.id}">
      <div class="pthumb"><span class="pcheck">${ic('check')}</span><span class="ptags">${it.rot ? `<span class="ptag">${ic('rotate')}${it.rot}°</span>` : ''}${it.ann.length ? `<span class="ptag">${ic('pencil')}${it.ann.length}</span>` : ''}</span></div>
      <div class="pmeta"><b>${i + 1}</b><span>${esc(it.name)} · ${L('น.', 'p.')}${it.num}</span></div></div>`).join('');
    $$('.pcard', b).forEach(async (card) => {
      const it = ed.items.find((x) => x.id === card.dataset.id); if (!it) return;
      const c = await itemThumb(it); const holder = card.querySelector('.pthumb'); if (!holder || !holder.isConnected) return;
      const img = mkCanvas(c.width, c.height); img.getContext('2d').drawImage(c, 0, 0); holder.prepend(img);
    });
    renderEbar(); renderEdSummary(); renderEside(); renderNavCounts();
  }
  function renderSelection() { $$('#board .pcard').forEach((c) => { const on = ed.sel.has(c.dataset.id); c.classList.toggle('sel', on); c.setAttribute('aria-pressed', String(on)); }); renderEbar(); renderEdSummary(); renderEside(); }
  function renderEdSummary() {
    $('#edSummary').textContent = ed.items.length ? `${ed.items.length} ${L('หน้า', 'pages')}${ed.sel.size ? ` · ${L('เลือก', 'selected')} ${ed.sel.size}` : ''}` : L('ยังไม่มีหน้าเอกสาร', 'No pages yet');
    $('#btnEdSelAll span').textContent = ed.sel.size && ed.sel.size === ed.items.length ? L('ยกเลิกเลือก', 'Deselect') : L('เลือกทั้งหมด', 'Select all');
  }
  function renderEbar() {
    const n = ed.sel.size; const touch = matchMedia('(pointer: coarse)').matches;
    if (!n) {
      $('#ebar').innerHTML = `<div class="ebar-hint">${ed.items.length ? (touch ? L('แตะหน้าเพื่อเลือก · กดค้างแล้วลากเพื่อสลับลำดับ', 'Tap pages to select · press and hold, then drag to reorder') : L('คลิกเพื่อเลือก (Shift เลือกช่วง) · ลากเพื่อสลับลำดับ · ดับเบิลคลิกเพื่อวาด', 'Click to select (Shift for a range) · drag to reorder · double-click to draw')) : L('เพิ่มไฟล์เพื่อเริ่มต้น', 'Add files to begin')}</div>`;
      return;
    }
    $('#ebar').innerHTML = `
      <button class="act" type="button" data-action="ed-rotate">${ic('rotate')}<span>${L('หมุน 90°', 'Rotate')}</span></button>
      <button class="act" type="button" data-action="ed-annot"${n !== 1 ? ' disabled' : ''}>${ic('pencil')}<span>${L('วาด / ข้อความ', 'Draw / text')}</span></button>
      <button class="act" type="button" data-action="ed-extract">${ic('scissors')}<span>${L(`แยก ${n} หน้า`, `Extract ${n}`)}</span></button>
      <button class="act danger" type="button" data-action="ed-delete">${ic('trash')}<span>${L('ลบ', 'Delete')}</span></button>
      <button class="act" type="button" data-action="ed-clear-sel">${ic('x')}<span>${L('ยกเลิก', 'Clear')}</span></button>`;
  }
  function esideHtml() {
    const n = ed.items.length; const k = ed.sel.size; const q = Q[ed.quality];
    const r = ed.result;
    return `
      <div class="group"><div class="group-title"><span>${L('ความละเอียดและขนาดไฟล์', 'Quality & file size')}</span></div>
        <div class="q-cards">${Object.entries(Q).map(([key, v]) => `<button class="q-card" type="button" data-action="ed-q" data-id="${key}" aria-pressed="${key === ed.quality}"><span class="q-radio"></span><span class="q-text"><b>${L(v.th, v.en)}${v.rec ? `<span class="badge badge-ok">${L('แนะนำ', 'Recommended')}</span>` : ''}</b><small>${L(v.dth, v.den)} · ≈ ${fmtKB(v.kb * Math.max(1, n))}</small></span></button>`).join('')}</div></div>
      <div class="field"><label class="label" for="selEdSize">${L('ขนาดหน้ากระดาษ', 'Page size')}</label>
        <select class="select" id="selEdSize" data-ed="size"><option value="original"${ed.size === 'original' ? ' selected' : ''}>${L('คงขนาดเดิมของแต่ละหน้า', 'Keep each page’s size')}</option><option value="a4"${ed.size === 'a4' ? ' selected' : ''}>${L('ปรับเป็น A4 (ตามแนวหน้า)', 'Fit to A4 (keep orientation)')}</option><option value="a4-portrait"${ed.size === 'a4-portrait' ? ' selected' : ''}>${L('A4 แนวตั้งทุกหน้า', 'A4 portrait for all')}</option></select></div>
      <div class="field"><label class="label" for="inEdName">${L('ชื่อไฟล์ผลลัพธ์', 'Output file name')}</label><input class="input" id="inEdName" data-ed="name" type="text" value="${esc(ed.outName)}" placeholder="${L('รวมเอกสาร_2569.pdf', 'merged_2026.pdf')}"></div>
      <button class="btn btn-primary btn-block" type="button" data-action="ed-build-all"${!n || ed.busy ? ' disabled' : ''}>${ic('download')}<span>${ed.busy ? L('กำลังสร้าง…', 'Creating…') : L(`บันทึก / รวมทั้งหมด (${n} หน้า)`, `Save / merge all (${n} pages)`)}</span></button>
      <button class="btn btn-soft btn-block" type="button" data-action="ed-build-sel"${!k || ed.busy ? ' disabled' : ''}>${ic('scissors')}<span>${L(`แยกเฉพาะหน้าที่เลือก (${k} หน้า)`, `Extract selected (${k} pages)`)}</span></button>
      ${r ? `<div class="result-card"><div class="rc-title">${ic('check')}<span>${L('สร้างไฟล์แล้ว', 'File created')}</span></div><div class="rc-name">${esc(r.name)}</div><div class="hint">${r.pages} ${L('หน้า', 'pages')} · ${fmtKB(r.kb)} · ${L(q.th, q.en)}</div>
        <div class="btn-row"><button class="btn btn-sm btn-ok" type="button" data-action="ed-download">${ic('download', 'i-sm')}<span>${L('ดาวน์โหลด', 'Download')}</span></button><button class="btn btn-sm" type="button" data-action="ed-share">${ic('share', 'i-sm')}<span>${L('แชร์', 'Share')}</span></button></div>
        <button class="btn btn-sm btn-primary" type="button" data-action="ed-to-certify">${ic('stamp', 'i-sm')}<span>${L('ส่งไปรับรองสำเนาต่อ', 'Send to Certify')}</span></button></div>` : ''}`;
  }
  function renderEside() {
    const target = mq.wide.matches ? $('#esideInner') : ($('#edExportModal').classList.contains('open') ? $('#edExportBody') : null);
    $('#esideInner').innerHTML = ''; $('#edExportBody').innerHTML = '';
    if (!target) return;
    target.innerHTML = esideHtml();
    target.querySelectorAll('[data-ed]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { if (el.dataset.ed === 'size') ed.size = el.value; else ed.outName = el.value; }));
  }
  async function edBuild(selectedOnly) {
    const items = selectedOnly ? ed.items.filter((it) => ed.sel.has(it.id)) : ed.items.slice(); if (!items.length) return;
    ed.busy = true; renderEside();
    for (const it of items) { await it.page.getBase(); await sleep(60); }
    const name = (ed.outName.trim() || (selectedOnly ? L('หน้าที่แยกออก.pdf', 'extracted_pages.pdf') : L('รวมเอกสาร.pdf', 'merged.pdf'))).replace(/(\.pdf)?$/i, '.pdf');
    ed.result = { name, pages: items.length, kb: items.length * Q[ed.quality].kb, ids: items.map((x) => x.id) };
    ed.busy = false; renderEside(); toast(L('สร้างไฟล์ PDF แล้ว (จำลอง)', 'PDF created (simulated)'));
  }
  async function edImportFromCertify() {
    const pages = allPages().filter((p) => !p.excluded); if (!pages.length) { toast(L('หน้ารับรองสำเนายังไม่มีเอกสาร', 'Certify has no documents yet')); return; }
    const stamped = st.generated && !st.generated.outdated;
    edPush();
    for (const p of pages) {
      const f = fileOf(p);
      const page = stamped ? bakePage(p) : p;
      ed.items.push(edItem(page, f.name, p.idx + 1));
    }
    renderBoard(); toast(stamped ? L(`ดึง ${pages.length} หน้าที่ประทับตราแล้ว`, `Imported ${pages.length} stamped pages`) : L(`ดึง ${pages.length} หน้า (ยังไม่ประทับตรา)`, `Imported ${pages.length} pages (not stamped yet)`));
  }
  function bakePage(p) {
    const fake = { id: uid('f') };
    return mkPage(fake, p.idx, p.w, p.h, async () => {
      const b = await p.getBase(); const c = mkCanvas(b.width, b.height); const x = c.getContext('2d'); x.drawImage(b, 0, 0);
      const stamp = await stampFor(p); drawWatermark(x, c.width, c.height); drawStampOn(x, c.width, c.height, stamp, getPlacement(p.id)); return c;
    });
  }
  async function edSendToCertify() {
    const ids = ed.result ? ed.result.ids : ed.items.map((x) => x.id);
    const items = ids.map((id) => ed.items.find((x) => x.id === id)).filter(Boolean); if (!items.length) return;
    const f = { id: uid('f'), name: ed.result ? ed.result.name : L('รวมเอกสาร.pdf', 'merged.pdf'), kind: 'pdf', locked: false, pages: [] };
    const snap = items.map((it) => ({ ...it, ann: JSON.parse(JSON.stringify(it.ann)) }));
    snap.forEach((it, i) => { const swap = it.rot % 180 !== 0; f.pages.push(mkPage(f, i, swap ? it.page.h : it.page.w, swap ? it.page.w : it.page.h, () => composeItem(it, false), () => composeItem(it, true))); });
    st.files.push(f); st.activeId = f.pages[0].id; st.generated = null;
    location.hash = '#certify'; renderCertifyAll(); toast(L(`ส่ง ${f.pages.length} หน้าไปหน้ารับรองสำเนาแล้ว`, `Sent ${f.pages.length} pages to Certify`));
  }
  function parseRange(str, max) {
    const out = new Set();
    String(str).split(/[,\s]+/).filter(Boolean).forEach((part) => {
      const m = part.match(/^(\d+)(?:-(\d+))?$/); if (!m) return;
      let a = Number(m[1]); let b = m[2] ? Number(m[2]) : a; if (a > b) [a, b] = [b, a];
      for (let i = Math.max(1, a); i <= Math.min(max, b); i++) out.add(i);
    });
    return [...out];
  }

  // drag to reorder (mouse: drag; touch: press-and-hold then drag)
  let dragState = null; let pdState = null;
  function setupBoard() {
    const board = $('#board'); const wrap = $('#boardWrap');
    board.addEventListener('contextmenu', (e) => { if (e.target.closest('.pcard')) e.preventDefault(); });
    board.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.pcard'); if (!card || e.button > 0) return;
      pdState = { id: card.dataset.id, x: e.clientX, y: e.clientY, pid: e.pointerId, type: e.pointerType, shift: e.shiftKey, meta: e.metaKey || e.ctrlKey, timer: null };
      if (e.pointerType !== 'mouse') pdState.timer = setTimeout(() => { if (pdState) startDrag(pdState.x, pdState.y); }, 380);
    });
    window.addEventListener('pointermove', (e) => {
      if (!pdState || e.pointerId !== pdState.pid) return;
      const d = Math.hypot(e.clientX - pdState.x, e.clientY - pdState.y);
      if (!dragState) {
        if (pdState.type === 'mouse' && d > 6) startDrag(e.clientX, e.clientY);
        else if (pdState.type !== 'mouse' && d > 10) { clearTimeout(pdState.timer); pdState = null; }
        return;
      }
      moveDrag(e.clientX, e.clientY);
      const r = wrap.getBoundingClientRect();
      if (e.clientY < r.top + 60) wrap.scrollTop -= 14; else if (e.clientY > r.bottom - 60) wrap.scrollTop += 14;
    });
    const up = (e) => {
      if (!pdState || e.pointerId !== pdState.pid) return;
      clearTimeout(pdState.timer);
      if (dragState) endDrag(); else if (e.type === 'pointerup') tapCard(pdState.id, pdState.shift);
      pdState = null;
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    board.addEventListener('touchmove', (e) => { if (dragState) e.preventDefault(); }, { passive: false });
    board.addEventListener('dblclick', (e) => { const card = e.target.closest('.pcard'); if (card) openAnnot(ed.items.findIndex((x) => x.id === card.dataset.id)); });
    board.addEventListener('keydown', (e) => { const card = e.target.closest('.pcard'); if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapCard(card.dataset.id, e.shiftKey); } });
  }
  function tapCard(id, shift) {
    if (shift && ed.anchor) {
      const a = ed.items.findIndex((x) => x.id === ed.anchor); const b = ed.items.findIndex((x) => x.id === id);
      const [lo, hi] = a < b ? [a, b] : [b, a]; for (let i = lo; i <= hi; i++) ed.sel.add(ed.items[i].id);
    } else if (ed.sel.has(id)) ed.sel.delete(id); else ed.sel.add(id);
    ed.anchor = id; renderSelection();
  }
  function startDrag(x, y) {
    if (!pdState) return;
    dragState = { id: pdState.id, before: edSnap(), moved: false };
    const card = $(`#board .pcard[data-id="${pdState.id}"]`); if (card) card.classList.add('dragging');
    const g = document.createElement('div'); g.className = 'drag-ghost';
    const c = card?.querySelector('canvas'); if (c) { const cc = mkCanvas(c.width, c.height); cc.getContext('2d').drawImage(c, 0, 0); cc.style.width = '100%'; cc.style.display = 'block'; cc.style.borderRadius = '10px'; g.appendChild(cc); }
    document.body.appendChild(g); dragState.ghost = g;
    navigator.vibrate?.(12);
    moveDrag(x, y);
  }
  function moveDrag(x, y) {
    const g = dragState.ghost; g.style.left = `${x - 55}px`; g.style.top = `${y - 70}px`;
    const el = document.elementFromPoint(x, y); const card = el && el.closest('#board .pcard');
    if (!card || card.dataset.id === dragState.id) return;
    const from = ed.items.findIndex((it) => it.id === dragState.id); const to = ed.items.findIndex((it) => it.id === card.dataset.id);
    if (from < 0 || to < 0) return;
    const [m] = ed.items.splice(from, 1); ed.items.splice(to, 0, m); dragState.moved = true;
    renderBoard();
  }
  function endDrag() {
    dragState.ghost?.remove();
    if (dragState.moved) { ed.undo.push(dragState.before); $('#btnEdUndo').disabled = false; ed.result = null; }
    dragState = null; renderBoard();
  }

  // ======================================================================
  // 12. Annotate / draw / blur studio
  // ======================================================================
  const AN_COLORS = ['#ef4444', '#0d33bf', '#0f172a', '#16a34a', '#facc15', '#ffffff'];
  const an = { idx: 0, tool: 'select', color: '#ef4444', size: 4, fill: 'none', font: 'Sarabun', bold: false, bg: 'none', blur: 'blur', sel: null, cur: null, drag: null, undo: {}, redo: {}, zoom: 1, textAt: null, editId: null, base: null, disp: null, pc: null };
  const anItem = () => ed.items[an.idx];
  function openAnnot(idx) {
    if (idx < 0 || !ed.items[idx]) return;
    an.idx = idx; an.sel = null; an.cur = null; an.zoom = 1;
    $('#annot').classList.add('open'); loadAnnot();
  }
  async function loadAnnot() {
    const it = anItem(); an.base = await it.page.getBase();
    $('#anTitle').textContent = `${L('หน้า', 'Page')} ${an.idx + 1} / ${ed.items.length}`;
    layoutAnnot(); renderAnnot(); renderAnProps(); renderAnChrome();
  }
  function layoutAnnot() {
    const it = anItem(); if (!it || !an.base) return; const stage = $('#anStage'); const cv = $('#anCanvas');
    const swap = it.rot % 180 !== 0; const w0 = swap ? an.base.height : an.base.width; const h0 = swap ? an.base.width : an.base.height;
    const s = Math.min((stage.clientWidth - 32) / w0, (stage.clientHeight - 32) / h0) * an.zoom;
    const dw = Math.max(40, Math.floor(w0 * s)); const dh = Math.max(40, Math.floor(h0 * s)); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(dw * dpr); cv.height = Math.round(dh * dpr); cv.style.width = `${dw}px`; cv.style.height = `${dh}px`;
    an.disp = { dw, dh, dpr, swap };
  }
  function renderAnnot() {
    const it = anItem(); if (!it || !an.disp) return; const cv = $('#anCanvas');
    const PW = an.disp.swap ? cv.height : cv.width; const PH = an.disp.swap ? cv.width : cv.height;
    const pc = an.pc || (an.pc = document.createElement('canvas')); pc.width = PW; pc.height = PH;
    const px = pc.getContext('2d'); px.drawImage(an.base, 0, 0, PW, PH);
    renderAnnotations(px, PW, PH, an.cur ? [...it.ann, an.cur] : it.ann);
    const sel = it.ann.find((a) => a.id === an.sel);
    if (sel) { const b = annBox(sel); const pad = 6 * an.disp.dpr; px.save(); px.setLineDash([6 * an.disp.dpr, 4 * an.disp.dpr]); px.strokeStyle = '#1f4bff'; px.lineWidth = 1.6 * an.disp.dpr; px.strokeRect(b.x * PW - pad, b.y * PH - pad, b.w * PW + pad * 2, b.h * PH + pad * 2); px.restore(); }
    const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    x.translate(cv.width / 2, cv.height / 2); x.rotate((it.rot * Math.PI) / 180); x.drawImage(pc, -PW / 2, -PH / 2); x.setTransform(1, 0, 0, 1, 0, 0);
  }
  const renderAnnotSoon = rafThrottle(renderAnnot);
  function anPoint(e) {
    const r = $('#anCanvas').getBoundingClientRect(); const u = (e.clientX - r.left) / r.width; const v = (e.clientY - r.top) / r.height; const rot = anItem().rot;
    let x; let y; if (rot === 90) { x = v; y = 1 - u; } else if (rot === 180) { x = 1 - u; y = 1 - v; } else if (rot === 270) { x = 1 - v; y = u; } else { x = u; y = v; }
    return [clamp(x, 0, 1), clamp(y, 0, 1)];
  }
  function textSize(a) {
    const W = 1000; const asp = an.base ? an.base.height / an.base.width : 1.414; const fs = (((12 + a.size * 2.6) * W) / 500) * fscale(a.font);
    const m = mkCanvas(4, 4).getContext('2d'); m.font = `${a.bold ? 700 : 400} ${fs}px "${a.font}", "Sarabun", sans-serif`;
    const lines = String(a.text).split('\n'); a.w = Math.max(...lines.map((l) => m.measureText(l).width)) / W; a.h = (lines.length * fs * 1.35) / (W * asp);
  }
  function annBox(a) {
    if (a.pts) { const xs = a.pts.map((p) => p[0]); const ys = a.pts.map((p) => p[1]); const x0 = Math.min(...xs); const y0 = Math.min(...ys); return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; }
    if (a.type === 'text') return { x: a.x, y: a.y, w: a.w || 0.1, h: a.h || 0.03 };
    const x0 = Math.min(a.x1, a.x2); const y0 = Math.min(a.y1, a.y2); return { x: x0, y: y0, w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) };
  }
  function hitAnn(list, x, y) {
    const tol = 0.018;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i]; const b = annBox(a);
      if (x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol) return a;
    }
    return null;
  }
  function moveAnn(a, dx, dy) {
    if (a.pts) a.pts.forEach((p) => { p[0] += dx; p[1] += dy; });
    if (a.type === 'text') { a.x += dx; a.y += dy; }
    if ('x1' in a) { a.x1 += dx; a.x2 += dx; a.y1 += dy; a.y2 += dy; }
  }
  function anPush() { const id = anItem().id; (an.undo[id] = an.undo[id] || []).push(JSON.stringify(anItem().ann)); an.redo[id] = []; }
  function anChanged() { const it = anItem(); it.v++; ed.result = null; renderAnChrome(); }
  function anUndo() { const it = anItem(); const u = an.undo[it.id]; if (!u || !u.length) return; (an.redo[it.id] = an.redo[it.id] || []).push(JSON.stringify(it.ann)); it.ann = JSON.parse(u.pop()); an.sel = null; anChanged(); renderAnnot(); renderAnProps(); }
  function anRedo() { const it = anItem(); const r = an.redo[it.id]; if (!r || !r.length) return; (an.undo[it.id] = an.undo[it.id] || []).push(JSON.stringify(it.ann)); it.ann = JSON.parse(r.pop()); an.sel = null; anChanged(); renderAnnot(); renderAnProps(); }
  function renderAnChrome() {
    const it = anItem(); if (!it) return;
    $('#btnAnUndo').disabled = !(an.undo[it.id] && an.undo[it.id].length); $('#btnAnRedo').disabled = !(an.redo[it.id] && an.redo[it.id].length);
    $$('#anDock .tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === an.tool)));
  }
  function renderAnProps() {
    const it = anItem(); const sel = it && it.ann.find((a) => a.id === an.sel); const t = an.tool;
    const ref = t === 'select' ? sel : null;
    const color = ref ? ref.color : an.color; const size = ref ? ref.size : an.size;
    const showColor = (t !== 'select' && t !== 'blur') || (ref && ref.type !== 'blur');
    const isText = t === 'text' || (ref && ref.type === 'text');
    const parts = [];
    if (showColor) parts.push(`<div class="grp" role="group" aria-label="${L('สี', 'Colour')}">${AN_COLORS.map((c) => `<button class="dot" type="button" data-an-color="${c}" style="background:${c}" aria-pressed="${c === color}" aria-label="${c}"></button>`).join('')}<label class="color-pick" style="width:28px;height:28px">${ic('plus', 'i-sm')}<input type="color" data-an-color-custom value="${color}"></label></div>`);
    if (showColor) parts.push(`<span class="sep"></span><div class="grp"><span class="label" style="white-space:nowrap">${isText ? L('ขนาด', 'Size') : L('ความหนา', 'Width')}</span><input type="range" min="1" max="12" step="1" value="${size}" data-an-size aria-label="${L('ขนาด', 'Size')}"><span class="val" style="min-width:34px">${size}</span></div>`);
    if (t === 'rect' || t === 'ellipse' || (ref && (ref.type === 'rect' || ref.type === 'ellipse' || ref.type === 'poly'))) parts.push(`<span class="sep"></span><select class="select" data-an-fill aria-label="${L('การเติมสี', 'Fill')}"><option value="none"${(ref ? ref.fill : an.fill) === 'none' ? ' selected' : ''}>${L('เส้นขอบเท่านั้น', 'Outline')}</option><option value="tint"${(ref ? ref.fill : an.fill) === 'tint' ? ' selected' : ''}>${L('เติมสีโปร่ง', 'Tint')}</option><option value="solid"${(ref ? ref.fill : an.fill) === 'solid' ? ' selected' : ''}>${L('เติมสีทึบ', 'Solid')}</option></select>`);
    if (isText) {
      const f = ref ? ref.font : an.font; const b = ref ? ref.bold : an.bold; const bg = ref ? ref.bg : an.bg;
      parts.push(`<span class="sep"></span><select class="select" data-an-font aria-label="${L('ฟอนต์', 'Font')}">${BUILTIN_FONTS.map((b) => `<option value="${b.f}"${f === b.f ? ' selected' : ''}>${L(b.th, b.en)}</option>`).join('')}</select>
        <button class="icon-btn" type="button" data-an-bold aria-pressed="${b}" style="${b ? 'background:var(--accent-soft);color:var(--accent-fg)' : ''}" aria-label="${L('ตัวหนา', 'Bold')}">${ic('bold')}</button>
        <select class="select" data-an-bg aria-label="${L('พื้นหลัง', 'Background')}"><option value="none"${bg === 'none' ? ' selected' : ''}>${L('ไม่มีพื้นหลัง', 'No background')}</option><option value="white"${bg === 'white' ? ' selected' : ''}>${L('พื้นขาว', 'White')}</option><option value="yellow"${bg === 'yellow' ? ' selected' : ''}>${L('พื้นเหลือง', 'Yellow')}</option></select>`);
    }
    if (t === 'highlight') parts.push(`<span class="hint hint-inline"><span class="new">${L('ใหม่', 'New')}</span> ${L('วาดแล้วกดค้างไว้ครู่หนึ่ง (ยังไม่ยกนิ้ว/ปากกา) เส้นตรง สี่เหลี่ยม วงกลม สามเหลี่ยม จะกลายเป็นรูปทรงที่สวยงามเอง', 'Draw, then hold still before lifting: lines, boxes, circles and triangles snap into neat shapes')}</span>`);
    if (t === 'blur' || (ref && ref.type === 'blur')) {
      const m = ref ? ref.mode : an.blur;
      parts.push(`<div class="seg" style="min-width:260px">${[['blur', L('เบลอ', 'Blur')], ['mosaic', L('โมเสก', 'Mosaic')], ['solid', L('แถบทึบ', 'Redact')]].map(([v, l]) => `<button type="button" data-an-blur="${v}" aria-pressed="${m === v}">${l}</button>`).join('')}</div><span class="hint hint-inline">${L('ลากคลุมส่วนที่ต้องการปิด · ถาวรเมื่อสร้างไฟล์', 'Drag over what to hide · permanent in the PDF')}</span>`);
    }
    if (t === 'select') {
      if (sel) parts.push(`<span class="sep"></span>${sel.type === 'text' ? `<button class="btn btn-sm" type="button" data-action="an-edit-text">${ic('type', 'i-sm')}<span>${L('แก้ข้อความ', 'Edit text')}</span></button>` : ''}<button class="btn btn-sm btn-danger" type="button" data-action="an-delete">${ic('trash', 'i-sm')}<span>${L('ลบชิ้นที่เลือก', 'Delete')}</span></button>`);
      else parts.push(`<span class="hint hint-inline">${L('แตะชิ้นงานเพื่อเลือกและลากย้าย', 'Tap an item to select and move it')}</span>`);
      parts.push(`<span class="sep"></span><button class="icon-btn" type="button" data-action="an-zoom-out" aria-label="${L('ย่อ', 'Zoom out')}">${ic('zoom')}</button><button class="btn btn-sm btn-ghost" type="button" data-action="an-zoom-fit">${L('พอดีจอ', 'Fit')}</button><button class="btn btn-sm btn-ghost" type="button" data-action="an-zoom-in">${Math.round(an.zoom * 100)}% +</button>`);
      if (it && it.ann.length) parts.push(`<button class="btn btn-sm btn-ghost" type="button" data-action="an-clear" style="color:var(--bad)">${L('ล้างหน้านี้', 'Clear page')}</button>`);
    }
    $('#anProps').innerHTML = parts.join('');
  }
  function anApplyProp(fn) {
    const it = anItem(); const sel = an.tool === 'select' && it.ann.find((a) => a.id === an.sel);
    if (sel) { anPush(); fn(sel, true); if (sel.type === 'text') textSize(sel); anChanged(); renderAnnot(); } else fn(an, false);
    renderAnProps();
  }
  // Highlight "draw and hold": keep the finger/mouse still for a moment while drawing and the stroke becomes a straight line.
  // Keep holding and move to aim it; near-horizontal/vertical lines snap flat so they follow a line of text.
  const HOLD_MS = 450;
  function snapStraight(a, b) {
    const asp = an.base ? an.base.height / an.base.width : 1.414;
    const ang = Math.abs((Math.atan2((b[1] - a[1]) * asp, b[0] - a[0]) * 180) / Math.PI);
    if (ang < 6 || ang > 174) return [b[0], a[1]];
    if (Math.abs(ang - 90) < 6) return [a[0], b[1]];
    return [b[0], b[1]];
  }
  // --- shape recognition (all maths in an isotropic space: y scaled by page aspect) ---
  function convexHull(P) {
    const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  const polyArea = (Q) => Math.abs(Q.reduce((s, p, i) => { const q = Q[(i + 1) % Q.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function rdp(P, eps) {
    if (P.length < 3) return P.slice();
    const a = P[0]; const b = P[P.length - 1]; const L = dist(a, b) || 1e-9; let idx = 0; let dmax = 0;
    for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (d > dmax) { dmax = d; idx = i; } }
    if (dmax <= eps) return [a, b];
    return rdp(P.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(P.slice(idx), eps));
  }
  function sharpCorners(hull, eps) {
    const ring = rdp([...hull, hull[0]], eps).slice(0, -1); let n = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[(i - 1 + ring.length) % ring.length]; const q = ring[i]; const r = ring[(i + 1) % ring.length];
      let t = Math.abs(Math.atan2(r[1] - q[1], r[0] - q[0]) - Math.atan2(q[1] - p[1], q[0] - p[0])) * 180 / Math.PI; if (t > 180) t = 360 - t;
      if (t > 40) n++;
    }
    return n;
  }
  function maxTriangle(H) {
    let best = H.slice(0, 3); let A = -1;
    for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) for (let k = j + 1; k < H.length; k++) { const a = polyArea([H[i], H[j], H[k]]); if (a > A) { A = a; best = [H[i], H[j], H[k]]; } }
    return best;
  }
  function recognizeShape(pts) {
    const asp = an.base ? an.base.height / an.base.width : 1.414;
    const P = pts.map((p) => [p[0], p[1] * asp]); const back = (q) => [q[0], q[1] / asp];
    const xs = P.map((p) => p[0]); const ys = P.map((p) => p[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const w = maxX - minX; const h = maxY - minY; const diag = Math.hypot(w, h); if (diag < 0.025) return null;
    let len = 0; for (let i = 1; i < P.length; i++) len += dist(P[i - 1], P[i]);
    const closed = dist(P[0], P[P.length - 1]) < Math.max(0.25 * diag, 0.02) && len > 1.8 * diag;
    if (!closed) return { kind: 'line' };
    const hull = convexHull(P);
    if (Math.min(w, h) < 0.12 * Math.max(w, h) || hull.length < 3) {
      let a = hull[0]; let b = hull[0]; let d = -1; // thin back-and-forth stroke: line across its longest span
      for (let i = 0; i < hull.length; i++) for (let j = i + 1; j < hull.length; j++) { const dd = dist(hull[i], hull[j]); if (dd > d) { d = dd; a = hull[i]; b = hull[j]; } }
      return { kind: 'line', pts: [back(a), back(b)] };
    }
    const fill = polyArea(hull) / Math.max(1e-9, w * h);
    if (fill >= 0.84) return { kind: 'shape', a: { type: 'rect', x1: minX, y1: minY / asp, x2: maxX, y2: maxY / asp } };
    if (fill <= 0.62) {
      if (sharpCorners(hull, 0.06 * diag) >= 4) {
        const L0 = hull.reduce((m, p) => (p[0] < m[0] ? p : m)); const R0 = hull.reduce((m, p) => (p[0] > m[0] ? p : m));
        const T0 = hull.reduce((m, p) => (p[1] < m[1] ? p : m)); const B0 = hull.reduce((m, p) => (p[1] > m[1] ? p : m));
        return { kind: 'shape', a: { type: 'poly', pts: [T0, R0, B0, L0].map(back) } };
      }
      return { kind: 'shape', a: { type: 'poly', pts: maxTriangle(hull).map(back) } };
    }
    let rx = w / 2; let ry = h / 2; const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
    if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.15) { rx = (rx + ry) / 2; ry = rx; }
    return { kind: 'shape', a: { type: 'ellipse', x1: cx - rx, y1: (cy - ry) / asp, x2: cx + rx, y2: (cy + ry) / asp } };
  }
  function armStraighten(x, y) {
    clearTimeout(an.holdTimer); an.holdAt = [x, y];
    an.holdTimer = setTimeout(() => {
      const c = an.cur; if (!c || !c.pts || c.type !== 'highlight' || c.straight || c.shaped) return;
      const r = recognizeShape(c.pts); if (!r) return;
      if (r.kind === 'line') { const s = c.pts[0]; c.pts = r.pts || [s, snapStraight(s, c.pts[c.pts.length - 1])]; c.straight = !r.pts; if (r.pts) c.shaped = true; }
      else an.cur = { id: c.id, color: c.color, size: c.size, fill: 'none', hl: true, shaped: true, ...r.a };
      navigator.vibrate?.(10); renderAnnot();
    }, HOLD_MS);
  }
  function setupAnnot() {
    const cv = $('#anCanvas');
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const [x, y] = anPoint(e); const it = anItem();
      if (an.tool === 'select') {
        const hit = hitAnn(it.ann, x, y);
        if (hit && hit.id === an.sel && hit.type === 'text' && e.detail >= 2) { openTextBar(null, null, hit); return; }
        an.sel = hit ? hit.id : null;
        if (hit) { anPush(); an.drag = { x, y, moved: false }; }
        renderAnnot(); renderAnProps(); return;
      }
      if (an.tool === 'text') { openTextBar(x, y, null); return; }
      const base = { id: uid('a'), type: an.tool, color: an.color, size: an.size };
      clearTimeout(an.holdTimer); an.holdAt = null;
      if (an.tool === 'pen' || an.tool === 'highlight') an.cur = { ...base, pts: [[x, y]] };
      else if (an.tool === 'blur') an.cur = { ...base, mode: an.blur, x1: x, y1: y, x2: x, y2: y };
      else an.cur = { ...base, fill: an.fill, x1: x, y1: y, x2: x, y2: y };
      renderAnnot();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!an.drag && !an.cur) return; const [x, y] = anPoint(e);
      if (an.drag) { const a = anItem().ann.find((q) => q.id === an.sel); if (a) { moveAnn(a, x - an.drag.x, y - an.drag.y); an.drag.x = x; an.drag.y = y; an.drag.moved = true; renderAnnotSoon(); } return; }
      if (an.cur.shaped) return;
      if (an.cur.pts) {
        if (an.cur.straight) an.cur.pts[1] = snapStraight(an.cur.pts[0], [x, y]);
        else {
          an.cur.pts.push([x, y]);
          if (an.cur.type === 'highlight' && (!an.holdAt || Math.hypot(x - an.holdAt[0], y - an.holdAt[1]) > 0.006)) armStraighten(x, y);
        }
      } else { an.cur.x2 = x; an.cur.y2 = y; }
      renderAnnotSoon();
    });
    const up = () => {
      const it = anItem(); if (!it) return;
      clearTimeout(an.holdTimer); an.holdAt = null;
      if (an.cur) { delete an.cur.straight; delete an.cur.shaped; }
      if (an.drag) { if (!an.drag.moved) an.undo[it.id].pop(); else anChanged(); an.drag = null; }
      if (an.cur) {
        const c = an.cur; an.cur = null;
        const big = c.pts ? c.pts.length > 1 : Math.hypot(c.x2 - c.x1, c.y2 - c.y1) > 0.01;
        if (big) { anPush(); it.ann.push(c); anChanged(); }
      }
      renderAnnot(); renderAnChrome();
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    $('#anDock').addEventListener('click', (e) => { const b = e.target.closest('.tool'); if (!b) return; an.tool = b.dataset.tool; if (an.tool !== 'select') an.sel = null; closeTextBar(); renderAnChrome(); renderAnProps(); renderAnnot(); });
    $('#anProps').addEventListener('click', (e) => {
      const c = e.target.closest('[data-an-color]'); if (c) { anApplyProp((o) => { o.color = c.dataset.anColor; }); return; }
      const bb = e.target.closest('[data-an-bold]'); if (bb) { anApplyProp((o) => { o.bold = !o.bold; }); return; }
      const bl = e.target.closest('[data-an-blur]'); if (bl) { anApplyProp((o, isAnn) => { if (isAnn) o.mode = bl.dataset.anBlur; else o.blur = bl.dataset.anBlur; }); }
    });
    $('#anProps').addEventListener('input', (e) => {
      if (e.target.matches('[data-an-size]')) { const v = Number(e.target.value); e.target.nextElementSibling.textContent = String(v); const it = anItem(); const sel = an.tool === 'select' && it.ann.find((a) => a.id === an.sel); if (sel) { sel.size = v; if (sel.type === 'text') textSize(sel); renderAnnotSoon(); } else an.size = v; }
      if (e.target.matches('[data-an-color-custom]')) { const v = e.target.value; const it = anItem(); const sel = an.tool === 'select' && it.ann.find((a) => a.id === an.sel); if (sel) { sel.color = v; renderAnnotSoon(); } else an.color = v; }
    });
    $('#anProps').addEventListener('change', (e) => {
      if (e.target.matches('[data-an-size]')) { const it = anItem(); if (an.tool === 'select' && it.ann.find((a) => a.id === an.sel)) anChanged(); }
      if (e.target.matches('[data-an-fill]')) anApplyProp((o) => { o.fill = e.target.value; });
      if (e.target.matches('[data-an-font]')) anApplyProp((o) => { o.font = e.target.value; });
      if (e.target.matches('[data-an-bg]')) anApplyProp((o) => { o.bg = e.target.value; });
    });
  }
  function openTextBar(x, y, existing) {
    an.textAt = existing ? null : [x, y]; an.editId = existing ? existing.id : null;
    $('#anTextBar').hidden = false; const ta = $('#anTextInput'); ta.value = existing ? existing.text : ''; setTimeout(() => ta.focus(), 30);
  }
  function closeTextBar() { $('#anTextBar').hidden = true; an.textAt = null; an.editId = null; }
  function applyTextBar() {
    const txt = $('#anTextInput').value.replace(/\s+$/, ''); const it = anItem();
    if (!txt) { closeTextBar(); return; }
    anPush();
    if (an.editId) { const a = it.ann.find((q) => q.id === an.editId); if (a) { a.text = txt; textSize(a); } }
    else if (an.textAt) { const a = { id: uid('a'), type: 'text', text: txt, x: an.textAt[0], y: an.textAt[1], color: an.color, size: an.size, font: an.font, bold: an.bold, bg: an.bg }; textSize(a); it.ann.push(a); an.sel = a.id; an.tool = 'select'; }
    anChanged(); closeTextBar(); renderAnnot(); renderAnProps(); renderAnChrome();
  }
  function closeAnnot() { $('#annot').classList.remove('open'); closeTextBar(); an.sel = null; renderBoard(); }

  // ======================================================================
  // 13. Signature pad
  // ======================================================================
  const pad = { strokes: [], cur: null };
  function openDraw() {
    $('#inSigName').value = ''; pad.strokes = []; openModal('#drawModal');
    requestAnimationFrame(() => { sizePad(); drawPad(); });
  }
  function sizePad() { const c = $('#padCanvas'); const r = c.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2); c.width = Math.max(10, Math.round(r.width * dpr)); c.height = Math.max(10, Math.round(r.height * dpr)); }
  function drawPad() {
    const c = $('#padCanvas'); const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    x.strokeStyle = '#18213a'; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const s of [...pad.strokes, ...(pad.cur ? [pad.cur] : [])]) {
      for (let i = 1; i < s.length; i++) { const a = s[i - 1]; const b = s[i]; x.lineWidth = Math.max(1.5, (b.p || 0.5) * 6) * (c.width / 640); x.beginPath(); x.moveTo(a.x * c.width, a.y * c.height); x.lineTo(b.x * c.width, b.y * c.height); x.stroke(); }
    }
  }
  function setupPad() {
    const c = $('#padCanvas');
    const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, p: e.pressure && e.pointerType === 'pen' ? e.pressure : 0.55 }; };
    c.addEventListener('pointerdown', (e) => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } pad.cur = [pt(e)]; });
    c.addEventListener('pointermove', (e) => { if (!pad.cur) return; pad.cur.push(pt(e)); drawPad(); });
    const up = () => { if (pad.cur) { if (pad.cur.length > 1) pad.strokes.push(pad.cur); pad.cur = null; drawPad(); } };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  function savePad() {
    if (!pad.strokes.length) { toast(L('ยังไม่ได้เซ็นชื่อ', 'Please sign first')); return; }
    const src = $('#padCanvas'); const out = trimCanvas(src);
    const g = { id: uid('sig'), name: $('#inSigName').value.trim() || L(`ลายเซ็น ${sigs.length + 1}`, `Signature ${sigs.length + 1}`), dataUrl: out.toDataURL('image/png'), kind: 'drawn' };
    sigs.push(g); saveSigs(); closeModal('#drawModal'); useSig(g.id); if (st.view === 'library') renderLibrary();
    toast(L('บันทึกลายเซ็นแล้ว', 'Signature saved'));
  }
  async function uploadSig(file) {
    try {
      const im = await fileToImage(file); const s = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = mkCanvas(im.naturalWidth * s, im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const raw = c.toDataURL('image/jpeg', 0.9);
      const g = { id: uid('sig'), name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || L('ลายเซ็นจากรูป', 'Photo signature'), raw, threshold: S.sigThreshold, kind: 'upload', dataUrl: await cleanSignature(raw, S.sigThreshold) };
      sigs.push(g); saveSigs(); useSig(g.id); setTab('sign'); if (st.view === 'library') renderLibrary();
      toast(L('ตัดพื้นหลังให้แล้ว ปรับความเข้มได้ที่แถบ “ลบพื้นหลังสีขาว”', 'Background removed. Fine-tune with “Remove white background”.'), { ms: 3600 });
    } catch (e) { toast(L('เปิดรูปลายเซ็นไม่ได้', 'Couldn’t open that image')); }
  }

  // ======================================================================
  // 14. Settings page, lock screen, account
  // ======================================================================
  function renderPrefs() {
    setBi($('#accTitle'), sec.signedIn ? 'เข้าสู่ระบบด้วย Google แล้ว' : 'ยังไม่ได้เข้าสู่ระบบ', sec.signedIn ? 'Signed in with Google' : 'Not signed in');
    setBi($('#accSub'), sec.signedIn ? 'ลายเซ็น เทมเพลต และประวัติซิงก์ข้ามอุปกรณ์' : 'ข้อมูลเก็บเฉพาะในเครื่องนี้', sec.signedIn ? 'Signatures, templates and history sync across devices' : 'Data stays on this device only');
    const b = $('#btnAcc'); b.innerHTML = sec.signedIn ? `${ic('logout', 'i-sm')}<span>${L('ออกจากระบบ', 'Sign out')}</span>` : `${ic('cloud', 'i-sm')}<span>${L('เข้าสู่ระบบด้วย Google', 'Sign in with Google')}</span>`;
    const on = !!sec.pin;
    $('#secBanner').className = `sec-banner ${on ? 'on' : 'off'}`;
    $('#secBanner').innerHTML = `<span class="sec-ico">${ic(on ? 'shield' : 'alert')}</span><div class="row-text"><b>${on ? L('PIN เปิดใช้งาน', 'PIN is on') : L('ยังไม่ได้ตั้ง PIN', 'No PIN yet')}</b><small>${on ? L('ลายเซ็นในเครื่องเข้ารหัส AES-256 และล็อกหน้าจออัตโนมัติ', 'Signatures on this device are AES-256 encrypted and the screen auto-locks') : L('ตั้ง PIN เพื่อเข้ารหัสลายเซ็นในเครื่อง และล็อกเมื่อลุกจากเครื่อง', 'Set a PIN to encrypt signatures on this device and lock when you step away')}</small>
      <div class="btn-row" style="margin-top:8px">${on ? `<button class="btn btn-sm" type="button" data-action="pin-open">${ic('key', 'i-sm')}<span>${L('เปลี่ยน PIN', 'Change PIN')}</span></button><button class="btn btn-sm btn-ghost" type="button" data-action="pin-remove">${L('เลิกใช้ PIN', 'Turn off PIN')}</button>` : `<button class="btn btn-sm btn-primary" type="button" data-action="pin-open">${ic('key', 'i-sm')}<span>${L('ตั้ง PIN', 'Set PIN')}</span></button>`}</div></div>`;
    $('#pinCurWrap').hidden = !on;
    $('#selAutoLock').value = String(sec.autoLock); $('#chkTabLeave').checked = sec.tabLeave; $('#chkSessionOnly').checked = sec.sessionOnly;
    renderSkinGrid();
    $('#odStatus').textContent = shareSt.odConnected ? L(`เชื่อมต่อแล้ว · บันทึกที่ ${odPath()}`, `Connected · saves to ${odPath()}`) : L('ยังไม่เชื่อมต่อ · เชื่อมต่อเพื่อบันทึกไฟล์ลง OneDrive จากหน้าแชร์ได้ทันที', 'Not connected · connect to save files to OneDrive straight from Share');
    $('#btnOd').innerHTML = shareSt.odConnected ? `<span>${L('ยกเลิกการเชื่อมต่อ', 'Disconnect')}</span>` : `${ic('cloud', 'i-sm')}<span>${L('เชื่อมต่อ', 'Connect')}</span>`;
    setBi($('#navAccountLabel'), sec.signedIn ? 'ซิงก์แล้ว' : 'ยังไม่เข้าสู่ระบบ', sec.signedIn ? 'Synced' : 'Not signed in');
    applyTheme();
  }
  function showLock(view) { st.lockView = view; st.pinEntry = ''; $('#lock').classList.add('open'); renderLock(); }
  function hideLock() { $('#lock').classList.remove('open'); st.lockView = null; }
  function renderLock() {
    const v = st.lockView; const card = $('#lockCard');
    if (v === 'signin') {
      card.innerHTML = `<span class="mark" aria-hidden="true">TC</span><h2>${L('ยืนยันตัวตนเจ้าของเอกสาร', 'Confirm it’s you')}</h2>
        <p>${L('ป้องกันผู้อื่นที่ใช้เครื่องนี้เปิดดูหรือนำลายเซ็นของคุณไปใช้ กรุณาเข้าสู่ระบบด้วยบัญชี Google ของคุณ', 'So nobody else on this computer can open TrueCopy or use your signature, sign in with your Google account.')}</p>
        <label class="row" style="text-align:left"><span class="row-text"><b style="font-size:13.5px">${L('จำการเข้าสู่ระบบเฉพาะแท็บนี้ (แนะนำ)', 'Remember me in this tab only (recommended)')}</b></span><input class="switch" type="checkbox" id="lockSession"${sec.sessionOnly ? ' checked' : ''}></label>
        <button class="btn btn-primary btn-block" type="button" data-action="lock-google">${ic('cloud')}<span>${L('เข้าสู่ระบบด้วย Google', 'Sign in with Google')}</span></button>
        ${sec.pin ? `<button class="btn btn-soft btn-block" type="button" data-action="lock-offline">${ic('unlock')}<span>${L('ปลดล็อกแบบออฟไลน์ด้วย PIN', 'Unlock offline with PIN')}</span></button>` : ''}
        <p class="hint">${L('ต้นแบบ: ปุ่มนี้จำลองการเข้าสู่ระบบ', 'Prototype: this button simulates sign-in')}</p>`;
    } else if (v === 'pinsetup') {
      card.innerHTML = `<span class="mark" aria-hidden="true">TC</span><h2>${L('ตั้ง PIN ป้องกันลายเซ็น', 'Protect your signature with a PIN')}</h2>
        <p>${L('PIN ใช้เข้ารหัสลายเซ็นในเครื่อง (AES-256) และล็อกหน้าจอเมื่อคุณลุกจากเครื่อง', 'The PIN encrypts signatures on this device (AES-256) and locks the screen when you step away.')}</p>
        <div class="field" style="text-align:left"><label class="label" for="lkPin1">${L('PIN 4–12 หลัก', 'PIN, 4–12 digits')}</label><input class="input" id="lkPin1" type="password" inputmode="numeric" maxlength="12" autocomplete="off"></div>
        <div class="field" style="text-align:left"><label class="label" for="lkPin2">${L('ยืนยัน PIN', 'Repeat PIN')}</label><input class="input" id="lkPin2" type="password" inputmode="numeric" maxlength="12" autocomplete="off"></div>
        <div class="field" style="text-align:left"><label class="label" for="lkAuto">${L('ล็อกอัตโนมัติเมื่อไม่ได้ใช้งาน', 'Auto-lock when idle')}</label><select class="select" id="lkAuto">${[1, 3, 5, 15, 30].map((m) => `<option value="${m}"${m === sec.autoLock ? ' selected' : ''}>${m} ${L('นาที', 'min')}${m === 5 ? L(' (แนะนำ)', ' (recommended)') : ''}</option>`).join('')}</select></div>
        <div class="lock-err" id="lkErr"></div>
        <button class="btn btn-primary btn-block" type="button" data-action="lock-save-pin">${ic('lock')}<span>${L('บันทึก PIN และเข้าใช้งาน', 'Save PIN and continue')}</span></button>
        <button class="btn btn-block" type="button" data-action="lock-skip">${L('ตั้งค่าภายหลัง', 'Later')}</button>`;
    } else if (v === 'unlock') {
      card.innerHTML = `<span class="mark" aria-hidden="true">TC</span><h2>${L('TrueCopy ถูกล็อกไว้', 'TrueCopy is locked')}</h2>
        <p>${L('กรอก PIN เพื่อปลดล็อกลายเซ็นและเอกสาร', 'Enter your PIN to unlock your signature and documents.')}</p>
        <div class="pin-dots" id="pinDots">${Array.from({ length: Math.max(4, sec.pin.length) }, (_, i) => `<i class="${i < st.pinEntry.length ? 'on' : ''}"></i>`).join('')}</div>
        <div class="lock-err" id="lkErr"></div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" type="button" data-action="key" data-id="${n}">${n}</button>`).join('')}
          <button class="key" type="button" data-action="key" data-id="del" aria-label="${L('ลบ', 'Delete')}">${ic('backspace')}</button><button class="key" type="button" data-action="key" data-id="0">0</button><button class="key ok" type="button" data-action="key" data-id="ok" aria-label="${L('ปลดล็อก', 'Unlock')}">${ic('check')}</button></div>
        <div class="lock-links"><button class="btn btn-sm btn-ghost" type="button" data-action="lock-forgot">${L('ลืม PIN? ยืนยันบัญชี Google เพื่อตั้งใหม่', 'Forgot PIN? Confirm your Google account to reset it')}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="lock-wipe" style="color:var(--bad)">${L('ออกจากระบบและล้างข้อมูลในเครื่อง', 'Sign out and wipe this device')}</button></div>`;
    }
  }
  function pinKey(k) {
    if (k === 'del') st.pinEntry = st.pinEntry.slice(0, -1);
    else if (k === 'ok') return checkPin();
    else if (st.pinEntry.length < 12) st.pinEntry += k;
    $$('#pinDots i').forEach((d, i) => d.classList.toggle('on', i < st.pinEntry.length));
    if (st.pinEntry.length === sec.pin.length) setTimeout(checkPin, 120);
    return null;
  }
  function checkPin() {
    if (st.pinEntry === sec.pin) { hideLock(); toast(L('ปลดล็อกแล้ว', 'Unlocked')); return; }
    st.pinEntry = ''; const d = $('#pinDots'); if (!d) return;
    d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); $$('#pinDots i').forEach((x) => x.classList.remove('on'));
    $('#lkErr').textContent = L('PIN ไม่ถูกต้อง ลองอีกครั้ง', 'Wrong PIN. Try again.');
  }
  function lockNow() { if (!sec.pin) { showLock('pinsetup'); return; } showLock('unlock'); }
  let idleTimer = null; let hiddenAt = 0;
  function resetIdle() { clearTimeout(idleTimer); if (!sec.pin || !sec.autoLock) return; idleTimer = setTimeout(() => { if (!st.lockView) showLock('unlock'); }, sec.autoLock * 60000); }
  ['pointerdown', 'keydown', 'wheel'].forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (sec.pin && sec.tabLeave && hiddenAt && Date.now() - hiddenAt > 60000 && !st.lockView) showLock('unlock');
  });

  // ======================================================================
  // 15. Modals, confirm, toast
  // ======================================================================
  function openModal(sel) { $(sel).classList.add('open'); }
  function closeModal(sel) { $(sel).classList.remove('open'); }
  function confirmBox({ title, body = '', ok, cancel, danger = false, input = null }) {
    return new Promise((resolve) => {
      $('#cfTitle').textContent = title; $('#cfBody').textContent = body;
      $('#cfIco').innerHTML = ic(danger ? 'alert' : input ? 'type' : 'info'); $('#cfIco').style.background = danger ? 'var(--bad-soft)' : ''; $('#cfIco').style.color = danger ? 'var(--bad)' : '';
      const okB = $('#cfOk'); const cB = $('#cfCancel'); okB.textContent = ok || L('ตกลง', 'OK'); cB.textContent = cancel || L('ยกเลิก', 'Cancel');
      okB.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
      let inp = null; $('#cfBody').parentElement.querySelector('.input')?.remove();
      if (input) { inp = document.createElement('input'); inp.className = 'input'; inp.type = input.type || 'text'; inp.value = input.value || ''; inp.placeholder = input.placeholder || ''; inp.style.marginTop = '10px'; $('#cfBody').after(inp); }
      openModal('#confirmModal'); setTimeout(() => (inp || okB).focus(), 40);
      const done = (v) => { closeModal('#confirmModal'); okB.onclick = null; cB.onclick = null; if (inp) inp.onkeydown = null; resolve(v); };
      okB.onclick = () => done(input ? inp.value : true); cB.onclick = () => done(input ? null : false);
      if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') done(inp.value); };
    });
  }
  let toastTimer = null;
  function toast(msg, opts = {}) {
    const t = $('#toast'); $('#toastMsg').textContent = msg; const b = $('#toastBtn');
    if (opts.action) { b.hidden = false; b.textContent = opts.action; b.onclick = () => { t.classList.remove('show'); opts.onAction?.(); }; t.classList.add('has-action'); }
    else { b.hidden = true; b.onclick = null; t.classList.remove('has-action'); }
    t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), opts.ms || 2600);
  }

  // password prompt (real PDFs + demo)
  let pwResolve = null;
  function askPassword(name, retry, hint = '') {
    return new Promise((resolve) => {
      pwResolve = resolve;
      $('#pwDesc').textContent = name; $('#pwErr').hidden = !retry; $('#pwHint').textContent = hint; $('#inPw').value = ''; $('#inPw').type = 'password';
      openModal('#pwModal'); setTimeout(() => $('#inPw').focus(), 50);
    });
  }
  function pwFinish(v) { closeModal('#pwModal'); const r = pwResolve; pwResolve = null; r?.(v); }
  async function demoLockedFile() {
    const name = L('ตัวอย่าง_รายการเดินบัญชี_มีรหัส.pdf', 'sample_statement_locked.pdf');
    let retry = false;
    for (;;) {
      const pw = await askPassword(name, retry, L('ต้นแบบ: รหัสคือ 1234', 'Prototype: the password is 1234'));
      if (pw == null) return;
      if (pw === '1234') break;
      retry = true;
    }
    const f = makeSampleFile(SAMPLE_FILES[1], { name, locked: true }); st.files.push(f); st.activeId = f.pages[0].id; st.generated = null;
    renderCertifyAll(); toast(L('ปลดล็อกและเพิ่มไฟล์แล้ว', 'Unlocked and added'));
  }

  // ======================================================================
  // 15b. Share sheet: LINE / email / OneDrive / other apps / save to device
  //   Real app plan: LINE, email and "other" open the device share sheet (Web Share API) with the PDFs attached;
  //   OneDrive uploads directly after a one-time Microsoft sign-in. In this prototype every hand-off is simulated.
  // ======================================================================
  const SHARE_TARGETS = [
    { id: 'line', icon: 'chat', cls: 't-line', th: 'LINE', en: 'LINE' },
    { id: 'mail', icon: 'mail', cls: 't-mail', th: 'อีเมล', en: 'Email' },
    { id: 'onedrive', icon: 'cloud', cls: 't-drive', th: 'OneDrive', en: 'OneDrive' },
    { id: 'other', icon: 'share', cls: 't-other', th: 'แอปอื่น ๆ', en: 'Other apps' },
    { id: 'save', icon: 'download', cls: 't-save', th: 'บันทึกลงเครื่อง', en: 'Save to device' }
  ];
  const OD_FOLDERS = [
    { id: 'TrueCopy', th: 'TrueCopy', en: 'TrueCopy', rec: true },
    { id: 'docs-bank', th: 'เอกสาร › ธนาคาร', en: 'Documents › Bank' },
    { id: 'desktop', th: 'เดสก์ท็อป', en: 'Desktop' }
  ];
  const shareSt = Object.assign({ last: null, odConnected: false, odFolder: 'TrueCopy', odMonthly: true }, store.get('share', {}));
  const saveShareSt = () => store.set('share', shareSt);
  let shareCtx = null;
  const monthFolder = () => { const d = new Date(); return `${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const odPath = () => { const f = OD_FOLDERS.find((x) => x.id === shareSt.odFolder) || OD_FOLDERS[0]; return `OneDrive › ${L(f.th, f.en)}${shareSt.odMonthly ? ` › ${monthFolder()}` : ''}`; };
  const isTouch = () => matchMedia('(pointer: coarse)').matches;
  const smallIco = (cls, icon) => `<span class="share-ico ${cls}" style="width:26px;height:26px;border-radius:8px">${ic(icon, 'i-sm')}</span>`;

  function openShare(files) {
    if (!files || !files.length) return;
    const line = resolvedLine();
    shareCtx = { files, msg: L(`เอกสารรับรองสำเนาถูกต้อง${line ? ` (${line})` : ''}`, `Certified true copy${line ? ` (${line})` : ''}`) };
    renderSharePick(); openModal('#shareModal');
  }
  function shareHead(icon, title, sub) { $('#shareIco').innerHTML = ic(icon); $('#shareTitle').textContent = title; $('#shareSub').textContent = sub; }
  function shareSummary() { const f = shareCtx.files; const kb = f.reduce((a, b) => a + (b.kb || 0), 0); return f.length === 1 ? `${f[0].name} · ${fmtKB(kb)}` : `${f.length} ${L('ไฟล์', 'files')} · ${fmtKB(kb)}`; }
  function shareFoot(html) { const ft = $('#shareFoot'); ft.hidden = !html; ft.innerHTML = html || ''; }
  function renderSharePick() {
    shareHead('share', L('แชร์ไฟล์', 'Share files'), shareSummary());
    const order = [...SHARE_TARGETS].sort((a, b) => (b.id === shareSt.last) - (a.id === shareSt.last));
    $('#shareBody').innerHTML = `
      <div class="share-grid">${order.map((t) => `<button class="share-t" type="button" data-action="share-to" data-id="${t.id}"><span class="share-ico ${t.cls}">${ic(t.icon)}</span><span>${L(t.th, t.en)}</span>${t.id === shareSt.last ? `<span class="badge badge-accent">${L('ล่าสุด', 'Last')}</span>` : ''}</button>`).join('')}</div>
      <div class="field"><label class="label" for="shareMsg">${L('ข้อความที่ส่งไปพร้อมไฟล์', 'Message sent with the file')}</label><textarea class="textarea" id="shareMsg" rows="2">${esc(shareCtx.msg)}</textarea></div>
      <p class="hint">${isTouch() ? L('ไฟล์ PDF จะแนบไปกับแอปที่เลือกให้เลย ไม่ต้องดาวน์โหลดก่อน', 'The PDF is attached to the app you pick. No need to download it first.') : L('บนคอมพิวเตอร์ ระบบจะเปิดเมนูแชร์ของ Windows หรือ Mac ถ้าเบราว์เซอร์ไม่รองรับ จะดาวน์โหลดไฟล์ให้แล้วเปิดแอปให้แนบเอง', 'On a computer the Windows or Mac share menu opens. If the browser can’t, the file downloads and the app opens for you to attach it.')}</p>`;
    shareFoot('');
  }
  function renderShareSent(id) {
    const t = SHARE_TARGETS.find((x) => x.id === id); const n = shareCtx.files.length;
    const how = {
      line: L('เมนูแชร์ของเครื่องจะเปิดขึ้นพร้อมแนบไฟล์และข้อความไว้แล้ว แตะ LINE แล้วเลือกแชทหรือกลุ่มที่จะส่ง', 'Your device’s share menu opens with the file and message attached. Tap LINE, then pick the chat or group.'),
      mail: L('เมนูแชร์จะเปิดพร้อมแนบไฟล์ แตะแอปอีเมล (Mail, Gmail, Outlook) หัวเรื่องและข้อความใส่ไว้ให้แล้ว ใส่แค่อีเมลผู้รับแล้วกดส่ง', 'The share menu opens with the file attached. Tap your mail app (Mail, Gmail, Outlook); subject and message are filled in, so just add the recipient.'),
      other: L('เลือกแอปใดก็ได้ในเมนูแชร์ของเครื่อง เช่น WhatsApp, Messenger หรือ Files', 'Pick any app in your device’s share menu, such as WhatsApp, Messenger or Files.')
    }[id];
    shareHead(t.icon, L(`ส่งไปที่ ${t.th}`, `Send to ${t.en}`), shareSummary());
    const apps = [['line', 'chat', 't-line', 'LINE'], ['mail', 'mail', 't-mail', L('อีเมล', 'Mail')], ['onedrive', 'cloud', 't-drive', 'OneDrive'], ['other', 'share', 't-other', 'WhatsApp'], ['files', 'folder', 't-save', 'Files']];
    $('#shareBody').innerHTML = `
      <div class="mock-sheet"><span class="label">${L('ตัวอย่างเมนูแชร์ที่จะเปิดขึ้น', 'The share menu you’ll see')}</span>
        <div class="mock-apps">${apps.map(([k, i, c, label]) => `<span class="mock-app${k === id ? ' on' : ''}"><span class="share-ico ${c}">${ic(i)}</span>${esc(label)}</span>`).join('')}</div></div>
      <p style="font-size:14px;color:var(--text-2)">${how}</p>
      <div class="done-hero">${ic('check')}<span>${L(`แนบ ${n} ไฟล์ให้แล้ว (ต้นแบบ: จำลอง)`, `${n} file(s) attached (prototype: simulated)`)}</span></div>`;
    shareFoot(`<button class="btn" type="button" data-action="share-back">${L('แชร์ที่อื่นอีก', 'Share elsewhere')}</button><button class="btn btn-primary" type="button" data-action="share-close">${L('เสร็จ', 'Done')}</button>`);
  }
  function renderOdConnect() {
    shareHead('cloud', L('บันทึกลง OneDrive', 'Save to OneDrive'), shareSummary());
    $('#shareBody').innerHTML = `
      <div class="card"><div class="row"><span class="share-ico t-drive">${ic('cloud')}</span><div class="row-text"><b>${L('เชื่อมต่อ OneDrive ครั้งแรก', 'Connect OneDrive once')}</b><small>${L('บันทึกไฟล์ลงโฟลเดอร์ของคุณโดยตรง ไม่ต้องดาวน์โหลดแล้วอัปโหลดเอง', 'Save straight into your folders, with no download and re-upload.')}</small></div></div></div>
      <ul class="about-list">
        <li>${L('เข้าสู่ระบบด้วยบัญชี Microsoft ครั้งเดียว ครั้งต่อไปกดบันทึกได้ทันที', 'Sign in with your Microsoft account once; after that it’s one tap.')}</li>
        <li>${L('TrueCopy อัปโหลดเฉพาะไฟล์ที่คุณกดบันทึก ไม่อ่านไฟล์อื่นใน OneDrive', 'TrueCopy only uploads the files you choose and doesn’t read anything else in your OneDrive.')}</li>
        <li>${L('ยกเลิกการเชื่อมต่อได้ทุกเมื่อในหน้าตั้งค่า', 'Disconnect any time in Settings.')}</li>
      </ul>`;
    shareFoot(`<button class="btn" type="button" data-action="share-back">${L('กลับ', 'Back')}</button><button class="btn btn-primary" type="button" data-action="od-connect">${ic('cloud', 'i-sm')}<span>${L('เชื่อมต่อบัญชี Microsoft', 'Connect Microsoft account')}</span></button>`);
  }
  function renderOdFolder() {
    shareHead('cloud', L('บันทึกลง OneDrive', 'Save to OneDrive'), shareSummary());
    $('#shareBody').innerHTML = `
      <div class="group"><div class="group-title"><span>${L('บันทึกไปที่โฟลเดอร์', 'Save to folder')}</span></div>
        <div class="q-cards">${OD_FOLDERS.map((f) => `<button class="q-card" type="button" data-action="od-folder" data-id="${f.id}" aria-pressed="${f.id === shareSt.odFolder}"><span class="q-radio"></span><span class="q-text"><b>${ic('folder', 'i-sm')}${L(f.th, f.en)}${f.rec ? `<span class="badge badge-ok">${L('แนะนำ', 'Recommended')}</span>` : ''}</b></span></button>`).join('')}</div></div>
      <div class="row"><div class="row-text"><b>${L('แยกโฟลเดอร์ย่อยตามเดือน', 'Sub-folder per month')}</b><small>${L(`เช่น ${monthFolder()} หาไฟล์ย้อนหลังง่าย`, `e.g. ${monthFolder()}, easy to find later`)}</small></div><input class="switch" type="checkbox" id="chkOdMonthly"${shareSt.odMonthly ? ' checked' : ''} aria-label="${L('แยกตามเดือน', 'Per month')}"></div>
      <div class="card"><span class="label">${L('ปลายทาง', 'Destination')}</span><span class="path-pill" id="odPath">${ic('folder', 'i-sm')}${esc(odPath())}</span></div>`;
    $('#chkOdMonthly').addEventListener('change', (e) => { shareSt.odMonthly = e.target.checked; saveShareSt(); $('#odPath').innerHTML = `${ic('folder', 'i-sm')}${esc(odPath())}`; });
    shareFoot(`<button class="btn" type="button" data-action="share-back">${L('กลับ', 'Back')}</button><button class="btn btn-primary" type="button" data-action="od-upload">${ic('upload', 'i-sm')}<span>${L(`อัปโหลด ${shareCtx.files.length} ไฟล์`, `Upload ${shareCtx.files.length} file(s)`)}</span></button>`);
  }
  async function odUpload() {
    const files = shareCtx.files; const total = files.reduce((a, b) => a + (b.kb || 100), 0); let done = 0;
    shareHead('cloud', L('กำลังอัปโหลดไป OneDrive…', 'Uploading to OneDrive…'), odPath());
    $('#shareBody').innerHTML = `<div class="progress"><i id="odBar"></i></div><div class="prog-meta"><span id="odText">…</span><span id="odPct">0%</span></div>`;
    shareFoot('');
    for (const [i, f] of files.entries()) {
      for (let s = 1; s <= 4; s++) {
        await sleep(110); if (!$('#odBar')) return;
        done += (f.kb || 100) / 4; $('#odBar').style.width = `${(done / total) * 100}%`; $('#odPct').textContent = `${Math.round((done / total) * 100)}%`; $('#odText').textContent = `${i + 1}/${files.length} · ${f.name}`;
      }
    }
    shareHead('check', L('บันทึกลง OneDrive แล้ว', 'Saved to OneDrive'), odPath());
    $('#shareBody').innerHTML = `
      <div class="done-hero">${ic('check')}<span>${L(`${files.length} ไฟล์อยู่ใน ${odPath()} (ต้นแบบ: จำลอง)`, `${files.length} file(s) in ${odPath()} (prototype: simulated)`)}</span></div>
      <div class="group"><div class="group-title"><span>${L('ส่งลิงก์ให้ผู้รับ (ดูได้อย่างเดียว แก้ไขไม่ได้)', 'Send a view-only link')}</span></div>
        <div class="btn-row"><button class="btn" type="button" data-action="share-link" data-id="line">${smallIco('t-line', 'chat')}<span>${L('ส่งลิงก์ทาง LINE', 'Link via LINE')}</span></button>
        <button class="btn" type="button" data-action="share-link" data-id="mail">${smallIco('t-mail', 'mail')}<span>${L('ส่งลิงก์ทางอีเมล', 'Link via email')}</span></button>
        <button class="btn" type="button" data-action="share-link" data-id="copy">${ic('link', 'i-sm')}<span>${L('คัดลอกลิงก์', 'Copy link')}</span></button></div></div>`;
    shareFoot(`<button class="btn" type="button" data-action="share-back">${L('แชร์ที่อื่นอีก', 'Share elsewhere')}</button><button class="btn btn-primary" type="button" data-action="share-close">${L('เสร็จ', 'Done')}</button>`);
  }

  // ======================================================================
  // 16. Navigation + actions
  // ======================================================================
  const VIEWS = ['certify', 'edit-pdf', 'history', 'library', 'preferences'];
  function route() { const h = (location.hash || '').replace('#', ''); setView(VIEWS.includes(h) ? h : 'certify'); }
  function setView(v) {
    st.view = v; $('#app').dataset.view = v; closeNav();
    $$('[data-nav]').forEach((a) => { if (a.dataset.nav === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (v === 'certify') { if (isStacked() && st.panelRatio) applyPanelH(st.panelRatio * viewH()); schedulePreview(); renderRecent(); }
    if (v === 'edit-pdf') renderBoard();
    if (v === 'history') renderHistory();
    if (v === 'library') renderLibrary();
    if (v === 'preferences') renderPrefs();
  }
  function openNav() { $('#app').classList.add('nav-open'); }
  function closeNav() { $('#app').classList.remove('nav-open'); }

  async function onAction(act, el) {
    const id = el.dataset.id;
    switch (act) {
      case 'open-nav': openNav(); break;
      case 'close-nav': closeNav(); break;
      case 'toggle-lang': lang = lang === 'th' ? 'en' : 'th'; store.set('lang', lang); applyLang(); rerenderLangDynamic(); break;
      case 'toggle-theme': theme = isDark() ? 'light' : 'dark'; store.set('theme', theme); applyTheme(); break;
      case 'lock-now': closeNav(); lockNow(); break;
      case 'pick-files': $('#fileInput').click(); break;
      case 'camera': $('#camInput').click(); break;
      case 'demo-locked': demoLockedFile(); break;
      case 'load-samples': st.files = makeSampleFiles(); st.activeId = st.files[0].pages[0].id; renderCertifyAll(); break;
      case 'toggle-exclude': { const pg = activePage(); if (!pg) break; pg.excluded = !pg.excluded; afterExclusion(); toast(pg.excluded ? L('นำหน้านี้ออกแล้ว', 'Page removed') : L('กู้คืนหน้านี้แล้ว', 'Page restored'), pg.excluded ? { action: L('เลิกทำ', 'Undo'), onAction: () => { pg.excluded = false; afterExclusion(); } } : {}); break; }
      case 'restore-all': allPages().forEach((p) => { p.excluded = false; }); afterExclusion(); toast(L('กู้คืนทุกหน้าแล้ว', 'All pages restored')); break;
      case 'file-go': { const f = st.files.find((x) => x.id === id); if (f) setActive(f.pages[0].id); break; }
      case 'file-remove': {
        const i = st.files.findIndex((x) => x.id === id); if (i < 0) break; const [f] = st.files.splice(i, 1);
        if (activePage() == null || f.pages.some((p) => p.id === st.activeId)) st.activeId = allPages()[0]?.id || null;
        st.generated = null; renderCertifyAll();
        toast(L(`นำ “${f.name}” ออกแล้ว`, `Removed “${f.name}”`), { action: L('เลิกทำ', 'Undo'), onAction: () => { st.files.splice(i, 0, f); renderCertifyAll(); } });
        break;
      }
      case 'tpl-new': $('#tplSaveForm').hidden = false; $('#inTplName').focus(); break;
      case 'tpl-cancel': $('#tplSaveForm').hidden = true; break;
      case 'tpl-save': case 'lib-tpl-save': {
        const inp = act === 'tpl-save' ? $('#inTplName') : $('#inLibTplName'); const name = inp.value.trim();
        if (!name) { inp.focus(); toast(L('ตั้งชื่อเทมเพลตก่อน', 'Name the template first')); break; }
        const t = tplFromCurrent(name); templates.push(t); st.tplActive = t.id; saveTemplates(); inp.value = ''; $('#tplSaveForm').hidden = true;
        renderTplChips(); if (st.view === 'library') renderLibrary(); toast(L('บันทึกเทมเพลตแล้ว', 'Template saved')); break;
      }
      case 'tpl-use': { const t = templates.find((x) => x.id === id); if (t) { applyTemplate(t); if (st.view === 'library') { location.hash = '#certify'; } } break; }
      case 'tpl-default': defaultTplId = id; saveTemplates(); renderLibrary(); renderTplChips(); toast(L('ตั้งเป็นค่าเริ่มต้นแล้ว', 'Set as default')); break;
      case 'tpl-update': { const t = templates.find((x) => x.id === id); if (!t) break; TPL_KEYS.forEach((k) => { t.s[k] = S[k]; }); saveTemplates(); renderLibrary(); toast(L('อัปเดตเทมเพลตแล้ว', 'Template updated')); break; }
      case 'tpl-delete': {
        const t = templates.find((x) => x.id === id); if (!t) break;
        if (await confirmBox({ title: L(`ลบเทมเพลต “${t.name}”?`, `Delete “${t.name}”?`), body: L('ลบแล้วกู้คืนไม่ได้', 'This can’t be undone.'), ok: L('ลบ', 'Delete'), danger: true })) {
          templates = templates.filter((x) => x.id !== id); if (defaultTplId === id) defaultTplId = null; if (st.tplActive === id) st.tplActive = null; saveTemplates(); renderLibrary(); renderTplChips();
        }
        break;
      }
      case 'recent-use': { const h = historyList.find((x) => x.id === id); if (h) { Object.assign(S, { purpose: h.purpose, org: h.org }); st.tplActive = null; renderTplChips(); renderRecent(); afterSettingsChange('*'); } break; }
      case 'date-today': { const d = new Date(); setS('dateValue', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); break; }
      case 'pick-font': $('#fontInput').click(); break;
      case 'reset-page': { const pg = activePage(); if (pg) { delete st.overrides[pg.id]; st.scope = 'all'; afterOverrideChange(); } break; }
      case 'apply-all': { const pg = activePage(); if (pg && st.overrides[pg.id]) { Object.assign(S, st.overrides[pg.id]); st.overrides = {}; st.scope = 'all'; afterOverrideChange(); toast(L('ใช้ตำแหน่งนี้กับทุกหน้าแล้ว', 'Applied to every page')); } break; }
      case 'sig-use': useSig(id); if (st.view === 'library') renderLibrary(); break;
      case 'sig-draw': openDraw(); break;
      case 'sig-upload': $('#sigInput').click(); break;
      case 'sig-rename': { const g = sigs.find((x) => x.id === id); if (!g) break; const v = await confirmBox({ title: L('เปลี่ยนชื่อลายเซ็น', 'Rename signature'), ok: L('บันทึก', 'Save'), input: { value: g.name } }); if (v && v.trim()) { g.name = v.trim().slice(0, 60); saveSigs(); renderLibrary(); renderSigRow(); } break; }
      case 'sig-delete': {
        const g = sigs.find((x) => x.id === id); if (!g) break;
        if (await confirmBox({ title: L(`ลบ “${g.name}”?`, `Delete “${g.name}”?`), body: L('ลายเซ็นนี้จะถูกลบจากทุกอุปกรณ์ที่ซิงก์', 'It will be removed from all synced devices.'), ok: L('ลบ', 'Delete'), danger: true })) {
          sigs = sigs.filter((x) => x.id !== id); saveSigs(); if (S.sigId === id) setS('sigId', sigs[0]?.id || null); renderLibrary(); renderSigRow();
        }
        break;
      }
      case 'check-fix': closeModal('#exportModal'); setTab(id); if (isStacked() && st.collapsed) setCollapsed(false); break;
      case 'export-close': closeModal('#exportModal'); break;
      case 'export-run': runExport(); break;
      case 'out-download': case 'out-zip': toast(L('ต้นแบบ: จำลองการดาวน์โหลดไฟล์', 'Prototype: download simulated')); break;
      case 'out-share': if (st.generated) openShare([st.generated.outputs[Number(id)]]); break;
      case 'out-share-all': if (st.generated) openShare(st.generated.outputs); break;
      case 'share-close': closeModal('#shareModal'); break;
      case 'share-back': renderSharePick(); break;
      case 'share-to': {
        const m = $('#shareMsg'); if (m) shareCtx.msg = m.value;
        shareSt.last = id; saveShareSt();
        if (id === 'save') { closeModal('#shareModal'); toast(L('ต้นแบบ: จำลองการบันทึกไฟล์ลงเครื่อง', 'Prototype: save to device simulated')); } else if (id === 'onedrive') { if (shareSt.odConnected) renderOdFolder(); else renderOdConnect(); } else renderShareSent(id);
        break;
      }
      case 'od-connect': shareSt.odConnected = true; saveShareSt(); toast(L('เชื่อมต่อ OneDrive แล้ว (จำลอง)', 'OneDrive connected (simulated)')); renderOdFolder(); break;
      case 'od-folder': shareSt.odFolder = id; saveShareSt(); renderOdFolder(); break;
      case 'od-upload': odUpload(); break;
      case 'skin-set': skin = id; store.set('skin', skin); applySkin(); renderSkinGrid(); { const k = SKINS.find((x) => x.id === id); toast(L(`เปลี่ยนเป็นสไตล์ “${k.th}” แล้ว`, `Switched to “${k.en}”`), { ms: 1600 }); } break;
      case 'od-toggle': shareSt.odConnected = !shareSt.odConnected; saveShareSt(); renderPrefs(); toast(shareSt.odConnected ? L('เชื่อมต่อ OneDrive แล้ว (จำลอง)', 'OneDrive connected (simulated)') : L('ยกเลิกการเชื่อมต่อ OneDrive แล้ว', 'OneDrive disconnected')); break;
      case 'share-link': toast(id === 'copy' ? L('คัดลอกลิงก์แล้ว (จำลอง)', 'Link copied (simulated)') : L(`ต้นแบบ: จำลองการเปิด ${id === 'line' ? 'LINE' : 'อีเมล'} พร้อมลิงก์ดูไฟล์`, `Prototype: opens ${id === 'line' ? 'LINE' : 'email'} with the link (simulated)`), { ms: 3000 }); break;
      case 'out-to-editor': closeModal('#exportModal'); await edImportFromCertify(); location.hash = '#edit-pdf'; break;
      case 'hist-reuse': { const h = historyList.find((x) => x.id === id); if (!h) break; Object.assign(S, { purpose: h.purpose || S.purpose, org: h.org || S.org, templateLine: h.templateLine || S.templateLine }); st.tplActive = null; afterSettingsChange('*'); location.hash = '#certify'; setTab('text'); toast(L('ใช้ข้อความจากประวัติแล้ว', 'Wording loaded from history')); break; }
      case 'hist-delete': historyList = historyList.filter((x) => x.id !== id); saveHistory(); renderHistory(); renderNavCounts(); renderRecent(); break;
      case 'hist-clear': if (historyList.length && await confirmBox({ title: L('ล้างประวัติทั้งหมด?', 'Clear all history?'), body: L('ลบจากทุกอุปกรณ์ที่ซิงก์ กู้คืนไม่ได้', 'Removed from every synced device. This can’t be undone.'), ok: L('ล้างทั้งหมด', 'Clear all'), danger: true })) { historyList = []; saveHistory(); renderHistory(); renderNavCounts(); renderRecent(); } break;
      // edit pdf
      case 'ed-add': $('#edFileInput').click(); break;
      case 'ed-import': edImportFromCertify(); break;
      case 'ed-select-all': if (ed.sel.size === ed.items.length) ed.sel.clear(); else ed.items.forEach((it) => ed.sel.add(it.id)); renderSelection(); break;
      case 'ed-range-toggle': ed.rangeOpen = !ed.rangeOpen; $('#rangePop').hidden = !ed.rangeOpen; if (ed.rangeOpen) $('#inRange').focus(); break;
      case 'ed-range-apply': { const nums = parseRange($('#inRange').value, ed.items.length); if (!nums.length) { toast(L('ระบุเลขหน้า เช่น 1, 3-5', 'Enter pages, e.g. 1, 3-5')); break; } ed.sel = new Set(nums.map((n) => ed.items[n - 1].id)); renderSelection(); toast(L(`เลือก ${nums.length} หน้า`, `${nums.length} pages selected`)); break; }
      case 'ed-rotate': edPush(); ed.items.forEach((it) => { if (ed.sel.has(it.id)) { it.rot = (it.rot + 90) % 360; it.v++; } }); renderBoard(); break;
      case 'ed-delete': { const n = ed.sel.size; edPush(); ed.items = ed.items.filter((it) => !ed.sel.has(it.id)); ed.sel.clear(); renderBoard(); toast(L(`ลบ ${n} หน้าแล้ว`, `Deleted ${n} page(s)`), { action: L('เลิกทำ', 'Undo'), onAction: edUndo }); break; }
      case 'ed-extract': if (mq.wide.matches) edBuild(true); else { openModal('#edExportModal'); renderEside(); } break;
      case 'ed-annot': { const sid = [...ed.sel][0]; openAnnot(ed.items.findIndex((x) => x.id === sid)); break; }
      case 'ed-clear-sel': ed.sel.clear(); renderSelection(); break;
      case 'ed-open-export': openModal('#edExportModal'); renderEside(); break;
      case 'ed-close-export': closeModal('#edExportModal'); renderEside(); break;
      case 'ed-q': ed.quality = id; renderEside(); break;
      case 'ed-build-all': edBuild(false); break;
      case 'ed-build-sel': edBuild(true); break;
      case 'ed-download': toast(L('ต้นแบบ: จำลองการดาวน์โหลดไฟล์', 'Prototype: download simulated')); break;
      case 'ed-share': if (ed.result) openShare([ed.result]); break;
      case 'ed-to-certify': closeModal('#edExportModal'); edSendToCertify(); break;
      // annotator
      case 'an-close': case 'an-done': closeAnnot(); break;
      case 'an-prev': if (an.idx > 0) { an.idx--; an.sel = null; closeTextBar(); loadAnnot(); } break;
      case 'an-next': if (an.idx < ed.items.length - 1) { an.idx++; an.sel = null; closeTextBar(); loadAnnot(); } break;
      case 'an-undo': anUndo(); break;
      case 'an-redo': anRedo(); break;
      case 'an-delete': { const it = anItem(); if (!an.sel) break; anPush(); it.ann = it.ann.filter((a) => a.id !== an.sel); an.sel = null; anChanged(); renderAnnot(); renderAnProps(); break; }
      case 'an-clear': { const it = anItem(); if (!it.ann.length) break; anPush(); it.ann = []; an.sel = null; anChanged(); renderAnnot(); renderAnProps(); toast(L('ล้างหน้านี้แล้ว', 'Page cleared'), { action: L('เลิกทำ', 'Undo'), onAction: anUndo }); break; }
      case 'an-edit-text': { const a = anItem().ann.find((q) => q.id === an.sel); if (a) openTextBar(null, null, a); break; }
      case 'an-text-ok': applyTextBar(); break;
      case 'an-text-cancel': closeTextBar(); break;
      case 'an-zoom-in': an.zoom = Math.min(3, an.zoom + 0.5); layoutAnnot(); renderAnnot(); renderAnProps(); break;
      case 'an-zoom-out': an.zoom = Math.max(1, an.zoom - 0.5); layoutAnnot(); renderAnnot(); renderAnProps(); break;
      case 'an-zoom-fit': an.zoom = 1; layoutAnnot(); renderAnnot(); renderAnProps(); break;
      // dialogs
      case 'pw-show': { const i = $('#inPw'); i.type = i.type === 'password' ? 'text' : 'password'; break; }
      case 'pw-skip': pwFinish(null); break;
      case 'pw-ok': pwFinish($('#inPw').value); break;
      case 'draw-cancel': closeModal('#drawModal'); break;
      case 'draw-clear': pad.strokes = []; drawPad(); break;
      case 'draw-save': savePad(); break;
      // settings + lock
      case 'acc-toggle': if (sec.signedIn) { sec.signedIn = false; saveSec(); renderPrefs(); renderSigRow(); toast(L('ออกจากระบบแล้ว', 'Signed out')); } else { showLock('signin'); } break;
      case 'pin-open': $('#pinForm').hidden = false; $('#pinErr').textContent = ''; ['#inPinCur', '#inPinNew', '#inPinNew2'].forEach((s) => { $(s).value = ''; }); (sec.pin ? $('#inPinCur') : $('#inPinNew')).focus(); break;
      case 'pin-cancel': $('#pinForm').hidden = true; break;
      case 'pin-save': {
        const cur = $('#inPinCur').value; const a = $('#inPinNew').value; const b = $('#inPinNew2').value; const err = $('#pinErr');
        if (sec.pin && cur !== sec.pin) { err.textContent = L('PIN ปัจจุบันไม่ถูกต้อง', 'Current PIN is wrong'); break; }
        if (!/^[0-9A-Za-z]{4,12}$/.test(a)) { err.textContent = L('PIN ต้องยาว 4–12 ตัว (ตัวเลขหรือตัวอักษร)', 'PIN must be 4–12 letters or digits'); break; }
        if (a !== b) { err.textContent = L('PIN ทั้งสองช่องไม่ตรงกัน', 'The two PINs don’t match'); break; }
        sec.pin = a; saveSec(); $('#pinForm').hidden = true; renderPrefs(); resetIdle(); toast(L('บันทึก PIN แล้ว', 'PIN saved')); break;
      }
      case 'pin-remove': { const v = await confirmBox({ title: L('เลิกใช้ PIN?', 'Turn off PIN?'), body: L('กรอก PIN ปัจจุบันเพื่อยืนยัน', 'Enter your current PIN to confirm.'), ok: L('เลิกใช้ PIN', 'Turn off'), danger: true, input: { type: 'password' } }); if (v == null) break; if (v !== sec.pin) { toast(L('PIN ไม่ถูกต้อง', 'Wrong PIN')); break; } sec.pin = ''; saveSec(); renderPrefs(); toast(L('เลิกใช้ PIN แล้ว', 'PIN turned off')); break; }
      case 'wipe': if (await confirmBox({ title: L('ล้างข้อมูลในเครื่องและออกจากระบบ?', 'Wipe this device and sign out?'), body: L('ลายเซ็น ประวัติ และการตั้งค่าในเครื่องนี้จะถูกลบ ข้อมูลบนคลาวด์ยังอยู่ เข้าสู่ระบบอีกครั้งเพื่อซิงก์กลับมา', 'Signatures, history and settings on this device are deleted. Cloud copies stay; sign in again to sync them back.'), ok: L('ล้างและออกจากระบบ', 'Wipe and sign out'), danger: true })) wipeDevice(); break;
      case 'install': toast(L('ต้นแบบ: จำลองการติดตั้งแอป', 'Prototype: install simulated')); break;
      case 'reset-defaults': if (await confirmBox({ title: L('คืนค่าตราประทับเริ่มต้น?', 'Reset the stamp to default?'), body: L('ลายเซ็นและเทมเพลตที่บันทึกไว้ไม่ถูกลบ', 'Saved signatures and templates are kept.'), ok: L('รีเซ็ต', 'Reset') })) { const keep = S.sigId; S = Object.assign({}, DEFAULTS, { sigId: keep }); st.overrides = {}; st.tplActive = null; afterSettingsChange('*'); renderCertifyAll(); renderTplChips(); toast(L('คืนค่าเริ่มต้นแล้ว', 'Reset to default')); } break;
      case 'demo-signin': showLock('signin'); break;
      case 'demo-reset': if (await confirmBox({ title: L('ล้างข้อมูลต้นแบบ?', 'Reset prototype data?'), body: L('ลบการตั้งค่า ลายเซ็น เทมเพลต และประวัติที่บันทึกในเบราว์เซอร์นี้ แล้วโหลดตัวอย่างใหม่', 'Clears settings, signatures, templates and history saved in this browser, then reloads the samples.'), ok: L('ล้างข้อมูล', 'Reset'), danger: true })) { store.clear(); location.hash = '#certify'; location.reload(); } break;
      case 'lock-google': sec.signedIn = true; sec.sessionOnly = !!$('#lockSession')?.checked; if (!sigs.length) seedData(true); saveSec(); renderPrefs(); renderSigRow(); if (sec.pin) showLock('unlock'); else showLock('pinsetup'); break;
      case 'lock-offline': showLock('unlock'); break;
      case 'lock-save-pin': {
        const a = $('#lkPin1').value; const b = $('#lkPin2').value; const err = $('#lkErr');
        if (!/^[0-9A-Za-z]{4,12}$/.test(a)) { err.textContent = L('PIN ต้องยาว 4–12 ตัว', 'PIN must be 4–12 characters'); break; }
        if (a !== b) { err.textContent = L('PIN ทั้งสองช่องไม่ตรงกัน', 'The two PINs don’t match'); break; }
        sec.pin = a; sec.autoLock = Number($('#lkAuto').value); saveSec(); hideLock(); renderPrefs(); resetIdle(); toast(L('ตั้ง PIN แล้ว', 'PIN set')); break;
      }
      case 'lock-skip': hideLock(); break;
      case 'lock-forgot': showLock('signin'); break;
      case 'lock-wipe': hideLock(); wipeDevice(); break;
      case 'key': pinKey(id); break;
      default: break;
    }
  }
  function afterExclusion() { st.generated = st.generated ? { ...st.generated, outdated: true } : null; renderSummary(); renderDocsPane(); renderStrip(); renderGenButton(); schedulePreview(); commitSoon(); }
  function wipeDevice() {
    sigs = []; historyList = []; saveSigs(); saveHistory(); sec.signedIn = false; sec.pin = ''; saveSec(); S.sigId = null;
    renderSigRow(); renderPrefs(); renderNavCounts(); renderRecent(); afterSettingsChange('*'); showLock('signin');
  }
  function rerenderLangDynamic() {
    renderCertifyAll(); renderSigRow(); renderTplChips(); renderRecent(); renderFontCards();
    if (st.view === 'edit-pdf') renderBoard(); else { renderEbar(); renderEdSummary(); }
    if (st.view === 'history') renderHistory(); if (st.view === 'library') renderLibrary(); if (st.view === 'preferences') renderPrefs();
    if (st.lockView) renderLock();
    if ($('#exportModal').classList.contains('open')) { const s = $('#exportModal').dataset.step; if (s === 'check') showCheck(); else if (s === 'done') showDone(); }
    if ($('#annot').classList.contains('open')) { loadAnnot(); }
  }

  // ======================================================================
  // 17. Seeds
  // ======================================================================
  function seedData(force = false) {
    if (!sigs || force) sigs = [{ id: 'sig_sample', name: L('ลายเซ็นตัวอย่าง', 'Sample signature'), dataUrl: sampleSignatureDataUrl(), kind: 'drawn' }];
    if (!templates || force) {
      const mk = (id, name, patch) => ({ id, name, createdAt: Date.now(), s: Object.assign(Object.fromEntries(TPL_KEYS.map((k) => [k, DEFAULTS[k]])), patch) });
      templates = [
        mk('tpl_cimb', 'Refinance ธนาคารกรุงไทย', {}),
        mk('tpl_open', 'เปิดบัญชีเงินฝาก', { purpose: 'เปิดบัญชีเงินฝาก', org: 'ธนาคารกรุงไทย', angle: 0, posY: 0.78, stampScale: 0.72, showDate: true }),
        mk('tpl_visa', 'Visa application (EN)', { templateLine: EN_LINE, certifyText: 'Certified True Copy', purpose: 'visa application', org: 'the Embassy of Japan', color: '#0F172A', dateEra: 'CE', showDate: true, angle: 20 })
      ];
      defaultTplId = 'tpl_cimb';
    }
    if (!historyList || force) {
      const now = Date.now(); const H = 3600e3;
      historyList = [
        { id: 'h1', createdAt: now - 2 * H, fileNames: ['ตัวอย่าง_สลิปเงินเดือน.pdf', 'ตัวอย่าง_รายการเดินบัญชี.pdf'], purpose: 'Refinance', org: 'ธนาคารกรุงไทย', templateLine: TH_LINE, purposeText: 'ใช้เพื่อยื่น Refinance กับธนาคารกรุงไทย เท่านั้น', pageCount: 5, outputPath: 'ตัวอย่าง_สลิปเงินเดือน_รับรองสำเนา_ธนาคารกรุงไทย.pdf', templateName: 'Refinance ธนาคารกรุงไทย' },
        { id: 'h2', createdAt: now - 26 * H, fileNames: ['ตัวอย่าง_ใบเสร็จ.jpg'], purpose: 'เปิดบัญชีเงินฝาก', org: 'ธนาคารกรุงไทย', templateLine: TH_LINE, purposeText: 'ใช้เพื่อยื่น เปิดบัญชีเงินฝาก กับธนาคารกรุงไทย เท่านั้น', pageCount: 1, outputPath: 'ตัวอย่าง_ใบเสร็จ_รับรองสำเนา_ธนาคารกรุงไทย.pdf', templateName: 'เปิดบัญชีเงินฝาก' },
        { id: 'h3', createdAt: now - 6 * 24 * H, fileNames: ['ตัวอย่าง_สลิปเงินเดือน.pdf'], purpose: 'สมัครงาน', org: 'บริษัท ตัวอย่าง จำกัด', templateLine: TH_LINE, purposeText: 'ใช้เพื่อยื่น สมัครงาน กับบริษัท ตัวอย่าง จำกัด เท่านั้น', pageCount: 2, outputPath: 'ตัวอย่าง_สลิปเงินเดือน_รับรองสำเนา_บริษัท ตัวอย่าง จำกัด.pdf', templateName: '' }
      ];
    }
    saveSigs(); saveTemplates(); saveHistory();
  }
  function fillDatalists() {
    const purposes = ['Refinance', 'ขอสินเชื่อบ้าน', 'ขอสินเชื่อส่วนบุคคล', 'เปิดบัญชีเงินฝาก', 'สมัครบัตรเครดิต', 'สมัครงาน', 'ยื่นขอวีซ่า', 'ทำธุรกรรมที่ดิน', 'ยื่นภาษี', 'ทำสัญญาเช่า', 'visa application', 'job application'];
    const orgs = ['ธนาคารกรุงเทพ', 'ธนาคารกสิกรไทย', 'ธนาคารไทยพาณิชย์', 'ธนาคารกรุงไทย', 'ธนาคารกรุงศรีอยุธยา', 'ธนาคารทหารไทยธนชาต', 'ธนาคาร CIMB THAI', 'ธนาคารยูโอบี', 'ธนาคารออมสิน', 'ธนาคารอาคารสงเคราะห์', 'ธนาคารเกียรตินาคินภัทร', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'กรมสรรพากร', 'สำนักงานที่ดิน', 'สถานทูต'];
    $('#dlPurpose').innerHTML = purposes.map((p) => `<option value="${esc(p)}"></option>`).join('');
    $('#dlOrg').innerHTML = orgs.map((p) => `<option value="${esc(p)}"></option>`).join('');
  }

  // ======================================================================
  // 18. Wiring: inputs, keyboard, drop/paste, resize
  // ======================================================================
  function wire() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]'); if (!a) return;
      if (a.tagName === 'A') return;
      if (a.classList.contains('file-row') && e.target.closest('[data-action="file-remove"]')) return;
      e.preventDefault(); onAction(a.dataset.action, a);
    });
    document.addEventListener('keydown', (e) => {
      const tgt = e.target; const typing = tgt.matches('input, textarea, select, [contenteditable]');
      if (st.lockView === 'unlock' && !typing) { if (/^[0-9]$/.test(e.key)) { pinKey(e.key); return; } if (e.key === 'Backspace') { pinKey('del'); return; } if (e.key === 'Enter') { checkPin(); return; } }
      if (e.key === 'Escape') {
        if ($('#annot').classList.contains('open')) { if (!$('#anTextBar').hidden) closeTextBar(); else closeAnnot(); return; }
        const open = $$('.modal.open').pop(); if (open && open.id !== 'pwModal') { closeModal(`#${open.id}`); return; }
        closeNav(); return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) { e.preventDefault(); lockNow(); return; }
      if ($('#annot').classList.contains('open')) {
        if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && an.sel) { e.preventDefault(); onAction('an-delete', document.body); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) anRedo(); else anUndo(); }
        if (tgt.id === 'anTextInput' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) applyTextBar();
        return;
      }
      if (st.view === 'certify' && !typing) {
        if (e.key === 'ArrowLeft' && tgt.id !== 'stampBox') { goPage(-1); return; }
        if (e.key === 'ArrowRight' && tgt.id !== 'stampBox') { goPage(1); return; }
      }
      if ((e.ctrlKey || e.metaKey) && !typing) {
        const k = e.key.toLowerCase();
        if (st.view === 'certify' && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        if (st.view === 'certify' && k === 'y') { e.preventDefault(); redo(); }
        if (st.view === 'edit-pdf' && k === 'z') { e.preventDefault(); edUndo(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && st.view === 'certify') { e.preventDefault(); openExport(); }
      if (tgt.id === 'inPw' && e.key === 'Enter') pwFinish(tgt.value);
    });
    $('#fileInput').addEventListener('change', (e) => { const fl = e.target.files; if (st.view === 'edit-pdf') edAddFiles(fl); else addFilesToCertify(fl); e.target.value = ''; });
    $('#camInput').addEventListener('change', (e) => { addFilesToCertify(e.target.files); e.target.value = ''; });
    $('#edFileInput').addEventListener('change', (e) => { edAddFiles(e.target.files); e.target.value = ''; });
    $('#sigInput').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) uploadSig(f); e.target.value = ''; });
    $('#fontInput').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w฀-๿ -]/g, '').slice(0, 40) || 'CustomFont';
        const face = new FontFace(name, await f.arrayBuffer()); await face.load(); document.fonts.add(face);
        if (!st.customFonts.includes(name)) st.customFonts.push(name);
        setS('font', name); renderFontCards(); toast(L(`เพิ่มฟอนต์ ${name} แล้ว`, `Font ${name} added`));
      } catch (err) { toast(L('อ่านไฟล์ฟอนต์ไม่ได้', 'Couldn’t read that font file')); }
    });
    $('#btnGenerate').addEventListener('click', openExport);
    $('#btnUndo').addEventListener('click', undo); $('#btnRedo').addEventListener('click', redo); $('#btnEdUndo').addEventListener('click', edUndo);
    $('#btnPrev').addEventListener('click', () => goPage(-1)); $('#btnNext').addEventListener('click', () => goPage(1));
    $('#btnHandles').addEventListener('click', () => { st.handles = !st.handles; renderStageChrome(); positionStampBox(); });
    $('#btnZoom').addEventListener('click', () => { st.zoom = st.zoom === 1 ? 1.5 : st.zoom === 1.5 ? 2 : 1; renderStageChrome(); schedulePreview(); });
    const cmp = $('#btnCompare');
    const cmpOn = (e) => { e.preventDefault(); st.compare = true; cmp.setAttribute('aria-pressed', 'true'); schedulePreview(); };
    const cmpOff = () => { if (!st.compare) return; st.compare = false; cmp.setAttribute('aria-pressed', 'false'); schedulePreview(); };
    cmp.addEventListener('pointerdown', cmpOn); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => cmp.addEventListener(ev, cmpOff));
    cmp.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') cmpOn(e); }); cmp.addEventListener('keyup', cmpOff);
    $('#strip').addEventListener('click', (e) => { const t = e.target.closest('.thumb'); if (t) setActive(t.dataset.pid); });
    $('#inHistSearch').addEventListener('input', debounce(renderHistory, 150));
    $$('#libSeg [data-lib]').forEach((b) => b.addEventListener('click', () => { libTab = b.dataset.lib; renderLibrary(); }));
    $$('#langSeg [data-lang]').forEach((b) => b.addEventListener('click', () => { if (lang === b.dataset.lang) return; lang = b.dataset.lang; store.set('lang', lang); applyLang(); rerenderLangDynamic(); }));
    $$('#themeSeg [data-theme-v]').forEach((b) => b.addEventListener('click', () => { theme = b.dataset.themeV; store.set('theme', theme); applyTheme(); }));
    $('#selAutoLock').addEventListener('change', (e) => { sec.autoLock = Number(e.target.value); saveSec(); resetIdle(); });
    $('#chkTabLeave').addEventListener('change', (e) => { sec.tabLeave = e.target.checked; saveSec(); });
    $('#chkSessionOnly').addEventListener('change', (e) => { sec.sessionOnly = e.target.checked; saveSec(); });
    $('#chkInkAccent').addEventListener('change', (e) => { inkAccent = e.target.checked; store.set('inkAccent', inkAccent); applySkin(); });
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m && m.id !== 'pwModal' && m.id !== 'confirmModal') { closeModal(`#${m.id}`); if (m.id === 'edExportModal') renderEside(); } }));
    $('#anTextInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); applyTextBar(); } });

    // drag & drop + paste
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; dragDepth++; $('#dropOv').classList.add('show'); });
    window.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropOv').classList.remove('show'); });
    window.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files?.length) return; e.preventDefault(); dragDepth = 0; $('#dropOv').classList.remove('show');
      if (st.view === 'edit-pdf') edAddFiles(e.dataTransfer.files); else { if (st.view !== 'certify') location.hash = '#certify'; addFilesToCertify(e.dataTransfer.files); }
    });
    window.addEventListener('paste', (e) => {
      if (e.target.matches('input, textarea')) return;
      const files = [...(e.clipboardData?.files || [])].filter((f) => /^image\/|pdf/.test(f.type)); if (!files.length) return;
      e.preventDefault(); if (st.view === 'edit-pdf') edAddFiles(files); else addFilesToCertify(files);
    });

    // layout changes
    const onResize = debounce(() => { if (isStacked() && st.view === 'certify') applyPanelH(st.panelRatio * viewH()); schedulePreview(); if (st.view === 'edit-pdf') renderEside(); if ($('#annot').classList.contains('open')) { layoutAnnot(); renderAnnot(); } if ($('#drawModal').classList.contains('open')) { sizePad(); drawPad(); } }, 120);
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(() => schedulePreview()).observe($('#stageScroll'));
    [mq.wide, mq.landShort, mq.col].forEach((m) => m.addEventListener?.('change', () => { setCollapsed(false); onResize(); renderStrip(); }));
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const fit = () => {
        const kb = window.innerHeight - vv.height > 140;
        $('#app').style.height = kb && isStacked() ? `${vv.height}px` : '';
        if (kb && isStacked()) window.scrollTo(0, 0);
      };
      vv.addEventListener('resize', fit);
    }
    window.addEventListener('hashchange', route);
  }
  async function edAddFiles(list) {
    const files = await readFiles(list); if (!files.length) return;
    edPush();
    files.forEach((f) => f.pages.forEach((p, i) => ed.items.push(edItem(p, f.name, i + 1))));
    renderBoard(); toast(L(`เพิ่ม ${files.reduce((a, f) => a + f.pages.length, 0)} หน้าแล้ว`, `Added ${files.reduce((a, f) => a + f.pages.length, 0)} page(s)`));
  }

  // ======================================================================
  // 19. Boot
  // ======================================================================
  async function init() {
    applyTheme(); applySkin(); applyLang();
    seedData(false);
    if (store.get('seedVer', 1) < 3) {
      // one-time update for browsers that saved older sample data: default bank CIMB / KTB -> ธนาคารกรุงไทย
      const NEW = 'ธนาคารกรุงไทย';
      const swap = (s) => (typeof s === 'string' ? s.split('ธนาคาร CIMB THAI').join(NEW).split('ธนาคาร KTB').join(NEW) : s);
      S.org = swap(S.org);
      templates.forEach((t) => { t.name = swap(t.name); if (t.s) t.s.org = swap(t.s.org); });
      historyList.forEach((h) => { ['org', 'purposeText', 'outputPath', 'templateName'].forEach((k) => { h[k] = swap(h[k]); }); });
      store.set('settings', S); saveTemplates(); saveHistory(); store.set('seedVer', 3);
    }
    if (store.get('seedVer', 1) < 4) {
      // one-time update: default stamp weight Bold -> Semi-bold (current settings + the three sample templates)
      if (S.fontWeight === '700') S.fontWeight = '600';
      templates.forEach((t) => { if (['tpl_cimb', 'tpl_open', 'tpl_visa'].includes(t.id) && t.s && t.s.fontWeight === '700') t.s.fontWeight = '600'; });
      store.set('settings', S); saveTemplates(); store.set('seedVer', 4);
    }
    if (!sigs.find((g) => g.id === S.sigId) && S.sigId) S.sigId = sigs[0]?.id || null;
    fillDatalists(); bindControls(); setupGestures(); setupPanelResize(); setupBoard(); setupAnnot(); setupPad(); wire();
    setTab(st.tab); initPanelH();
    renderSigRow(); renderTplChips(); renderRecent(); renderFontCards(); syncControls(); renderNavCounts();
    const fontsP = Promise.all(['400 20px Sarabun', '700 20px Sarabun', '600 20px Sarabun', '700 20px Niramit', '400 20px "TH SarabunPSK Italic"', '400 20px "IBM Plex Sans Thai"'].map((f) => document.fonts.load(f).catch(() => null)));
    await Promise.race([fontsP, sleep(2500)]);
    st.files = makeSampleFiles(); st.activeId = st.files[0].pages[0].id;
    const edSrc = makeSampleFiles(); edSrc.forEach((f) => f.pages.forEach((p, i) => ed.items.push(edItem(p, f.name, i + 1))));
    renderCertifyAll(); route(); commitHistory(); resetIdle();
  }
  init();
})();

/**
 * Catava Air — Torensimulator v3
 * Fysisch model: koeling · Venturi · nozzles · VD-matrix · hectare · 2-toren visualisatie
 *
 * Bronnen:
 *   - Ontwerptekening airsok Catava/Catyra BV (december 2025)
 *   - Kickoff-presentatie 'Maak-BV' (18 december 2025)
 *   - CoolFlow validatierapport (december 2025)
 *   - Nozzle specs: KBN-serie, fabricage Japan
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// FYSISCHE CONSTANTEN
// ═══════════════════════════════════════════════════════════════
const HVAP   = 2450;   // kJ/kg  — verdampingswarmte water bij 25°C
const CP_AIR = 1.006;  // kJ/kg·K — soortelijke warmte lucht
const RHO    = 1.15;   // kg/m³  — luchtdichtheid bij ~25°C

// ═══════════════════════════════════════════════════════════════
// NOZZLE DATA  —  KBN-serie (Japan)
// q ∝ √P  schaling; referentie @ 10 bar (1 MPa)
// ═══════════════════════════════════════════════════════════════
const NOZZLES = {
  '80125': { lbl: 'KBN 80125', qRef: 7.50,  desc: '0,125 L/min — koeling & VD' },
  '80063': { lbl: 'KBN 80063', qRef: 3.78,  desc: '0,063 L/min — ultra-fijne VD-sturing' },
};

/** Debiet per nozzle [l/h] bij gegeven druk [bar] */
function nozzleQ(type, bar) {
  return NOZZLES[type].qRef * Math.sqrt(bar / 10);
}

// ═══════════════════════════════════════════════════════════════
// STATE  —  torengeometrie
// ═══════════════════════════════════════════════════════════════
const G = {
  D_top:    1067,  // mm  binnenmaat bovenkant (kunststof)
  D_throat:  800,  // mm  venturi-keel
  D_mid:     800,  // mm  tussenstuk
  D_bot:    1000,  // mm  onderzijde uitloop
  H_top:    1950,  // mm  hoogte boven-conus
  H_mid:    1500,  // mm  hoogte tussenstuk
  H_bot:     400,  // mm  hoogte onderste uitloop
};

// ═══════════════════════════════════════════════════════════════
// STATE  —  bedrijfsparameters
// ═══════════════════════════════════════════════════════════════
const S = {
  Tin:     35,     // °C  buitentemperatuur
  RV:      30,     // %   relatieve luchtvochtigheid
  dT:      10,     // K   gewenste koeling
  eta:     85,     // %   verdampingsrendement
  water:   48,     // l/h waterverbruik per toren
  NT:      32,     // -   torens per hectare
  NR:       8,     // -   nozzles per ring
  P1:      20,     // bar werkdruk ring 1
  P2:      31,     // bar werkdruk ring 2
  nozzle: '80125', // -   nozzle type
  spacing: 10,     // m   hart-op-hart afstand 2-toren
  vdMin:    2,     // g/m³ VD doel minimum
  vdMax:    8,     // g/m³ VD doel maximum
};

// ═══════════════════════════════════════════════════════════════
// HULPFUNCTIES
// ═══════════════════════════════════════════════════════════════

/** Doorstroomoppervlak [m²] van een cirkel met diameter [mm] */
function A(Dmm) {
  return Math.PI * (Dmm / 2000) ** 2;
}

/** Totale torenhoogte [mm] */
function totalH() {
  return G.H_top + G.H_mid + G.H_bot;
}

/** Verzadigde absolute vochtigheid [g/m³] bij temperatuur T [°C] */
function satH(T) {
  return 4.849 * Math.exp(0.0653 * T);
}

/** Vochtdeficit [g/m³] */
function calcVD(T, RV) {
  return satH(T) * (1 - RV / 100);
}

/** Afronden op 1 decimaal */
function r1(v) { return Math.round(v * 10) / 10; }

/** Afronden op 2 decimalen */
function r2(v) { return Math.round(v * 100) / 100; }

// ═══════════════════════════════════════════════════════════════
// KERN BEREKENING
// ═══════════════════════════════════════════════════════════════
function compute() {
  const eta  = S.eta / 100;
  const Qmax = (S.water / 3600) * HVAP;      // kW theoretisch max
  const Qnet = Qmax * eta;                    // kW netto
  const mAir = Qnet / (CP_AIR * S.dT);       // kg/s lucht
  const Vair = mAir / RHO;                   // m³/s
  const Vairh = Vair * 3600;                 // m³/h

  const Tout = S.Tin - S.dT;

  // Doorstroomoppervlakken
  const a1 = A(G.D_top);
  const a2 = A(G.D_throat);
  const a3 = A(G.D_mid);
  const a4 = A(G.D_bot);

  // Luchtsnelheden per zone (continuïteit: A·v = constant)
  const v1 = Vair / a1;
  const v2 = Vair / a2;
  const v3 = Vair / a3;
  const v4 = Vair / a4;

  // Bernoulli drukverschil keel t.o.v. boven
  const dP_mbar = 0.5 * RHO * (v2 ** 2 - v1 ** 2) / 100;

  // Gemiddelde verblijftijd
  const verblijf = (totalH() / 1000) / ((v1 + v2 + v3 + v4) / 4);

  // VD
  const vdIn     = calcVD(S.Tin, S.RV);
  const vdOut    = satH(Tout) * 0.03;        // ≈ bijna verzadigd bij uitlaat
  const moistAdd = (S.water * eta) / (Vairh || 1);

  // Nozzles
  const f1  = nozzleQ(S.nozzle, S.P1);
  const f2  = nozzleQ(S.nozzle, S.P2);
  const wR1 = S.NR * f1;
  const wR2 = S.NR * f2;
  const wTot = wR1 + wR2;

  // Hectare
  const m2     = 10000 / S.NT;
  const radius = Math.sqrt(m2 / Math.PI);
  const hoh    = Math.sqrt(m2);

  return {
    eta, Qmax, Qnet, mAir, Vairh, Tout,
    a1, a2, a3, a4,
    v1, v2, v3, v4,
    dP_mbar, verblijf,
    vdIn, vdOut, moistAdd,
    f1, f2, wR1, wR2, wTot,
    m2, radius, hoh,
  };
}

// ═══════════════════════════════════════════════════════════════
// HTML HELPER — metric card
// ═══════════════════════════════════════════════════════════════
function mc(lbl, val, unit, cls) {
  return `<div class="mc ${cls || ''}">
    <div class="mc-lbl">${lbl}</div>
    <div class="mc-val">${val}</div>
    <div class="mc-uni">${unit}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// SLIDER DEFINITIES
// ═══════════════════════════════════════════════════════════════
const SLIDER_DEFS = {
  klimaat: [
    { id: 'Tin',  lbl: 'Buitentemperatuur',      min: 20, max: 45,  step: 1, fmt: v => v + ' °C' },
    { id: 'RV',   lbl: 'Relatieve vochtigheid',   min: 10, max: 90,  step: 5, fmt: v => v + ' %' },
    { id: 'dT',   lbl: 'Doelkoeling ΔT',          min: 3,  max: 15,  step: 1, fmt: v => v + ' K' },
    { id: 'eta',  lbl: 'Verdampingsrendement',     min: 50, max: 100, step: 5, fmt: v => v + ' %' },
  ],
  water: [
    { id: 'water', lbl: 'Water per toren', min: 10, max: 100, step: 2, fmt: v => v + ' l/h' },
  ],
  ha: [
    { id: 'NT', lbl: 'Torens per hectare', min: 15, max: 55, step: 1, fmt: v => v + ' /ha' },
  ],
  nozzle: [
    { id: 'NR', lbl: 'Nozzles per ring', min: 4,  max: 20, step: 1, fmt: v => v },
    { id: 'P1', lbl: 'Druk ring 1',      min: 3,  max: 35, step: 1, fmt: v => v + ' bar' },
    { id: 'P2', lbl: 'Druk ring 2',      min: 3,  max: 35, step: 1, fmt: v => v + ' bar' },
  ],
  vd: [
    { id: 'vdMin', lbl: 'VD-doel minimum', min: 0, max: 5,  step: 1, fmt: v => v + ' g/m³' },
    { id: 'vdMax', lbl: 'VD-doel maximum', min: 5, max: 14, step: 1, fmt: v => v + ' g/m³' },
  ],
};

function buildSliders(group, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = SLIDER_DEFS[group].map(d => `
    <div class="sr">
      <label for="sl-${d.id}">${d.lbl}</label>
      <input type="range" id="sl-${d.id}"
             min="${d.min}" max="${d.max}" step="${d.step}" value="${S[d.id]}"
             oninput="onSlider('${d.id}', this.value, '${group}')">
      <span class="sv" id="sv-${d.id}">${d.fmt(S[d.id])}</span>
    </div>`).join('');
}

function onSlider(id, val, group) {
  S[id] = +val;
  const def = SLIDER_DEFS[group].find(d => d.id === id);
  const sv  = document.getElementById('sv-' + id);
  if (sv && def) sv.textContent = def.fmt(+val);
  renderAll();
}

function onSpacing(val) {
  S.spacing = +val;
  document.getElementById('sv-spacing').textContent = r1(+val) + ' m';
  renderDubbel(compute());
}

// ═══════════════════════════════════════════════════════════════
// GEOMETRIE INVOER
// ═══════════════════════════════════════════════════════════════
const GEOM_FIELDS = [
  { id: 'D_top',    lbl: 'Ø boven (binnenmaat)', unit: 'mm' },
  { id: 'D_throat', lbl: 'Ø venturi-keel',        unit: 'mm' },
  { id: 'D_mid',    lbl: 'Ø tussenstuk',           unit: 'mm' },
  { id: 'D_bot',    lbl: 'Ø onderzijde',           unit: 'mm' },
  { id: 'H_top',    lbl: 'H boven-conus',          unit: 'mm' },
  { id: 'H_mid',    lbl: 'H tussenstuk',           unit: 'mm' },
  { id: 'H_bot',    lbl: 'H onder-uitloop',        unit: 'mm' },
];

function buildGeomInputs() {
  document.getElementById('geom-inputs').innerHTML = GEOM_FIELDS.map(f => `
    <div class="ni-wrap">
      <label>${f.lbl}</label>
      <input type="number" id="gi-${f.id}"
             value="${G[f.id]}" min="100" max="5000" step="10"
             oninput="onGeom('${f.id}', this.value)">
      <span class="ni-unit">${f.unit}</span>
    </div>`).join('');
}

function onGeom(id, val) {
  const n = +val;
  if (n >= 100 && n <= 5000) G[id] = n;
  renderAll();
}

// ═══════════════════════════════════════════════════════════════
// RENDER — GEOMETRIE TAB
// ═══════════════════════════════════════════════════════════════
function renderGeometrie(c) {
  document.getElementById('r-geom-areas').innerHTML =
    mc('Ø boven ' + G.D_top, c.a1.toFixed(4), 'm²', '') +
    mc('Ø keel ' + G.D_throat, c.a2.toFixed(4), 'm²', 'wn') +
    mc('Ø tussen ' + G.D_mid, c.a3.toFixed(4), 'm²', '') +
    mc('Ø onder ' + G.D_bot, c.a4.toFixed(4), 'm²', '') +
    mc('A-reductie keel', r1((1 - c.a2 / c.a1) * 100) + '%', 'boven→keel', 'wn') +
    mc('Totale hoogte', r1(totalH() / 1000), 'm', '');

  document.getElementById('geom-formula').innerHTML =
    `Totale hoogte : ${G.H_top} + ${G.H_mid} + ${G.H_bot} = ${totalH()} mm\n` +
    `A boven       = π×(${G.D_top}/2)²/10⁶  = ${c.a1.toFixed(4)} m²\n` +
    `A keel        = π×(${G.D_throat}/2)²/10⁶  = ${c.a2.toFixed(4)} m²\n` +
    `A reductie    = ${r1((1 - c.a2 / c.a1) * 100)}%   ratio A₁/A₂ = ${r2(c.a1 / c.a2)}×`;

  document.getElementById('ft-geom').textContent =
    `Ø${G.D_top} / ${G.D_throat} / ${G.D_mid} / ${G.D_bot} mm  |  H = ${totalH()} mm`;

  drawTower('cvs-tower');
}

// ═══════════════════════════════════════════════════════════════
// RENDER — PERFORMANCE TAB
// ═══════════════════════════════════════════════════════════════
function renderPerformance(c) {
  document.getElementById('r-perf-main').innerHTML =
    mc('Water', S.water, 'l/h', '') +
    mc('Koelvermogen netto', r1(c.Qnet), 'kW', 'hi') +
    mc('Koelvermogen max.', r1(c.Qmax), 'kW', '') +
    mc('Luchtdebiet', Math.round(c.Vairh), 'm³/h', 'hi') +
    mc('Uitlaattemperatuur', r1(c.Tout), '°C', 'ok') +
    mc('VD inlaat', r1(c.vdIn), 'g/m³', '') +
    mc('VD uitlaat', r1(c.vdOut), 'g/m³', 'ok') +
    mc('Vochttoevoeging', r2(c.moistAdd), 'g/m³', '');

  document.getElementById('r-perf-formula').innerHTML =
    `Q_max   = ${S.water}/3600 × 2450      = ${r1(c.Qmax)} kW\n` +
    `Q_netto = ${r1(c.Qmax)} × ${S.eta}%             = ${r1(c.Qnet)} kW\n` +
    `ṁ_lucht = ${r1(c.Qnet)} / (1.006 × ${S.dT})  = ${r2(c.mAir)} kg/s\n` +
    `V̇       = ${r2(c.mAir)} / 1.15              = ${Math.round(c.Vairh)} m³/h`;

  document.getElementById('r-venturi').innerHTML =
    mc('v boven Ø' + G.D_top,    r2(c.v1), 'm/s', '') +
    mc('v keel Ø' + G.D_throat,  r2(c.v2), 'm/s', 'wn') +
    mc('v tussen Ø' + G.D_mid,   r2(c.v3), 'm/s', '') +
    mc('v onder Ø' + G.D_bot,    r2(c.v4), 'm/s', '') +
    mc('Versnelling keel',  r2(c.v2 / c.v1) + '×', 'keel / boven', 'hi') +
    mc('ΔP Bernoulli',      r2(c.dP_mbar),    'mbar', 'hi') +
    mc('Verblijftijd',      r1(c.verblijf),   'sec', '');

  drawVenturiChart(c);
}

// ═══════════════════════════════════════════════════════════════
// RENDER — 2 TORENS TAB
// ═══════════════════════════════════════════════════════════════
function renderDubbel(c) {
  const spacing = S.spacing;
  const radius  = c.radius;
  const overlap = Math.max(0, radius * 2 - spacing);
  const pct     = overlap > 0 ? Math.round(overlap / (radius * 2) * 100) : 0;

  document.getElementById('r-dubbel-cards').innerHTML =
    mc('Hart-op-hart', spacing, 'm', '') +
    mc('Invloedsstraal', r1(radius), 'm / toren', 'hi') +
    mc('Overlap', overlap > 0 ? r1(overlap) : 0, 'm', overlap > 0 ? 'wn' : 'ok') +
    mc('Overlap %', pct, '%', pct > 50 ? 'wn' : '');

  document.getElementById('r-dubbel-zone').innerHTML =
    mc('2× koelvermogen', r1(c.Qnet * 2), 'kW', '') +
    mc('2× luchtdebiet',  Math.round(c.Vairh * 2), 'm³/h', '') +
    mc('Overlapping', overlap > 0 ? 'Versterking' : 'Geen', overlap > 0 ? `+${pct}%` : 'onafhankelijk', overlap > 0 ? 'ok' : '');

  drawDubbelTop(c, spacing, radius);
  drawDubbelSide(c, spacing);
}

// ═══════════════════════════════════════════════════════════════
// RENDER — HECTARE TAB
// ═══════════════════════════════════════════════════════════════
function renderHectare(c) {
  document.getElementById('r-ha-main').innerHTML =
    mc('Water totaal',   Math.round(S.NT * S.water),           'l/h per ha', '') +
    mc('Water/dag (10u)', r1(S.NT * S.water * 10 / 1000),      'm³/dag', '') +
    mc('Koelvermogen',   Math.round(S.NT * c.Qnet),            'kW per ha', 'hi') +
    mc('Luchtdebiet',    (S.NT * c.Vairh / 1000).toFixed(0) + 'k', 'm³/h per ha', 'hi') +
    mc('m² per toren',   Math.round(c.m2),                     'm²', '') +
    mc('Invloedsstraal', r1(c.radius),                         'm', '') +
    mc('Hart-op-hart',   r1(c.hoh),                            'm raster', '') +
    mc('Torens totaal',  S.NT,                                  'per hectare', '');

  const levels = [
    { lbl: 'Lichte VD-sturing',       range: '15–20', m2: '400–500', act: S.NT <= 20 },
    { lbl: 'Normaal koeling + RV',     range: '25–30', m2: '300–400', act: S.NT > 20 && S.NT <= 30 },
    { lbl: 'Intensief (aardbei)',      range: '35–40', m2: '250–300', act: S.NT > 30 && S.NT <= 42 },
    { lbl: 'Maximum dekking',          range: '45–55', m2: '180–250', act: S.NT > 42 },
  ];

  document.getElementById('r-levels').innerHTML = levels.map(l => `
    <div class="lc ${l.act ? 'lca' : ''}">
      <div>
        <div class="lc-name">${l.lbl}</div>
        <div class="lc-det">${l.m2} m²/toren</div>
      </div>
      <span class="lbdg">${l.range}/ha</span>
    </div>`).join('');

  drawHaGrid(c);
  drawHaLine(c);
}

// ═══════════════════════════════════════════════════════════════
// RENDER — NOZZLES TAB
// ═══════════════════════════════════════════════════════════════
function renderNozzles(c) {
  // Nozzle selector
  document.getElementById('nozzle-sel').innerHTML =
    Object.entries(NOZZLES).map(([k, n]) => `
      <label style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;
                    border:1.5px solid ${k === S.nozzle ? '#1D9E75' : '#d0cec4'};
                    border-radius:8px;cursor:pointer;margin-bottom:6px;
                    background:${k === S.nozzle ? '#E1F5EE' : '#fff'}">
        <input type="radio" name="nz" value="${k}" ${k === S.nozzle ? 'checked' : ''}
               onchange="onNozzle('${k}')" style="margin-top:3px;accent-color:#1D9E75">
        <div>
          <div style="font-weight:700;font-size:.8rem">${n.lbl}</div>
          <div style="font-size:.7rem;color:#888;margin-top:2px">${n.desc} | ${n.qRef.toFixed(2)} l/h @ 10 bar</div>
        </div>
      </label>`).join('');

  // Capaciteitstabel
  const bars = [3, 5, 7, 10, 15, 20, 25, 30, 35];
  document.getElementById('nozzle-thead').innerHTML =
    `<tr style="background:#1a1a18">
      <th style="padding:6px 9px;color:rgba(255,255,255,.6);font-weight:500;text-align:left">Druk</th>` +
    Object.entries(NOZZLES).map(([, n]) =>
      `<th style="padding:6px 9px;color:rgba(255,255,255,.6);font-weight:500;text-align:center">${n.lbl} (l/h)</th>` +
      `<th style="padding:6px 9px;color:rgba(255,255,255,.6);font-weight:500;text-align:center">${S.NR}× (l/h ring)</th>`
    ).join('') +
    '</tr>';

  document.getElementById('nozzle-tbody').innerHTML = bars.map(bar => {
    const isP1 = bar === S.P1, isP2 = bar === S.P2;
    const hl   = isP1 || isP2 ? 'background:#E1F5EE' : '';
    const mark = isP1 ? ' ←R1' : isP2 ? ' ←R2' : '';
    return `<tr style="${hl}">
      <td style="padding:5px 9px;border-bottom:1px solid #f2f0ea;font-weight:600">${bar} bar${mark}</td>` +
      Object.keys(NOZZLES).map(k => {
        const q = nozzleQ(k, bar);
        return `<td style="padding:5px 9px;border-bottom:1px solid #f2f0ea;text-align:center">${q.toFixed(2)}</td>` +
               `<td style="padding:5px 9px;border-bottom:1px solid #f2f0ea;text-align:center">${(S.NR * q).toFixed(1)}</td>`;
      }).join('') +
      '</tr>';
  }).join('');

  document.getElementById('r-nozzle-result').innerHTML =
    mc('Ring 1 (' + S.P1 + ' bar)', r1(c.wR1), 'l/h (' + S.NR + '×' + r2(c.f1) + ')', '') +
    mc('Ring 2 (' + S.P2 + ' bar)', r1(c.wR2), 'l/h (' + S.NR + '×' + r2(c.f2) + ')', '') +
    mc('Totaal beide ringen', r1(c.wTot), 'l/h per toren', 'hi');

  document.getElementById('r-nozzle-balans').innerHTML =
    mc('Ingesteld water',  S.water, 'l/h', '') +
    mc('Verdampt effectief', (S.water * S.eta / 100).toFixed(1), 'l/h', 'ok') +
    mc('Druppelval',         (S.water * (1 - S.eta / 100)).toFixed(1), 'l/h', 'wn') +
    mc('Netto kW', r1(c.Qnet), 'kW', 'hi');
}

function onNozzle(k) {
  S.nozzle = k;
  renderAll();
}

// ═══════════════════════════════════════════════════════════════
// RENDER — VD-MATRIX TAB
// ═══════════════════════════════════════════════════════════════
function renderVD() {
  const temps = [18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38];
  const rvs   = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40];

  let h = `<thead><tr>
    <th style="padding:5px 7px;background:#1a1a18;color:rgba(255,255,255,.5);font-weight:500">T \\ RV</th>`;
  rvs.forEach(r => {
    h += `<th style="padding:5px 7px;background:#1a1a18;color:rgba(255,255,255,.5);font-weight:500;text-align:center">${r}%</th>`;
  });
  h += '</tr></thead><tbody>';

  temps.forEach(T => {
    h += `<tr><td style="padding:5px 7px;font-weight:700;color:#888;background:#f8f6f0">${T}°C</td>`;
    rvs.forEach(rv => {
      const vd = calcVD(T, rv);
      let cls;
      if      (vd < S.vdMin) cls = 'vd-ok';
      else if (vd <= S.vdMax) cls = 'vd-gd';
      else if (vd <= 10)      cls = 'vd-wn';
      else if (vd <= 14)      cls = 'vd-bd';
      else                    cls = 'vd-xx';
      h += `<td class="${cls}">${vd.toFixed(1)}</td>`;
    });
    h += '</tr>';
  });

  h += '</tbody>';
  document.getElementById('vd-matrix').innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// CANVAS — TOREN DOORSNEDE
// ═══════════════════════════════════════════════════════════════
function drawTower(canvasId) {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 70, padR = 72, padT = 36, padB = 36;
  const gH   = H - padT - padB;
  const cx   = padL + (W - padL - padR) / 2;

  const total = totalH();
  const yT    = padT;
  const yK    = padT + (G.H_top / total) * gH;
  const yM    = padT + ((G.H_top + G.H_mid) / total) * gH;
  const yB    = padT + gH;

  const maxD  = Math.max(G.D_top, G.D_throat, G.D_mid, G.D_bot);
  const scale = (W - padL - padR) / 2 / maxD;
  const rT    = G.D_top    * scale;
  const rK    = G.D_throat * scale;
  const rM    = G.D_mid    * scale;
  const rB    = G.D_bot    * scale;

  // Fill
  ctx.beginPath();
  ctx.moveTo(cx - rT, yT);
  ctx.lineTo(cx - rK, yK);
  ctx.lineTo(cx - rM, yM);
  ctx.lineTo(cx - rB, yB);
  ctx.lineTo(cx + rB, yB);
  ctx.lineTo(cx + rM, yM);
  ctx.lineTo(cx + rK, yK);
  ctx.lineTo(cx + rT, yT);
  ctx.closePath();
  ctx.fillStyle   = 'rgba(29,158,117,0.07)';
  ctx.fill();
  ctx.strokeStyle = '#1D9E75';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Keel stippellijn
  ctx.beginPath();
  ctx.moveTo(cx - rK, yK);
  ctx.lineTo(cx + rK, yK);
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = '#EF9F27';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  // Tussenstuk stippellijn
  ctx.beginPath();
  ctx.moveTo(cx - rM, yM);
  ctx.lineTo(cx + rM, yM);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(100,100,100,0.3)';
  ctx.lineWidth   = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // Nozzle ringen
  const yN1 = yT + (yK - yT) * 0.35;
  const rN1 = rT + (rK - rT) * 0.35;
  const yN2 = yT + (yK - yT) * 0.70;
  const rN2 = rT + (rK - rT) * 0.70;

  [[yN1, rN1, '#BA7517'], [yN2, rN2, '#185FA5']].forEach(([y, r, col]) => {
    ctx.beginPath();
    ctx.ellipse(cx, y, r * 0.38, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle    = col;
    ctx.globalAlpha  = 0.75;
    ctx.fill();
    ctx.globalAlpha  = 1;
  });

  // Diameter labels rechts
  const lblR = (txt, y, col) => {
    ctx.font      = '10px sans-serif';
    ctx.fillStyle = col;
    ctx.textAlign = 'left';
    ctx.fillText(txt, cx + Math.max(rT, rK, rM, rB) * scale / maxD * maxD + 5, y);
  };
  ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = '#185FA5'; ctx.fillText('Ø' + G.D_top    + ' mm', cx + rT + 5, yT + 12);
  ctx.fillStyle = '#EF9F27'; ctx.fillText('Ø' + G.D_throat + ' mm', cx + rK + 5, yK + 4);
  ctx.fillStyle = '#888780'; ctx.fillText('Ø' + G.D_mid    + ' mm', cx + rM + 5, yM + 4);
  ctx.fillStyle = '#185FA5'; ctx.fillText('Ø' + G.D_bot    + ' mm', cx + rB + 5, yB - 4);

  // Hoogte labels links
  const drawHLbl = (y1, y2, lbl, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth   = 0.8;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(padL - 18, y1); ctx.lineTo(padL - 18, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(padL - 22, y1); ctx.lineTo(padL - 14, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padL - 22, y2); ctx.lineTo(padL - 14, y2); ctx.stroke();
    ctx.save();
    ctx.translate(padL - 30, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font      = '9px sans-serif';
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.fillText(lbl, 0, 0);
    ctx.restore();
  };
  drawHLbl(yT, yK, G.H_top + ' mm', '#1D9E75');
  drawHLbl(yK, yM, G.H_mid + ' mm', '#888780');
  drawHLbl(yM, yB, G.H_bot + ' mm', '#BA7517');

  // Totale hoogte bracket
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth   = 0.5;
  ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(padL - 48, yT); ctx.lineTo(padL - 48, yB); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(padL - 52, yT); ctx.lineTo(padL - 44, yT); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(padL - 52, yB); ctx.lineTo(padL - 44, yB); ctx.stroke();
  ctx.save();
  ctx.translate(padL - 58, (yT + yB) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font      = '10px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.textAlign = 'center';
  ctx.fillText(totalH() + ' mm totaal', 0, 0);
  ctx.restore();

  // Lucht pijlen
  drawArrow(ctx, cx, yT - 22, cx, yT + 2, '#1D9E75', 2);
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#1D9E75'; ctx.textAlign = 'center';
  ctx.fillText('lucht in', cx, yT - 25);
  drawArrow(ctx, cx - 14, yB - 3, cx - 26, yB + 18, '#1D9E75', 1.5);
  drawArrow(ctx, cx + 14, yB - 3, cx + 26, yB + 18, '#1D9E75', 1.5);
  ctx.fillText('lucht uit', cx, yB + 28);

  // Tentstok
  ctx.fillStyle = '#d0cec4';
  ctx.fillRect(cx - rB, yB + 2, rB * 2, 4);
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'center';
  ctx.fillText('tentstok + grondlussen', cx, yB + 15);
}

// ═══════════════════════════════════════════════════════════════
// CANVAS — VENTURI STAAFDIAGRAM
// ═══════════════════════════════════════════════════════════════
function drawVenturiChart(c) {
  const cv = document.getElementById('cvs-venturi');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const pL = 50, pR = 20, pT = 28, pB = 38;
  const gW = W - pL - pR, gH = H - pT - pB;

  const zones = [
    { lbl: 'Boven\nØ' + G.D_top,    v: c.v1, col: '#1D9E75' },
    { lbl: 'Keel\nØ' + G.D_throat,  v: c.v2, col: '#EF9F27' },
    { lbl: 'Tussen\nØ' + G.D_mid,   v: c.v3, col: '#888780' },
    { lbl: 'Onder\nØ' + G.D_bot,    v: c.v4, col: '#185FA5' },
  ];
  const maxV = Math.max(...zones.map(z => z.v)) * 1.25;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = pT + gH - (i / 4) * gH;
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + gW, y); ctx.stroke();
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'right';
    ctx.fillText((maxV * i / 4).toFixed(1), pL - 4, y + 3);
  }
  ctx.save();
  ctx.translate(12, pT + gH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'center';
  ctx.fillText('m/s', 0, 0);
  ctx.restore();

  const bW = gW / zones.length * 0.52;
  zones.forEach((z, i) => {
    const x  = pL + (i + 0.5) * (gW / zones.length) - bW / 2;
    const bH = (z.v / maxV) * gH;
    const y  = pT + gH - bH;
    ctx.fillStyle    = z.col;
    ctx.globalAlpha  = 0.82;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, bW, bH, [4, 4, 0, 0]);
    else ctx.rect(x, y, bW, bH);
    ctx.fill();
    ctx.globalAlpha  = 1;
    ctx.font      = '10px sans-serif';
    ctx.fillStyle = z.col;
    ctx.textAlign = 'center';
    ctx.fillText(z.v.toFixed(2) + ' m/s', x + bW / 2, y - 5);
    z.lbl.split('\n').forEach((ln, li) => {
      ctx.font = '9px sans-serif'; ctx.fillStyle = '#888';
      ctx.fillText(ln, x + bW / 2, pT + gH + 14 + li * 12);
    });
  });

  // Pijl boven→keel
  const x1c = pL + 0.5 * (gW / 4) + bW / 2 + 5;
  const x2c = pL + 1.5 * (gW / 4) - bW / 2 - 5;
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#EF9F27'; ctx.textAlign = 'center';
  ctx.fillText('×' + (c.v2 / c.v1).toFixed(2), (x1c + x2c) / 2, pT + gH * 0.28);
}

// ═══════════════════════════════════════════════════════════════
// CANVAS — DUBBEL BOVENAANZICHT
// ═══════════════════════════════════════════════════════════════
function drawDubbelTop(c, spacing, radius) {
  const cv = document.getElementById('cvs-dubbel-top');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const total = spacing + radius * 2 + 2;
  const scale = Math.min((W - 60) / total, (H - 60) / (radius * 2 + 20));
  const cy    = H / 2;
  const cx1   = W / 2 - (spacing / 2) * scale;
  const cx2   = W / 2 + (spacing / 2) * scale;
  const r     = radius * scale;

  // Grid
  ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 8; i++) {
    const x = i * (W / 8);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * (H / 8)); ctx.lineTo(W, i * (H / 8)); ctx.stroke();
  }

  // Invloedszones
  [[cx1, '#1D9E75'], [cx2, '#185FA5']].forEach(([x, col]) => {
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.globalAlpha = 0.12; ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5;
    ctx.stroke(); ctx.globalAlpha = 1;
  });

  // Overlap highlight
  if (spacing < radius * 2) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx1, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.arc(cx2, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(29,158,117,0.25)'; ctx.fill();
    ctx.restore();
  }

  // Toren stippen
  [[cx1, '#1D9E75', 'Toren 1'], [cx2, '#185FA5', 'Toren 2']].forEach(([x, col, lbl]) => {
    const tr = Math.max(7, 4);
    ctx.beginPath(); ctx.arc(x, cy, tr, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.font = '11px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'center';
    ctx.fillText(lbl, x, cy + tr + 14);
  });

  // Afstandspijl
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(cx1, cy - r * 0.7); ctx.lineTo(cx2, cy - r * 0.7); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.textAlign = 'center';
  ctx.fillText(spacing + ' m hart-op-hart', (cx1 + cx2) / 2, cy - r * 0.7 - 7);

  // Radius labels
  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#1D9E75'; ctx.textAlign = 'center';
  ctx.fillText('r=' + r1(radius) + 'm', cx1, cy - r - 8);
  ctx.fillStyle = '#185FA5';
  ctx.fillText('r=' + r1(radius) + 'm', cx2, cy - r - 8);

  // Schaalbalk
  const barM  = 5;
  const barPx = barM * scale;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W - 50, H - 15); ctx.lineTo(W - 50 + barPx, H - 15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 50, H - 12); ctx.lineTo(W - 50, H - 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 50 + barPx, H - 12); ctx.lineTo(W - 50 + barPx, H - 18); ctx.stroke();
  ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.textAlign = 'center';
  ctx.fillText(barM + 'm', W - 50 + barPx / 2, H - 6);
}

// ═══════════════════════════════════════════════════════════════
// CANVAS — DUBBEL ZIJAANZICHT
// ═══════════════════════════════════════════════════════════════
function drawDubbelSide(c, spacing) {
  const cv = document.getElementById('cvs-dubbel-side');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const ground  = H - 24;
  const tH      = totalH();
  const scaleH  = (H - 50) / tH;
  const towerH  = tH * scaleH;
  const cx1     = W / 2 - (spacing / 2) * (W - 60) / (spacing + 1.5);
  const cx2     = W / 2 + (spacing / 2) * (W - 60) / (spacing + 1.5);

  // Grond
  ctx.fillStyle = '#d0cec4'; ctx.fillRect(0, ground, W, H - ground);
  ctx.strokeStyle = '#b0ae9a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(W, ground); ctx.stroke();

  const drawSide = (cx, col) => {
    const sc    = towerH / tH;
    const rTop  = G.D_top    * sc / 2;
    const rKeel = G.D_throat * sc / 2;
    const rMid  = G.D_mid    * sc / 2;
    const rBot  = G.D_bot    * sc / 2;
    const yTop  = ground - towerH;
    const yKeel = ground - towerH * (1 - G.H_top / tH);
    const yMid  = ground - towerH * (G.H_bot / tH);
    const yBot  = ground;

    ctx.beginPath();
    ctx.moveTo(cx - rTop,  yTop);
    ctx.lineTo(cx - rKeel, yKeel);
    ctx.lineTo(cx - rMid,  yMid);
    ctx.lineTo(cx - rBot,  yBot);
    ctx.lineTo(cx + rBot,  yBot);
    ctx.lineTo(cx + rMid,  yMid);
    ctx.lineTo(cx + rKeel, yKeel);
    ctx.lineTo(cx + rTop,  yTop);
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.15; ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = '9px sans-serif'; ctx.fillStyle = col; ctx.textAlign = 'center';
    ctx.fillText((tH / 1000).toFixed(2) + 'm', cx, yTop - 8);
  };

  drawSide(cx1, '#1D9E75');
  drawSide(cx2, '#185FA5');

  // Afstandslabel
  ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.textAlign = 'center';
  ctx.fillText(spacing + ' m', (cx1 + cx2) / 2, H - 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(cx1, ground + 4); ctx.lineTo(cx2, ground + 4); ctx.stroke();
  ctx.setLineDash([]);
}

// ═══════════════════════════════════════════════════════════════
// CANVAS — HECTARE RASTER
// ═══════════════════════════════════════════════════════════════
function drawHaGrid(c) {
  const cv = document.getElementById('cvs-ha');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const pad = 22;
  const gW  = W - pad * 2, gH = H - pad * 2;
  const scX = gW / 100, scY = gH / 100;

  // Achtergrond
  ctx.fillStyle = '#f8f6f0'; ctx.fillRect(pad, pad, gW, gH);
  ctx.strokeStyle = '#d0cec4'; ctx.lineWidth = 1; ctx.strokeRect(pad, pad, gW, gH);

  // Grid 10m
  ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 0.5;
  for (let i = 10; i < 100; i += 10) {
    ctx.beginPath(); ctx.moveTo(pad + i * scX, pad); ctx.lineTo(pad + i * scX, pad + gH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, pad + i * scY); ctx.lineTo(pad + gW, pad + i * scY); ctx.stroke();
  }

  // Torens
  const n    = S.NT;
  const cols = Math.round(Math.sqrt(n * (gW / gH)));
  const rows = Math.ceil(n / cols);
  const dx   = gW / cols, dy = gH / rows;
  const rPx  = c.radius * scX;

  let count = 0;
  for (let row = 0; row < rows && count < n; row++) {
    for (let col = 0; col < cols && count < n; col++) {
      const x = pad + (col + 0.5) * dx;
      const y = pad + (row + 0.5) * dy;
      ctx.beginPath(); ctx.arc(x, y, rPx, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(29,158,117,0.12)'; ctx.fill();
      ctx.strokeStyle = 'rgba(29,158,117,0.3)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#1D9E75'; ctx.fill();
      count++;
    }
  }

  // Labels
  ctx.font = '10px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.textAlign = 'center';
  ctx.fillText('100 m', pad + gW / 2, H - 5);
  ctx.save(); ctx.translate(10, pad + gH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('100 m', 0, 0); ctx.restore();
  ctx.fillStyle = '#1D9E75';
  ctx.fillText(n + ' torens / 1 ha  |  r=' + r1(c.radius) + 'm  |  raster ' + r1(c.hoh) + 'm', pad + gW / 2, pad + 13);
}

// ═══════════════════════════════════════════════════════════════
// CANVAS — HECTARE LIJN GRAFIEK
// ═══════════════════════════════════════════════════════════════
function drawHaLine(c) {
  const cv = document.getElementById('cvs-ha-line');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const pL = 48, pR = 16, pT = 18, pB = 34;
  const gW = W - pL - pR, gH = H - pT - pB;
  const pts  = [15, 20, 25, 30, 35, 40, 45, 50, 55];
  const vals = pts.map(n => n * S.water / 1000);
  const maxV = Math.max(...vals) * 1.15;

  for (let i = 0; i <= 4; i++) {
    const y = pT + gH - (i / 4) * gH;
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + gW, y); ctx.stroke();
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'right';
    ctx.fillText((maxV * i / 4).toFixed(1), pL - 4, y + 3);
  }
  ctx.save(); ctx.translate(12, pT + gH / 2); ctx.rotate(-Math.PI / 2);
  ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'center';
  ctx.fillText('m³/h', 0, 0); ctx.restore();

  ctx.strokeStyle = '#1D9E75'; ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((n, i) => {
    const x = pL + (i / (pts.length - 1)) * gW;
    const y = pT + gH - (vals[i] / maxV) * gH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  pts.forEach((n, i) => {
    const x = pL + (i / (pts.length - 1)) * gW;
    const y = pT + gH - (vals[i] / maxV) * gH;
    ctx.beginPath(); ctx.arc(x, y, n === S.NT ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = n === S.NT ? '#EF9F27' : '#1D9E75'; ctx.fill();
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'center';
    ctx.fillText(n, x, pT + gH + 16);
  });

  ctx.font = '9px sans-serif'; ctx.fillStyle = '#888'; ctx.textAlign = 'center';
  ctx.fillText('torens per hectare', pL + gW / 2, pT + gH + 29);
}

// ═══════════════════════════════════════════════════════════════
// UTILITY — pijl tekenen op canvas
// ═══════════════════════════════════════════════════════════════
function drawArrow(ctx, x1, y1, x2, y2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 7 * Math.cos(a - 0.4), y2 - 7 * Math.sin(a - 0.4));
  ctx.lineTo(x2 - 7 * Math.cos(a + 0.4), y2 - 7 * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fill();
}

// ═══════════════════════════════════════════════════════════════
// MASTER RENDER
// ═══════════════════════════════════════════════════════════════
function renderAll() {
  const c = compute();
  renderGeometrie(c);
  renderPerformance(c);
  renderDubbel(c);
  renderHectare(c);
  renderNozzles(c);
  renderVD();
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════
function initTabs() {
  document.querySelectorAll('.nb').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nb').forEach(b => b.classList.remove('act'));
      document.querySelectorAll('.tp').forEach(p => p.classList.remove('act'));
      btn.classList.add('act');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('act');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ft-ts').textContent =
    new Date().toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' });

  buildGeomInputs();
  buildSliders('klimaat', 'sl-klimaat');
  buildSliders('water',   'sl-water');
  buildSliders('ha',      'sl-ha');
  buildSliders('nozzle',  'sl-nozzle');
  buildSliders('vd',      'sl-vd');
  initTabs();
  renderAll();
});

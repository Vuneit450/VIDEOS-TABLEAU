// charts.js — catálogo de visuales. Cada uno recibe (root, data{cols,rows}, worksheet).
var CHARTS = (function () {
  'use strict';
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;

  // ---- SANKEY DE EMBUDO ---------------------------------------------------------------
  // Datos: una fila por etapa (Measure Names = "1 · Etapa") y un valor numérico.
  // Dibuja el flujo etapa→etapa y, en cada paso, la rama que se pierde.
  function sankey(root, d) {
    var mn = 'Measure Names', vcol = d.cols.find(function (c) { return c === 'Multiple Values' || c === 'Measure Values'; });
    // suma por etapa (si la hoja viene partida por canal u otra dimensión, se agrega)
    var agg = {};
    d.rows.forEach(function (r) {
      var lab = String(r[mn + '__f'] || r[mn]), k = V.strip(lab);
      if (!agg[k]) agg[k] = { label: k, ord: V.ord(lab), v: 0 };
      agg[k].v += V.num(r[vcol]) || 0;
    });
    var st = Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b) { return a.ord - b.ord; });
    var g = V.svg(root), s = g.s, W = g.w, H = g.h;
    if (!st.length || !st[0].v) { txt(s, 12, 24, 'Sin datos para los filtros elegidos', { fill: C.mute }); return; }
    var n = st.length, padL = 8, padR = 8, top = 34, bot = 18;
    var colW = Math.max(10, Math.min(16, W / 60)), gap = (W - padL - padR - colW) / (n - 1);
    var flowH = (H - top - bot) * 0.5, k = flowH / st[0].v;
    var lossY = top + flowH + 18;
    var defs = el('defs', {}, s);
    var gr = el('linearGradient', { id: 'gl', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el('stop', { offset: '0%', 'stop-color': C.slate, 'stop-opacity': .55 }, gr); el('stop', { offset: '100%', 'stop-color': C.slate, 'stop-opacity': .15 }, gr);
    st.forEach(function (a, i) {
      var x = padL + i * gap, h = Math.max(1.5, a.v * k);
      // flujo hacia la siguiente etapa (parte superior) y pérdida (curva hacia abajo)
      if (i < n - 1) {
        var b = st[i + 1], hb = Math.max(1.5, b.v * k), x2 = padL + (i + 1) * gap, mx = (x + colW + x2) / 2;
        var p = el('path', { d: 'M' + (x + colW) + ',' + top + ' C' + mx + ',' + top + ' ' + mx + ',' + top + ' ' + x2 + ',' + top +
          ' L' + x2 + ',' + (top + hb) + ' C' + mx + ',' + (top + hb) + ' ' + mx + ',' + (top + hb) + ' ' + (x + colW) + ',' + (top + hb) + 'Z',
          fill: C.navy, 'fill-opacity': .28 }, s);
        var conv = b.v / a.v;
        V.tip(p, [a.label + ' → ' + b.label, fmt.n(b.v) + ' de ' + fmt.n(a.v) + ' (' + fmt.p(conv) + ')']);
        var lost = Math.max(0, a.v - b.v), lh = Math.max(1.5, lost * k), y0 = top + hb, xl = x + colW + Math.min(gap * 0.42, 90);
        if (lost > 0) { var lp = el('path', { d: 'M' + (x + colW) + ',' + y0 + ' C' + xl + ',' + y0 + ' ' + xl + ',' + y0 + ' ' + xl + ',' + (lossY) +
          ' L' + (xl - lh) + ',' + lossY + ' C' + (xl - lh) + ',' + (y0 + lh) + ' ' + (x + colW) + ',' + (y0 + lh) + ' ' + (x + colW) + ',' + (top + h) + 'Z', fill: 'url(#gl)' }, s);
        V.tip(lp, ['Se pierden entre ' + a.label.toLowerCase() + ' y ' + b.label.toLowerCase(), fmt.n(lost) + ' cuentas (' + fmt.p(1 - conv) + ')']);
        txt(s, xl + 4, lossY - 4, '−' + fmt.n(lost) + ' (' + fmt.p(1 - conv, 0) + ')', { 'text-anchor': 'start', 'font-size': 10.5, fill: C.mute }); }
        // tasa de conversión sobre el flujo
        var bx = (x + colW + x2) / 2, by = top + hb / 2 + 4;
        var bad = conv < 0.15;
        var pill = el('g', {}, s);
        el('rect', { x: bx - 30, y: by - 13, width: 60, height: 20, rx: 10, fill: '#fff', stroke: bad ? C.red : C.navy, 'stroke-width': 1.2 }, pill);
        txt(pill, bx, by + 1, conv > 1 ? '×' + conv.toFixed(1) : fmt.p(conv), { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: bad ? C.red : C.navy });
      }
      var r = el('rect', { x: x, y: top, width: colW, height: h, fill: C.navy, rx: 2 }, s);
      V.tip(r, [a.label, fmt.n(a.v) + ' cuentas', fmt.p(a.v / st[0].v) + ' de las asignadas']);
      var anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', lx = i === 0 ? x : i === n - 1 ? x + colW : x + colW / 2;
      txt(s, lx, 13, a.label, { 'text-anchor': anchor, 'font-size': 11, fill: C.mute });
      txt(s, lx, 28, fmt.n(a.v), { 'text-anchor': anchor, 'font-size': 14, 'font-weight': 700, fill: C.ink });
    });
    // etapa que más frena
    var worst = null;
    for (var i = 1; i < n; i++) { var c = st[i].v / st[i - 1].v; if (!worst || c < worst.c) worst = { c: c, i: i }; }
    txt(s, W - padR, H - 4, 'Mayor caída: ' + st[worst.i - 1].label.toLowerCase() + ' → ' + st[worst.i].label.toLowerCase() + ' (solo ' + fmt.p(worst.c) + ' avanza)',
      { 'text-anchor': 'end', 'font-size': 10.5, fill: C.red });
  }

  // ---- ENJAMBRE (BEESWARM) ------------------------------------------------------------
  // Datos: agentes con Turno, Adherencia, Jornadas, Retraso. Una bolita por agente, una fila por turno.
  function enjambre(root, d) {
    var name = V.find(d.cols, /Nombre|Asesor|Empleado/i) || d.cols[0];
    var turno = V.find(d.cols, /Turno/i);
    var rows = V.pivot(d, [name, turno].filter(Boolean));
    var adh = Object.keys(rows[0] || {}).find(function (c) { return /Adherencia/i.test(c); });
    var jor = Object.keys(rows[0] || {}).find(function (c) { return /Jornadas/i.test(c); });
    var ret = Object.keys(rows[0] || {}).find(function (c) { return /Retraso/i.test(c); });
    var pts = rows.map(function (r) { return { n: r[name], t: r[turno] || 'Sin turno', a: V.num(r[adh]), j: V.num(r[jor]) || 1, r: V.num(r[ret]) }; })
      .filter(function (p) { return p.a != null && p.t !== 'Sin turno' && p.t !== 'Null'; });
    var g = V.svg(root), s = g.s, W = g.w, H = g.h;
    if (!pts.length) { txt(s, 12, 24, 'Sin agentes para los filtros elegidos', { fill: C.mute }); return; }
    var turns = Array.from(new Set(pts.map(function (p) { return p.t; }))).sort();
    var L = 86, R = 16, T = 22, B = 30, META = 0.8;
    var x = function (v) { return L + Math.max(0, Math.min(1, v)) * (W - L - R); };
    var band = (H - T - B) / turns.length;
    var maxJ = Math.max.apply(null, pts.map(function (p) { return p.j; }));
    var rad = function (j) { return 3 + 5 * Math.sqrt(j / maxJ); };
    // ejes
    for (var t = 0; t <= 1.0001; t += 0.2) {
      el('line', { x1: x(t), x2: x(t), y1: T - 6, y2: H - B, stroke: C.grid }, s);
      txt(s, x(t), H - B + 14, Math.round(t * 100) + '%', { 'text-anchor': 'middle', 'font-size': 10, fill: C.mute });
    }
    el('rect', { x: L, y: T - 6, width: x(META) - L, height: H - B - T + 6, fill: C.red, 'fill-opacity': .05 }, s);
    el('line', { x1: x(META), x2: x(META), y1: T - 10, y2: H - B, stroke: C.red, 'stroke-dasharray': '4 3' }, s);
    txt(s, x(META) + 4, T - 10, 'Meta ' + Math.round(META * 100) + '%', { 'font-size': 10, fill: C.red });
    txt(s, L, H - 4, 'Adherencia de jornada · tamaño = jornadas trabajadas', { 'font-size': 10, fill: C.mute });
    turns.forEach(function (tn, ti) {
      var cy = T + band * ti + band / 2;
      var grp = pts.filter(function (p) { return p.t === tn; }).sort(function (a, b) { return b.j - a.j; });
      var below = grp.filter(function (p) { return p.a < META; }).length;
      txt(s, 6, cy - 2, tn, { 'font-size': 12, 'font-weight': 700 });
      txt(s, 6, cy + 13, below + ' de ' + grp.length + ' bajo meta', { 'font-size': 10, fill: below ? C.red : C.mute });
      // colocación sin traslapes (enjambre simple)
      var placed = [];
      grp.forEach(function (p) {
        var px = x(p.a), r = rad(p.j), py = cy, k = 0;
        while (k < 400) {
          var off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.2;
          py = cy + off;
          if (!placed.some(function (q) { var dx = q.x - px, dy = q.y - py; return dx * dx + dy * dy < (q.r + r + 0.8) * (q.r + r + 0.8); })) break;
          k++;
        }
        py = Math.max(T + band * ti + r, Math.min(T + band * (ti + 1) - r, py));
        placed.push({ x: px, y: py, r: r });
        var c = el('circle', { cx: px, cy: py, r: r, fill: p.a < META ? C.red : C.navy, 'fill-opacity': .78, stroke: '#fff', 'stroke-width': .8 }, s);
        V.tip(c, [String(p.n), tn + ' · ' + fmt.p(p.a) + ' de adherencia', fmt.n(p.j) + ' jornadas' + (p.r != null ? ' · retraso prom. ' + p.r.toFixed(0) + ' min' : '')]);
      });
      if (ti < turns.length - 1) el('line', { x1: 4, x2: W - R, y1: T + band * (ti + 1), y2: T + band * (ti + 1), stroke: C.grid }, s);
    });
  }

  return { sankey: sankey, enjambre: enjambre };
})();
// ---- DEBUG: imprime columnas y primeras filas --------------------------------------------
CHARTS.debug = function (root, d) {
  root.textContent = '';
  var pre = document.createElement('pre'); pre.style.cssText = 'font-size:11px;margin:6px;white-space:pre-wrap';
  pre.textContent = 'rows ' + d.rows.length + ' dims ' + d.dims.join(',') + '\n' + d.cols.join(' | ') + '\n' + d.rows.slice(0, 12).map(function (r) { return d.cols.map(function (c) { return r[c + '__f'] + '{' + typeof r[c] + ':' + r[c] + '}'; }).join(' | '); }).join('\n');
  root.appendChild(pre);
};

// ---- SOL (SUNBURST) ----------------------------------------------------------------------
// Anillo interior = primera dimensión (segmento), exterior = segunda (estado). Tamaño = medida "Cuentas".
CHARTS.sol = function (root, d) {
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;
  var dims = d.dims;
  var inner = V.find(d.cols, /Segmento/i) || dims[1], outer = V.find(d.cols, /Estado/i) || dims[0];
  var val = V.find(d.cols, /^Cuentas$/i) || d.cols[d.cols.length - 1];
  var g = V.svg(root), s = g.s, W = g.w, H = g.h;
  var groups = {}; d.rows.forEach(function (r) { var k = r[inner]; (groups[k] = groups[k] || []).push({ k: r[outer], v: V.num(r[val]) || 0 }); });
  var keys = Object.keys(groups).sort(function (a, b) { return parseInt(a) - parseInt(b); });
  var total = 0; keys.forEach(function (k) { groups[k].tot = groups[k].reduce(function (a, b) { return a + b.v; }, 0); total += groups[k].tot; });
  if (!total) { txt(s, 12, 24, 'Sin datos', { fill: C.mute }); return; }
  var R = Math.min(W * 0.55, H) / 2 - 8, cx = R + 10, cy = H / 2, r0 = R * 0.42, r1 = R * 0.72;
  var pal = ['#0C447C', '#2F6DB0', '#5C93CF', '#9EC2E8', '#16365A'];
  function arc(a0, a1, ri, ro) {
    var la = a1 - a0 > Math.PI ? 1 : 0, s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1);
    return 'M' + (cx + ro * s0) + ',' + (cy - ro * c0) + 'A' + ro + ',' + ro + ' 0 ' + la + ' 1 ' + (cx + ro * s1) + ',' + (cy - ro * c1) +
      'L' + (cx + ri * s1) + ',' + (cy - ri * c1) + 'A' + ri + ',' + ri + ' 0 ' + la + ' 0 ' + (cx + ri * s0) + ',' + (cy - ri * c0) + 'Z';
  }
  var a = 0, ly = 18;
  keys.forEach(function (k, i) {
    var gk = groups[k], span = gk.tot / total * Math.PI * 2, col = pal[i % pal.length];
    var p = el('path', { d: arc(a, a + span - 0.004, r0, r1), fill: col, stroke: '#fff', 'stroke-width': 1 }, s);
    V.tip(p, ['Segmento ' + k, fmt.n(gk.tot) + ' cuentas · ' + fmt.p(gk.tot / total) + ' de la cartera']);
    var b = a;
    gk.sort(function (x, y) { return /Sigue/i.test(x.k) ? -1 : 1; }).forEach(function (o) {
      var sp = o.v / total * Math.PI * 2, alive = /Sigue/i.test(o.k);
      var q = el('path', { d: arc(b, b + sp - 0.004, r1 + 2, R), fill: alive ? C.teal : '#C9D1DC', stroke: '#fff', 'stroke-width': 1 }, s);
      V.tip(q, [k + ' · ' + o.k, fmt.n(o.v) + ' cuentas', fmt.p(o.v / gk.tot) + ' del segmento']);
      b += sp;
    });
    // leyenda / ranking a la derecha
    var lx = cx + R + 24, live = (gk.find(function (o) { return /Sigue/i.test(o.k); }) || { v: 0 }).v;
    if (lx < W - 60) {
      el('rect', { x: lx, y: ly - 9, width: 10, height: 10, fill: col, rx: 2 }, s);
      txt(s, lx + 16, ly, k, { 'font-size': 12, 'font-weight': 700 });
      txt(s, lx + 16, ly + 15, fmt.n(gk.tot) + ' cuentas · ' + fmt.p(live / gk.tot, 0) + ' sigue en gestión', { 'font-size': 10.5, fill: C.mute });
      ly += 38;
    }
    a += span;
  });
  var alive = keys.reduce(function (acc, k) { return acc + (groups[k].find(function (o) { return /Sigue/i.test(o.k); }) || { v: 0 }).v; }, 0);
  txt(s, cx, cy - 2, fmt.n(total), { 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: C.navy });
  txt(s, cx, cy + 14, 'cuentas', { 'text-anchor': 'middle', 'font-size': 10, fill: C.mute });
  var lx2 = cx + R + 24;
  if (lx2 < W - 60) {
    el('rect', { x: lx2, y: ly - 3, width: 10, height: 10, fill: C.teal, rx: 2 }, s); txt(s, lx2 + 16, ly + 6, 'Sigue en gestión (' + fmt.p(alive / total) + ')', { 'font-size': 10.5 });
    el('rect', { x: lx2, y: ly + 13, width: 10, height: 10, fill: '#C9D1DC', rx: 2 }, s); txt(s, lx2 + 16, ly + 22, 'Retirada de gestión', { 'font-size': 10.5 });
  }
};

// ---- WAFFLE --------------------------------------------------------------------------------
// 100 cuadros = 100% de los casos; cada estatus colorea su parte. Muestra conteo y monto.
CHARTS.waffle = function (root, d) {
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;
  var cat = d.cols.find(function (c) { return typeof d.rows[0][c] === 'string'; });
  var cnt = V.find(d.cols, /^Promesas$|Cuentas|Gestiones/i), amt = V.find(d.cols, /Monto/i);
  var order = { CONFIRMADO: 0, PROGRAMADO: 1, VENCIDO: 2 }, colr = { CONFIRMADO: C.green, PROGRAMADO: C.amber, VENCIDO: C.red };
  var it = d.rows.map(function (r) { return { k: r[cat], n: V.num(r[cnt]) || 0, m: amt ? V.num(r[amt]) : null }; })
    .sort(function (a, b) { return (order[a.k] ?? 9) - (order[b.k] ?? 9); });
  var tot = it.reduce(function (a, b) { return a + b.n; }, 0);
  var g = V.svg(root), s = g.s, W = g.w, H = g.h;
  if (!tot) { txt(s, 12, 24, 'Sin datos', { fill: C.mute }); return; }
  // reparto de 100 cuadros por residuo mayor (al menos 1 si hay casos)
  var cells = it.map(function (o) { return Math.max(o.n ? 1 : 0, Math.floor(o.n / tot * 100)); });
  var diff = 100 - cells.reduce(function (a, b) { return a + b; }, 0);
  var big = it.map(function (o, i) { return i; }).sort(function (a, b) { return it[b].n - it[a].n; })[0]; cells[big] += diff;
  var side = Math.min((W * 0.5) / 10, (H - 20) / 10), gap = Math.max(1.5, side * 0.12), x0 = 8, y0 = (H - side * 10) / 2;
  var idx = 0;
  it.forEach(function (o, i) {
    for (var c = 0; c < cells[i]; c++, idx++) {
      var col = idx % 10, row = Math.floor(idx / 10);
      var r = el('rect', { x: x0 + col * side, y: y0 + row * side, width: side - gap, height: side - gap, rx: 2, fill: colr[o.k] || C.slate }, s);
      V.tip(r, [o.k, fmt.n(o.n) + ' promesas · ' + fmt.p(o.n / tot), o.m != null ? 'Monto ' + fmt.m(o.m) : '']);
    }
  });
  var lx = x0 + side * 10 + 18, ly = y0 + 14;
  it.forEach(function (o) {
    txt(s, lx, ly, o.k, { 'font-size': 11, fill: colr[o.k] || C.mute, 'font-weight': 700 });
    txt(s, lx, ly + 22, fmt.n(o.n), { 'font-size': 20, 'font-weight': 700, fill: C.ink });
    txt(s, lx + 6 + String(fmt.n(o.n)).length * 11, ly + 22, fmt.p(o.n / tot) + (o.m != null ? ' · ' + fmt.m(o.m) : ''), { 'font-size': 11, fill: C.mute });
    ly += Math.max(46, (side * 10) / it.length);
  });
};

// ---- CALOR (matriz / calendario) -----------------------------------------------------------
// Dos dimensiones (filas, columnas) + una medida. Escala secuencial; totales al margen.
function vals0(d, c) { var m = 0; d.rows.forEach(function (r) { var v = V.num(r[c]); if (v != null && Math.abs(v) > m) m = Math.abs(v); }); return m; }
CHARTS.calor = function (root, d) {
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;
  var strs = d.dims.filter(function (c) { return !/texto|Etiqueta/i.test(c); });
  var nums = d.cols.filter(function (c) { return d.dims.indexOf(c) < 0 && !/texto|Etiqueta/i.test(c); });
  var isDate = function (c) { return d.rows.some(function (r) { return r[c] instanceof Date; }); };
  var dateCol = d.cols.find(isDate);
  var rowC, colC, valC;
  if (dateCol) { colC = dateCol; rowC = strs.find(function (c) { return c !== dateCol; }); valC = V.find(nums, /seleccionad|Cumplimiento|Adherencia/i) || nums.find(function (c) { return c !== colC; }); }
  else { rowC = strs.find(function (c) { return !/Hora/i.test(c); }); colC = strs.find(function (c) { return c !== rowC; }); valC = V.find(nums, /seleccionad/i) || nums[nums.length - 1]; }
  var pct = /Adherencia|Cumplimiento|%/i.test(valC) || (vals0(d, valC) <= 1.5);
  var rk = [], ck = [], M = {};
  d.rows.forEach(function (r) {
    var a = r[rowC], b = r[colC]; if (a == null || a === 'Null' || b == null) return;
    var bk = b instanceof Date ? b.toISOString().slice(0, 10) : b;
    if (rk.indexOf(a) < 0) rk.push(a); if (ck.indexOf(bk) < 0) ck.push(bk);
    M[a + '|' + bk] = V.num(r[valC]);
  });
  var dow = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  rk.sort(function (a, b) { var i = dow.indexOf(a), j = dow.indexOf(b); return i >= 0 && j >= 0 ? i - j : String(a).localeCompare(b); });
  ck.sort(function (a, b) { var x = parseFloat(a), y = parseFloat(b); return !isNaN(x) && !isNaN(y) && !/-/.test(a) ? x - y : a < b ? -1 : a > b ? 1 : 0; });
  var vals = Object.keys(M).map(function (k) { return M[k]; }).filter(function (v) { return v != null; });
  var lo = pct ? Math.min.apply(null, vals) : 0, hi = Math.max.apply(null, vals);
  var g = V.svg(root), s = g.s, W = g.w, H = g.h;
  if (!vals.length) { txt(s, 12, 24, 'Sin datos', { fill: C.mute }); return; }
  var L = Math.min(210, Math.max(50, Math.max.apply(null, rk.map(function (r) { return String(r).length; })) * 6.2 + 12)), T = 22, R = 56, B = 26;
  var cw = (W - L - R) / ck.length, ch = Math.min(34, (H - T - B) / rk.length);
  function color(v) {
    if (v == null) return '#F3F5F8';
    var t = (v - lo) / ((hi - lo) || 1);
    if (pct) { // divergente: rojo (bajo) → blanco → azul (alto)
      var m = /Cumplimiento/i.test(valC) ? 0.7 : 0.8; var u = v < m ? (v - lo) / ((m - lo) || 1) : 1 + (v - m) / ((hi - m) || 1);
      return u < 1 ? mix('#C8203E', '#F7F7F7', u) : mix('#F7F7F7', '#0C447C', Math.min(1, u - 1));
    }
    return mix('#EAF2FB', '#0C447C', Math.sqrt(t));
  }
  function mix(a, b, t) {
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); }), pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
    return 'rgb(' + pa.map(function (x, i) { return Math.round(x + (pb[i] - x) * t); }).join(',') + ')';
  }
  var f = pct ? function (v) { return fmt.p(v, 0); } : /Monto/i.test(valC) ? function (v) { return '$' + fmt.k(v); } : fmt.k;
  var step = Math.ceil(ck.length / Math.max(1, Math.floor((W - L - R) / 42)));
  ck.forEach(function (c, j) {
    if (j % step === 0) {
      var lab = /^\d{4}-\d{2}-\d{2}$/.test(c) ? parseInt(c.slice(8)) + '/' + parseInt(c.slice(5, 7)) : c;
      txt(s, L + j * cw + cw / 2, T - 6, lab, { 'text-anchor': 'middle', 'font-size': 10, fill: C.mute });
    }
  });
  rk.forEach(function (r, i) {
    var y = T + i * ch, rowTot = 0, n = 0;
    txt(s, L - 8, y + ch / 2 + 4, r, { 'text-anchor': 'end', 'font-size': 11 });
    ck.forEach(function (c, j) {
      var v = M[r + '|' + c];
      if (v != null) { rowTot += v; n++; }
      var rect = el('rect', { x: L + j * cw + 1, y: y + 1, width: Math.max(1, cw - 2), height: ch - 2, rx: 2, fill: color(v) }, s);
      V.tip(rect, [r + ' · ' + (/^\d{4}-/.test(c) ? c.split('-').reverse().join('/') : c + (/Hora/i.test(colC) ? ' h' : '')), V.clean(valC) + ': ' + (v == null ? 'sin dato' : pct ? fmt.p(v) : /Monto/i.test(valC) ? fmt.m(v) : fmt.n(v))]);
      if (v != null && cw > 30 && ch > 16) txt(s, L + j * cw + cw / 2, y + ch / 2 + 4, f(v), { 'text-anchor': 'middle', 'font-size': 9.5, fill: (pct ? Math.abs(v - 0.8) > 0.12 : (v - lo) / ((hi - lo) || 1) > 0.45) ? '#fff' : C.ink });
    });
    txt(s, W - R + 6, y + ch / 2 + 4, pct ? fmt.p(n ? rowTot / n : null, 0) : f(rowTot), { 'font-size': 10.5, 'font-weight': 700, fill: C.navy });
  });
  txt(s, W - R + 6, T - 6, pct ? 'Prom.' : 'Total', { 'font-size': 10, fill: C.mute });
  txt(s, L, T + rk.length * ch + 16, V.clean(valC) + (pct ? ' · rojo = bajo ' + (/Cumplimiento/i.test(valC) ? '70' : '80') + '%, azul = arriba' : ' · más oscuro = más alto'), { 'font-size': 10, fill: C.mute });
};

// ---- PUNTUALIDAD (barra apilada ordenada con rampa de color) --------------------------------
CHARTS.puntualidad = function (root, d) {
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;
  var cat = d.cols.find(function (c) { return typeof d.rows[0][c] === 'string'; }), val = d.cols.find(function (c) { return typeof d.rows[0][c] === 'number'; });
  var it = d.rows.map(function (r) { return { k: String(r[cat]), n: V.num(r[val]) || 0 }; }).sort(function (a, b) { return parseInt(a.k) - parseInt(b.k); });
  var tot = it.reduce(function (a, b) { return a + b.n; }, 0);
  var g = V.svg(root), s = g.s, W = g.w, H = g.h;
  if (!tot) { txt(s, 12, 24, 'Sin datos', { fill: C.mute }); return; }
  var ramp = ['#2E7D32', '#9CCC65', '#F2C14E', '#EF7D32', '#C8203E'];
  var L = 8, R = 8, bh = Math.min(46, H * 0.28), y = 34, x = L, w = W - L - R;
  var onTime = it[0] ? it[0].n / tot : 0;
  txt(s, L, 16, fmt.p(onTime, 0) + ' de las jornadas empiezan a tiempo', { 'font-size': 13, 'font-weight': 700, fill: onTime >= 0.8 ? C.green : C.red });
  it.forEach(function (o, i) {
    var ww = o.n / tot * w;
    var r = el('rect', { x: x, y: y, width: Math.max(0, ww - 1), height: bh, fill: ramp[i] || C.slate }, s);
    V.tip(r, [o.k.replace(/^\d+\s*·\s*/, ''), fmt.n(o.n) + ' jornadas · ' + fmt.p(o.n / tot)]);
    if (ww > 34) txt(s, x + ww / 2, y + bh / 2 + 4, fmt.p(o.n / tot, 0), { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: i === 1 || i === 2 ? C.ink : '#fff' });
    x += ww;
  });
  var ly = y + bh + 22, cols = Math.max(1, Math.floor(w / 150));
  it.forEach(function (o, i) {
    var cx = L + (i % cols) * (w / cols), cy = ly + Math.floor(i / cols) * 34;
    el('rect', { x: cx, y: cy - 9, width: 10, height: 10, rx: 2, fill: ramp[i] }, s);
    txt(s, cx + 15, cy, o.k.replace(/^\d+\s*·\s*/, ''), { 'font-size': 10.5 });
    txt(s, cx + 15, cy + 14, fmt.n(o.n) + ' jornadas', { 'font-size': 10, fill: C.mute });
  });
};

// ---- DISPERSIÓN POR CUADRANTES -----------------------------------------------------------
// x = retraso promedio (min), y = adherencia; tamaño = jornadas; cuadrantes con meta.
CHARTS.cuadrantes = function (root, d) {
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;
  var name = V.find(d.cols, /Nombre|Asesor|Empleado/i), turno = V.find(d.cols, /Turno/i);
  var rows = V.pivot(d, [name, turno].filter(Boolean)), k0 = Object.keys(rows[0] || {});
  var adh = k0.find(function (c) { return /Adherencia/i.test(c); }), ret = k0.find(function (c) { return /Retraso/i.test(c); }), jor = k0.find(function (c) { return /Jornadas/i.test(c); });
  var pts = rows.map(function (r) { return { n: r[name], t: r[turno], a: V.num(r[adh]), r: V.num(r[ret]), j: V.num(r[jor]) || 1 }; })
    .filter(function (p) { return p.a != null && p.r != null && p.t && p.t !== 'Null'; });
  var g = V.svg(root), s = g.s, W = g.w, H = g.h;
  if (!pts.length) { txt(s, 12, 24, 'Sin datos', { fill: C.mute }); return; }
  var L = 44, R = 14, T = 16, B = 34, META = 0.8, TOL = 15;
  var rmin = Math.min(-30, Math.min.apply(null, pts.map(function (p) { return p.r; }))), rmax = Math.max(60, Math.max.apply(null, pts.map(function (p) { return p.r; })));
  var X = function (v) { return L + (v - rmin) / (rmax - rmin) * (W - L - R); }, Y = function (v) { return T + (1 - Math.max(0, Math.min(1, v))) * (H - T - B); };
  el('rect', { x: X(TOL), y: Y(META), width: W - R - X(TOL), height: H - B - Y(META), fill: C.red, 'fill-opacity': .07 }, s);
  el('rect', { x: L, y: T, width: X(TOL) - L, height: Y(META) - T, fill: C.green, 'fill-opacity': .07 }, s);
  [0, .2, .4, .6, .8, 1].forEach(function (v) { el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: C.grid }, s); txt(s, L - 4, Y(v) + 3, Math.round(v * 100) + '%', { 'text-anchor': 'end', 'font-size': 9.5, fill: C.mute }); });
  var stp = (rmax - rmin) > 200 ? 60 : 30;
  for (var v = Math.ceil(rmin / stp) * stp; v <= rmax; v += stp) txt(s, X(v), H - B + 13, v + '', { 'text-anchor': 'middle', 'font-size': 9.5, fill: C.mute });
  el('line', { x1: X(TOL), x2: X(TOL), y1: T, y2: H - B, stroke: C.red, 'stroke-dasharray': '4 3' }, s);
  el('line', { x1: L, x2: W - R, y1: Y(META), y2: Y(META), stroke: C.red, 'stroke-dasharray': '4 3' }, s);
  txt(s, L + 4, T + 11, 'Puntuales y cumplidos', { 'font-size': 10, fill: C.green, 'font-weight': 700 });
  txt(s, W - R - 4, H - B - 6, 'Llegan tarde y no cumplen', { 'text-anchor': 'end', 'font-size': 10, fill: C.red, 'font-weight': 700 });
  txt(s, (L + W - R) / 2, H - 4, 'Retraso promedio de entrada (min) · tolerancia ' + TOL + ' min', { 'text-anchor': 'middle', 'font-size': 10, fill: C.mute });
  var maxJ = Math.max.apply(null, pts.map(function (p) { return p.j; }));
  var tc = { Matutino: C.amber, Vespertino: C.navy };
  pts.sort(function (a, b) { return b.j - a.j; }).forEach(function (p) {
    var bad = p.a < META && p.r > TOL;
    var c = el('circle', { cx: X(p.r), cy: Y(p.a), r: 3 + 6 * Math.sqrt(p.j / maxJ), fill: tc[p.t] || C.slate, 'fill-opacity': .7, stroke: bad ? C.red : '#fff', 'stroke-width': bad ? 2 : 1 }, s);
    V.tip(c, [String(p.n), p.t + ' · ' + fmt.n(p.j) + ' jornadas', 'Adherencia ' + fmt.p(p.a) + ' · retraso ' + p.r.toFixed(0) + ' min']);
  });
  var lx = W - R - 150;
  Object.keys(tc).forEach(function (k, i) { el('circle', { cx: lx + i * 80, cy: T + 6, r: 5, fill: tc[k] }, s); txt(s, lx + 8 + i * 80, T + 10, k, { 'font-size': 10 }); });
};

// ---- DISPERSIÓN (esfuerzo vs resultado) ---------------------------------------------------
// x = medida de esfuerzo (llamadas), y = resultado (monto). Líneas de mediana = 4 cuadrantes.
CHARTS.dispersion = function (root, d) {
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;
  var name = V.find(d.dims, /Asesor|Nombre/i) || d.dims[0], grp = d.dims.find(function (c) { return c !== name; });
  var ms = d.cols.filter(function (c) { return d.dims.indexOf(c) < 0; });
  var xc = V.find(ms, /Llamadas/i) || ms[0], yc = V.find(ms, /Monto/i) || ms.find(function (c) { return c !== xc; });
  var pts = d.rows.map(function (r) { return { n: r[name], g: grp ? r[grp] : '', x: V.num(r[xc]), y: V.num(r[yc]) }; }).filter(function (p) { return p.x != null && p.y != null; });
  var g = V.svg(root), s = g.s, W = g.w, H = g.h;
  if (!pts.length) { txt(s, 12, 24, 'Sin datos', { fill: C.mute }); return; }
  var L = 62, R = 16, T = 18, B = 34;
  var mx = Math.max.apply(null, pts.map(function (p) { return p.x; })) * 1.05 || 1, my = Math.max.apply(null, pts.map(function (p) { return p.y; })) * 1.08 || 1;
  var X = function (v) { return L + v / mx * (W - L - R); }, Y = function (v) { return H - B - v / my * (H - T - B); };
  function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }
  var act = pts.filter(function (p) { return p.x > 0; }), qx = med(act.map(function (p) { return p.x; })), qy = med(act.map(function (p) { return p.y; }));
  var money = /Monto|Pago/i.test(yc) ? function (v) { return '$' + fmt.k(v); } : fmt.k;
  for (var i = 0; i <= 4; i++) {
    var vy = my / 1.08 * i / 4, vx = mx / 1.05 * i / 4;
    el('line', { x1: L, x2: W - R, y1: Y(vy), y2: Y(vy), stroke: C.grid }, s); txt(s, L - 6, Y(vy) + 3, money(vy), { 'text-anchor': 'end', 'font-size': 9.5, fill: C.mute });
    txt(s, X(vx), H - B + 14, fmt.k(vx), { 'text-anchor': 'middle', 'font-size': 9.5, fill: C.mute });
  }
  el('rect', { x: X(qx), y: Y(qy), width: W - R - X(qx), height: H - B - Y(qy), fill: C.red, 'fill-opacity': .06 }, s);
  el('line', { x1: X(qx), x2: X(qx), y1: T, y2: H - B, stroke: C.slate, 'stroke-dasharray': '4 3' }, s);
  el('line', { x1: L, x2: W - R, y1: Y(qy), y2: Y(qy), stroke: C.slate, 'stroke-dasharray': '4 3' }, s);
  txt(s, W - R - 4, H - B - 6, 'Mucho esfuerzo, poco resultado', { 'text-anchor': 'end', 'font-size': 10, 'font-weight': 700, fill: C.red });
  txt(s, L + 6, T + 10, 'Poco esfuerzo, mucho resultado', { 'font-size': 10, 'font-weight': 700, fill: C.green });
  txt(s, (L + W - R) / 2, H - 4, V.clean(xc) + ' (líneas punteadas = mediana del equipo)', { 'text-anchor': 'middle', 'font-size': 10, fill: C.mute });
  var groups = Array.from(new Set(pts.map(function (p) { return p.g; }))).sort(), pal = [C.navy, C.amber, C.teal, C.red];
  pts.forEach(function (p) {
    var col = pal[groups.indexOf(p.g) % pal.length];
    var c = el('circle', { cx: X(p.x), cy: Y(p.y), r: 6, fill: col, 'fill-opacity': .8, stroke: '#fff', 'stroke-width': 1 }, s);
    V.tip(c, [String(p.n), V.clean(xc) + ': ' + fmt.n(p.x), V.clean(yc) + ': ' + (/Monto|Pago/i.test(yc) ? fmt.m(p.y) : fmt.n(p.y)), p.g ? V.strip(p.g) : '']);
    var out = (p.x > qx && p.y < qy * 0.9) || p.y < qy * 0.5;
    if (out) txt(s, X(p.x) + 8, Y(p.y) + 3, String(p.n).split(' ').slice(0, 2).join(' '), { 'font-size': 9.5, fill: C.ink });
  });
  if (grp) groups.forEach(function (gname, i) { var lx = W - R - 190, ly = T + 4 + i * 15; el('circle', { cx: lx, cy: ly, r: 5, fill: pal[i % pal.length] }, s); txt(s, lx + 9, ly + 4, V.strip(gname), { 'font-size': 10 }); });
};

// ---- ENJAMBRE genérico (una medida, agrupada por una dimensión) -----------------------------
var _enjAdh = CHARTS.enjambre;
CHARTS.enjambre = function (root, d) {
  if (d.cols.some(function (c) { return /Adherencia/i.test(c); }) || d.cols.indexOf('Measure Names') >= 0) return _enjAdh(root, d);
  var C = V.C, el = V.el, txt = V.txt, fmt = V.fmt;
  var name = V.find(d.dims, /Asesor|Nombre/i) || d.dims[0], grp = d.dims.find(function (c) { return c !== name; });
  var mcols = d.cols.filter(function (c) { return d.dims.indexOf(c) < 0; });
  var vc = V.find(mcols, /Monto|Pago|Llamadas/i) || mcols[0];
  var money = /Monto|Pago/i.test(vc);
  var pts = d.rows.map(function (r) { return { n: r[name], g: grp ? V.strip(r[grp]) : 'Todos', v: V.num(r[vc]) }; }).filter(function (p) { return p.v != null; });
  var g = V.svg(root), s = g.s, W = g.w, H = g.h;
  if (!pts.length) { txt(s, 12, 24, 'Sin datos', { fill: C.mute }); return; }
  var groups = Array.from(new Set(pts.map(function (p) { return p.g; }))).sort();
  var L = 150, R = 20, T = 14, B = 30, mx = Math.max.apply(null, pts.map(function (p) { return p.v; })) * 1.05;
  var X = function (v) { return L + v / mx * (W - L - R); }, band = (H - T - B) / groups.length;
  var all = pts.map(function (p) { return p.v; }).sort(function (a, b) { return a - b; }), med = all[Math.floor(all.length / 2)];
  for (var i = 0; i <= 5; i++) { var v = mx / 1.05 * i / 5; el('line', { x1: X(v), x2: X(v), y1: T, y2: H - B, stroke: C.grid }, s); txt(s, X(v), H - B + 14, (money ? '$' : '') + fmt.k(v), { 'text-anchor': 'middle', 'font-size': 9.5, fill: C.mute }); }
  el('line', { x1: X(med), x2: X(med), y1: T, y2: H - B, stroke: C.navy, 'stroke-dasharray': '4 3' }, s);
  txt(s, X(med) + 4, T + 8, 'Mediana ' + (money ? fmt.m(med) : fmt.n(med)), { 'font-size': 10, fill: C.navy });
  txt(s, L, H - 4, V.clean(vc) + ' · cada punto es un asesor', { 'font-size': 10, fill: C.mute });
  var pal = [C.navy, C.amber, C.teal, C.red];
  groups.forEach(function (gn, gi) {
    var cy = T + band * gi + band / 2, grp2 = pts.filter(function (p) { return p.g === gn; }), placed = [];
    txt(s, 6, cy - 2, gn, { 'font-size': 11.5, 'font-weight': 700, fill: pal[gi % pal.length] });
    txt(s, 6, cy + 13, grp2.length + ' asesores', { 'font-size': 10, fill: C.mute });
    grp2.forEach(function (p) {
      var px = X(p.v), r = 6, py = cy, k = 0;
      while (k < 300) { py = cy + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.5; if (!placed.some(function (q) { var dx = q.x - px, dy = q.y - py; return dx * dx + dy * dy < (2 * r + 1) * (2 * r + 1); })) break; k++; }
      placed.push({ x: px, y: py });
      var c = el('circle', { cx: px, cy: py, r: r, fill: pal[gi % pal.length], 'fill-opacity': .8, stroke: '#fff' }, s);
      V.tip(c, [String(p.n), V.clean(vc) + ': ' + (money ? fmt.m(p.v) : fmt.n(p.v)), gn]);
    });
  });
};

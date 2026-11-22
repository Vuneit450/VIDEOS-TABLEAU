// core.js — lectura de datos y utilidades SVG compartidas por todos los visuales.
var V = (function () {
  'use strict';
  var C = { navy: '#0C447C', ink: '#14202e', mute: '#55657A', grid: '#E3E8EF', red: '#C8203E', amber: '#C77700', green: '#2E7D32', slate: '#8392AA', light: '#B9D3EE', teal: '#16A3A3' };
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) {
    var t = el('text', Object.assign({ x: x, y: y, 'font-size': 11, fill: C.ink }, attrs || {}), parent);
    t.textContent = s; return t;
  }
  var tipEl = document.getElementById('tip');
  function tip(node, lines) {
    node.addEventListener('mousemove', function (ev) {
      tipEl.textContent = '';
      lines.forEach(function (l, i) {
        var d = document.createElement('div');
        if (i === 0) { var b = document.createElement('b'); b.textContent = l; d.appendChild(b); } else d.textContent = l;
        tipEl.appendChild(d);
      });
      tipEl.style.display = 'block';
      var x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + 290 > innerWidth) x = ev.clientX - 290;
      if (y + tipEl.offsetHeight > innerHeight) y = ev.clientY - tipEl.offsetHeight - 10;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    });
    node.addEventListener('mouseleave', function () { tipEl.style.display = 'none'; });
  }
  function svg(root) {
    root.textContent = '';
    var w = Math.min(root.clientWidth || innerWidth, document.documentElement.clientWidth || innerWidth), h = Math.min(root.clientHeight || innerHeight, document.documentElement.clientHeight || innerHeight);
    var s = el('svg', { width: '100%', height: '100%', viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'xMidYMid meet' }, root);
    return { s: s, w: w, h: h };
  }
  var fmt = {
    n: function (v) { return v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('es-MX'); },
    p: function (v, d) { return v == null || isNaN(v) ? '—' : (v * 100).toFixed(d == null ? 1 : d) + '%'; },
    m: function (v) { return v == null || isNaN(v) ? '—' : '$' + Math.round(v).toLocaleString('es-MX'); },
    k: function (v) { if (v == null || isNaN(v)) return '—'; var a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K' : Math.round(v) + ''; }
  };
  // Nombre limpio: quita AGG(...), SUM(...) etc.
  function clean(n) { var m = /^[A-Z]+\((.*)\)$/.exec(n); return m ? m[1] : n; }
  // Lee los datos resumidos de la hoja anfitriona -> {cols:[nombres], rows:[{nombre: valor}], raw}
  async function read(ws) {
    var r = await ws.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
    var all = { columns: null, data: [] };
    for (var i = 0; i < r.pageCount; i++) {
      var p = await r.getPageAsync(i);
      all.columns = p.columns; all.data = all.data.concat(p.data);
    }
    await r.releaseAsync();
    var keep = all.columns.map(function (c, i) { return /Descripci[oó]n|\(tooltip\)/i.test(c.fieldName) ? -1 : i; }).filter(function (i) { return i >= 0; });
    all.columns = keep.map(function (i) { return all.columns[i]; });
    all.data = all.data.map(function (row) { return keep.map(function (i) { return row[i]; }); });
    var cols = all.columns.map(function (c) { return clean(c.fieldName); });
    // dimensiones = campos no agregados; se leen por su valor formateado (texto que ve el usuario)
    // dimensión = campo no agregado, o cuyo valor es texto (p. ej. ATTR(Estado))
    var dims = all.columns.filter(function (c, i) {
      if (c.fieldName === 'Measure Values' || c.fieldName === 'Multiple Values') return false;
      if (!/^[A-Z]+\(/.test(c.fieldName)) return true;
      var v = all.data.map(function (r) { return r[i].nativeValue; }).find(function (x) { return x != null && x !== '%null%'; });
      return typeof v === 'string';
    }).map(function (c) { return clean(c.fieldName); });
    var rows = all.data.map(function (d) {
      var o = {};
      d.forEach(function (c, i) {
        var v = c.nativeValue;
        if (v === '%null%' || c.value === '%null%') v = null;
        if (dims.indexOf(cols[i]) >= 0 && !(v instanceof Date)) v = c.formattedValue === '%null%' || c.formattedValue === 'Null' ? null : c.formattedValue;
        o[cols[i]] = v; o[cols[i] + '__f'] = c.formattedValue;
      });
      return o;
    });
    return { cols: cols, rows: rows, dims: dims };
  }
  // Pivotea formato largo (Measure Names / Measure Values o Multiple Values) a ancho.
  function pivot(d, keys) {
    var mn = 'Measure Names', mv = d.cols.find(function (c) { return c === 'Measure Values' || c === 'Multiple Values'; });
    if (d.cols.indexOf(mn) < 0 || !mv) return d.rows;
    var map = {};
    d.rows.forEach(function (r) {
      var k = keys.map(function (c) { return r[c]; }).join('');
      if (!map[k]) { map[k] = {}; keys.forEach(function (c) { map[k][c] = r[c]; }); }
      map[k][clean(String(r[mn + '__f'] || r[mn]))] = r[mv];
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function ord(s) { s = String(s); var c = '①②③④⑤⑥⑦⑧⑨'.indexOf(s.trim()[0]); return c >= 0 ? c + 1 : parseInt(s, 10) || 0; }
  function strip(s) { return String(s).replace(/^\s*([①-⑨]|\d+\s*·)\s*/, ''); }
  function num(v) { return typeof v === 'number' ? v : v == null ? null : parseFloat(v); }
  function find(cols, re) { return cols.find(function (c) { return re.test(c); }); }
  return { C: C, el: el, txt: txt, tip: tip, svg: svg, fmt: fmt, read: read, pivot: pivot, num: num, ord: ord, strip: strip, find: find, clean: clean };
})();

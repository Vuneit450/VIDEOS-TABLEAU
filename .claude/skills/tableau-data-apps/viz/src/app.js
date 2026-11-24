// app.js — elige el visual según el prefijo del nombre de la hoja: "X <Tipo> · ..."
(function () {
  'use strict';
  var root = document.getElementById('app');
  var ws, last;
  function err(m) { root.textContent = ''; var p = document.createElement('p'); p.className = 'error'; p.textContent = m; root.appendChild(p); }
  function pick(name) {
    var m = /^X ([A-Za-zÁÉÍÓÚáéíóúñ]+)/.exec(name);
    return m && CHARTS[m[1].toLowerCase()];
  }
  async function draw() {
    try {
      var chart = pick(ws.name);
      if (!chart) return err('Visual no reconocido para la hoja "' + ws.name + '". Tipos: ' + Object.keys(CHARTS).join(', '));
      last = await V.read(ws);
      chart(root, last, ws);
    } catch (e) { err('No se pudieron leer los datos: ' + ((e && (e.message || e.errorCode)) || e)); }
  }
  var t;
  function redraw() { if (last) { var c = pick(ws.name); c && c(root, last, ws); } }
  window.addEventListener('resize', redraw);
  if (window.ResizeObserver) new ResizeObserver(redraw).observe(document.documentElement);
  tableau.extensions.initializeAsync().then(function () {
    ws = tableau.extensions.worksheetContent.worksheet;
    ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, draw);
    draw();
  }).catch(function (e) { err('Extensions API: ' + ((e && e.message) || e)); });
})();

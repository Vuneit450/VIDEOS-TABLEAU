---
name: tableau-data-apps
description: Rediseña libros de Tableau Cloud (sitio grupogabssa) con visuales avanzados (Sankey, enjambre, sol, waffle, calor, dispersión) como viz extensions empaquetadas dentro del libro. Hace una copia, nunca toca el original, y la publica en el proyecto Pruebas. Úsala cuando pidan "mejorar los gráficos", "data apps", "viz extensions" o replicar el piloto de TIK TOK / Total Play en otro libro.
---

# Rediseño de libros de Tableau con data apps

Piloto validado el 22/11/2026 con **TIK TOK Comite v23** y **Total Play**. Cuatro copias publicadas en *Pruebas*.

## Reglas

- Los originales **nunca** se sobrescriben ni se mueven. Se trabaja sobre una copia descargada y se publica con un nombre nuevo en *Pruebas* (`f9ab466f-c8f4-4940-943c-38736c657c1b`).
- Los datos son de clientes reales. Los `.twbx` descargados viven solo en el scratchpad: no se suben al repo ni salen de Tableau.
- No se fuerza un visual. Una vista solo se cambia si el visual nuevo responde mejor su pregunta. Las tablas de detalle y los KPI que ya funcionan se quedan.

## Lo que aprendimos (léelo antes de empezar)

1. **No hace falta hospedaje.** El sitio no tiene orígenes externos permitidos (`allowedOrigins` vacío en `scaffold-data-app`). La extensión va **empaquetada** dentro del `.twbx`, en `Packages/<id>/content/`, y se referencia como `tableaulocalext:///<id>/content/index.html`. Tableau Cloud la ejecuta e incluso la pinta en las imágenes de la REST API. Consecuencia: nada de CDN, todo el JS va dentro del paquete (por eso los gráficos son SVG a mano, sin D3).
2. **No consultes la fuente desde la extensión.** `datasource.queryAsync` / `readMetadataAsync` fallan con `internal-error` sobre las fuentes publicadas (sqlproxy) del sitio.
3. **La técnica que sí funciona es clonar la hoja.** Se copia el XML de la hoja original que ya calcula el dato y solo se cambia su `<mark>` por `VizExtension` + `<add-in>`. La copia conserva filtros, parámetros (Periodo, Segmento, Canal), cálculos y acciones. La extensión lee lo mismo que veía la hoja con `getSummaryDataReaderAsync` y se redibuja con `SummaryDataChanged`. Los números siempre cuadran con el original.
4. **Descarga con la API REST y el PAT, con extractos.** `GET /workbooks/{id}/content` (sin `includeExtract=false`, o TIK TOK pierde sus `.hyper` y la copia falla). Así se evita el enlace de S3 de 60 s del MCP.
5. **Publicación:** `POST /workbooks?overwrite=false` con `multipart/mixed` (con `multipart/form-data` la API responde 406). Para iterar sobre **tu** copia usa `overwrite=true`.
6. **Dashboards con tamaño "rango"** (p. ej. Comité, 1400–2300 px) dejan el marco de la extensión más ancho que la zona y el gráfico sale recortado. Solución: `fix_size` en el spec los pasa a tamaño fijo con su ancho máximo.
7. **Hojas ocultas no son vistas:** para revisar una extensión, toma imagen del dashboard que la contiene. El caché de imágenes dura ~1 min: espera antes de volver a tomarla, o cambia `vizWidth`.
8. **Campos de ayuda:** los libros traen muchos `Descripción (tooltip)` y etapas con `①②③` o `1 · `. `core.js` ya los ignora y normaliza. Un campo `ATTR(texto)` se trata como dimensión.

## Herramientas (`herramientas/tableau-data-apps/`)

| Archivo | Qué hace |
|---|---|
| `build/tab.py` | Inicia sesión con `TABLEAU_PAT_NAME` / `TABLEAU_PAT_SECRET` / `TABLEAU_SITE` y publica (`python3 tab.py copia.twbx "Nombre" [ow]`) |
| `build/clone.py` | `clone.py original.twbx salida.twbx spec.json`: clona hojas, mete la extensión, cambia zonas de dashboard, títulos y tamaño |
| `build/shot.py` | Imágenes de las vistas de un libro (`OUT=carpeta python3 shot.py <wbId> "Vista"…`) |
| `build/debugshot.py` | Junta en una imagen las hojas `X Debug N`, para ver columnas y valores reales |
| `viz/` | **Un solo paquete** (`com.binatsa.viz`) con todos los visuales; elige el visual por el nombre de la hoja: `X <Tipo> · Título` |
| `specs/*.json` | Specs del piloto, para usar de ejemplo |

Spec mínimo:

```json
{"apps":[{"id":"com.binatsa.viz","name":"Binatsa Viz","content_dir":"herramientas/tableau-data-apps/viz"}],
 "fix_size":["Comité"],
 "sheets":[{"from":"Embudo de llamadas","sheet":"X Sankey · Embudo de llamadas","app":"com.binatsa.viz",
            "hidden":true,"dashboard":"Operación","replace_zone":"Embudo de llamadas",
            "title_from":"(opcional) hoja de la que copiar el título",
            "title_replace":[["texto viejo","texto nuevo"]]}]}
```

## Catálogo de visuales (`viz/src/charts.js`)

| Tipo (`X <Tipo>`) | Qué datos espera la hoja clonada | Cuándo aporta |
|---|---|---|
| `Sankey` | Measure Names = etapas ordenadas (`1 ·`, `①`) + un valor; si viene partida por canal, suma | Embudos: muestra cuánto se pierde en cada paso y marca la mayor caída. Mejor visual del piloto |
| `Enjambre` | Agente + medida (+ grupo). Modo adherencia: Turno + Adherencia/Jornadas, meta 80% | Ver a **todos** los agentes y los atípicos, no solo un top 10 |
| `Sol` | Dos dimensiones (segmento, estado) + Cuentas | Jerarquía con peso: cartera por segmento → sigue / retirada |
| `Waffle` | Estatus + conteo (+ monto) | Proporciones que se cuentan en cuadros (promesas vencidas, programadas, confirmadas) |
| `Calor` | Fila × columna (fecha u hora) + medida; detecta % y usa escala divergente | Patrones por día y hora, cumplimiento diario por asesor y turno |
| `Puntualidad` | Categoría ordenada + conteo | Distribución ordenada en una sola barra con rampa verde → rojo |
| `Cuadrantes` | Agente, Turno, Adherencia, Retraso, Jornadas | Puntualidad contra cumplimiento, con zonas de acción |
| `Dispersion` | Agente (+ grupo) + 2 medidas (Llamadas, Monto) | Esfuerzo contra resultado, con medianas del equipo |
| `Debug` | Cualquiera | Imprime columnas, tipos y filas: úsalo antes de diseñar |

Para agregar un visual: crea `CHARTS.nuevo = function (root, d) {…}` en `charts.js`. `d` trae `{cols, rows, dims}`, y cada fila trae el valor nativo y `campo__f` (texto formateado). Usa `V.svg`, `V.tip` y `V.fmt` de `core.js`.

## Auditoría de datos (hacer siempre)

- **Clics guardados:** si el libro se publicó con una selección activa, las hojas que reciben esa acción quedan filtradas para todos. Busca en el `.twb` `<filter ... column='...[Action (...)]'>` con `member=`. Se limpia en la copia con `clear_action_filters` en el spec.
- **Antes de llamar error a dos cifras distintas, revisa unidad y fecha base** (p. ej. *cuentas* con pago por fecha de asignación contra *pagos* por fecha de pago). Los títulos deben decir qué cuentan.

- **Revisa el denominador de cada KPI de cumplimiento.** Si la fórmula filtra filas (p. ej. "solo asesor-días con llamadas"), puede esconder justo el problema: casos asignados a quien no trabajó. Compara contra el total sin filtro con `query-datasource` (el MCP puede consultar las fuentes embebidas pasando `workbookLuid`).

## Cambios nativos (sin extensión) que soporta `clone.py`

- `kpi_clones`: clona una tarjeta KPI con sus cálculos renombrados (`prefix_from` → `prefix_to`), cambia la fórmula con `formula_replace` y la pone en lugar de otra zona de un dashboard.
- `sheet_edits`: reemplazos o `regex_remove` dentro de una sola hoja (p. ej. quitar una codificación de color).
- `raw_replace`: reemplazos literales en todo el `.twb` (títulos, valor por omisión de un parámetro, fórmula de un cálculo).
- Al cambiar la hoja de una zona, el copiador también traslada su ajuste de zoom (`<viewpoint>` en la ventana del dashboard). Sin eso, una tarjeta de texto sale angosta y con "#####".

## Reglas de diseño (revisión experta, 23/11/2026)

- **Sankey solo si las etapas están anidadas** (cada una ≤ la anterior). Si no, el visual cambia solo a barras (TIK TOK: 711 promesas > 326 contactos clave).
- **Sunburst no.** Con segmentos chicos (27 cuentas) desaparecen; las barras apiladas lo dicen mejor.
- **Enjambre solo con muchos agentes (30+).** Con menos, usa `Ranking` (con nombres, mediana y tope para atípicos).
- **Calor:** solo columnas con datos; celda punteada = sin dato, distinta de 0.
- **Dispersión:** títulos en ambos ejes y nombres solo en extremos y en el cuadrante de alerta, sin solapes.
- **Tarjetas KPI:** si no hay comparativo, no mostrar "- vs periodo previo" (`raw_replace` en el spec vacía el texto).
- **Título = métrica:** si el gráfico muestra monto prometido, el título no dice "recupera".

## Proceso

1. **Auditar.** Lista los dashboards y sus zonas (regex sobre el `.twb`) y toma imagen de cada dashboard del original con `shot.py`. Por vista anota la pregunta que responde, la audiencia y las visitas (más visitas = más prioridad).
2. **Elegir candidatos.** Busca embudos en barras (→ Sankey), tops N (→ Enjambre), donas con dos niveles (→ Sol), mapas de calor en tabla (→ Calor), dispersiones con pocos puntos legibles (→ Dispersion / Cuadrantes).
3. **Revisar los datos.** Crea un spec con hojas `X Debug N` clonadas de cada candidata, publícalo como *"<libro> - prueba extension"* y corre `debugshot.py`. Así ves los nombres reales de columnas y si vienen en formato largo (Measure Names).
4. **Versión A (mejorada):** 2–3 cambios donde el visual nuevo gana claramente. **Versión B (desde cero):** todos los cambios que aporten, más `fix_size` si hay dashboards con rango.
5. **Publicar** en Pruebas como `<libro> – A mejorada` / `<libro> – B desde cero`, tomar imágenes y revisarlas. Itera con `ow`.
6. **Reportar:** tabla vista → visual original → nuevo → por qué. Avisa de los libros de prueba (`- prueba extension`) para que el usuario decida si se borran.

## Resultado del piloto

| Libro | Vista | Original | Nuevo | Por qué |
|---|---|---|---|---|
| Total Play A/B | Dirección · Embudo | Barras | Sankey | Muestra la tasa de paso y lo que se pierde: la caída promesa → pago (2.6%) salta a la vista |
| Total Play A/B | Operación · Adherencia | Top 10 en puntos | Enjambre por turno | Se ven los 21+ agentes y cuántos están bajo la meta en cada turno |
| Total Play B | Dirección · Segmento | Dona | Sol segmento → estado | Une dos vistas: tamaño del segmento y % que sigue en gestión |
| Total Play B | Dirección · Promesas | 3 números | Waffle | La proporción 95% vencidas se entiende sin leer |
| Total Play B | Operación · Calor día×hora | Tabla de calor | Calor con totales por día | Escala más clara, respeta el selector de métrica |
| Total Play B | Operación · Hora de entrada | Barras | Barra de puntualidad | Un titular ("71% a tiempo") y la distribución en una línea |
| Total Play B | Seguimiento · Adherencia diaria | Líneas | Calor turno × día | Los días malos (24/10) se ven en rojo |
| Total Play B | Seguimiento · Agentes | Tabla | Cuadrantes | Puntualidad contra cumplimiento, con zonas de acción |
| TIK TOK A/B | Dirección · ¿Dónde se pierde? | Barras apiladas | Sankey | Antes las etapas finales no se leían |
| TIK TOK A/B | Operación · Llamadas a promesa | Barras (201K contra 326) | Sankey | Sin Sankey solo se veía la barra de marcadas |
| TIK TOK A/B | Operación · Esfuerzo o resultado | Dispersión casi vacía | Dispersión con medianas | Cuadrante "mucho esfuerzo, poco resultado" marcado |
| TIK TOK B | Operación · Horas, Seguimiento · Cumplimiento, Comité · Semáforo | Tablas de calor | Calor | Escala consistente y totales por fila |
| TIK TOK B | Comité · Eficiencia, Desempeño · Ranking y Pago/hora | Dispersión / ranking / texto | Dispersión y Enjambre | Distribución completa por estado de meta y mediana |

**Lecciones TIK TOK vs Total Play:** el Sankey y el enjambre aportan en ambos. Los dos libros comparten estructura (Dirección / Operación / Seguimiento), así que los mismos specs se adaptan cambiando nombres de hojas. TIK TOK necesitó limpiar campos de ayuda y arreglar el tamaño de los dashboards de Comité. Total Play, no. Pendiente para replicar: los proyectos GMF y Comisiones tienen permisos bloqueados al proyecto; verifica que puedas leerlos antes de descargar.

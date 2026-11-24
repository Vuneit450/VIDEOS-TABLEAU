---
name: tableau-data-apps
description: Plantilla para mejorar libros de Tableau Cloud con visuales avanzados (Sankey, ranking, enjambre, waffle, mapa de calor, dispersión, cuadrantes) empaquetados como viz extensions dentro del libro, más ajustes nativos (tarjetas KPI, títulos, colores, tamaño) y una auditoría de datos. Trabaja siempre sobre una copia publicada en un proyecto de pruebas; nunca toca el original. Úsala cuando pidan "mejorar los gráficos/tableros", "data apps", "viz extensions", "revisar un libro de Tableau" o replicar el proceso en otro libro.
---

# Mejora de libros de Tableau con data apps (plantilla)

## Configuración (una vez por entorno)

Variables de entorno que usan los scripts:

| Variable | Qué es | Ejemplo |
|---|---|---|
| `TABLEAU_SERVER` | URL del pod de Tableau Cloud | `https://us-east-1.online.tableau.com` |
| `TABLEAU_SITE` | `contentUrl` del sitio | `mi-sitio` |
| `TABLEAU_PAT_NAME` / `TABLEAU_PAT_SECRET` | Token de acceso personal (PAT) | — |
| `TABLEAU_PROJECT_ID` | Id del proyecto de **pruebas** donde se publican las copias | id del proyecto (con `list-projects` del MCP) |

Si el PAT falla con `401001`, el token caducó o el nombre no coincide: hay que generar uno nuevo en Tableau (Configuración de mi cuenta → Tokens de acceso personal).

## Reglas

- Los originales **nunca** se sobrescriben ni se mueven: se descarga, se copia y se publica con nombre nuevo en el proyecto de pruebas. Para corregir el original, pide autorización explícita.
- Los `.twbx` descargados tienen datos de clientes: van solo al scratchpad, nunca al repo. Tampoco van al repo specs con nombres de hojas o títulos de clientes; en `specs/` solo queda la plantilla.
- No se fuerza un visual. Una vista cambia solo si el visual nuevo responde mejor su pregunta; las tablas de detalle y los KPI que ya funcionan se quedan.
- Antes de enviar o publicar algo fuera de Tableau, muéstralo al usuario.

## Cómo funciona (léelo antes de empezar)

1. **Sin hospedaje.** Si el sitio no tiene orígenes externos permitidos (`allowedOrigins` vacío en `scaffold-data-app`), la extensión va **empaquetada** en el `.twbx` (`Packages/<id>/content/`) y se referencia como `tableaulocalext:///<id>/content/index.html`. Tableau Cloud la ejecuta y la pinta también en las imágenes de la API. Nada de CDN: todo el JS va en el paquete (gráficos en SVG a mano).
2. **No consultes la fuente desde la extensión.** `datasource.queryAsync` / `readMetadataAsync` fallan (`internal-error`) con fuentes publicadas (sqlproxy).
3. **Clona la hoja.** Se copia el XML de la hoja original que ya calcula el dato y solo se cambia su `<mark>` por `VizExtension` + `<add-in>`. Conserva filtros, parámetros, cálculos y acciones; la extensión lee los datos con `getSummaryDataReaderAsync` y se redibuja con `SummaryDataChanged`. Los números cuadran con el original.
4. **Descarga** con REST y el PAT: `GET /workbooks/{id}/content` **con** extractos (con `includeExtract=false` los libros con `.hyper` fallan). Evita el enlace de S3 de 60 s del MCP.
5. **Publica** con `POST /workbooks` en `multipart/mixed` (con `form-data` la API responde 406). Para iterar sobre tu copia, `overwrite=true` (`ow`).
6. **Dashboards con tamaño por rango** dejan el marco de la extensión más ancho que la zona y el gráfico sale recortado: `fix_size` los fija a su ancho máximo.
7. **Hojas ocultas no son vistas**: revisa la extensión en la imagen del dashboard. El caché de imágenes dura ~1 min.
8. **Al cambiar la hoja de una zona**, el copiador traslada su ajuste de zoom (`<viewpoint>`). Sin eso, una tarjeta de texto sale angosta y con "#####".

## Herramientas

| Archivo | Uso |
|---|---|
| `scripts/tab.py` | `python3 tab.py copia.twbx "Nombre" [ow]`: publica en `TABLEAU_PROJECT_ID` |
| `scripts/clone.py` | `python3 clone.py original.twbx salida.twbx spec.json`: arma la copia según el spec |
| `scripts/shot.py` | `OUT=carpeta python3 shot.py <wbId> "Vista"…`: imágenes de las vistas |
| `scripts/debugshot.py` | `python3 debugshot.py <wbId> salida.png`: junta las hojas `X Debug N` para ver columnas y valores reales |
| `viz/` | Paquete único `com.binatsa.viz`; elige el visual por el nombre de la hoja: `X <Tipo> · Título` |
| `specs/ejemplo.json` | Plantilla de spec con todas las opciones |

### Opciones del spec (`specs/ejemplo.json`)

| Clave | Qué hace |
|---|---|
| `sheets` | Clona hojas como extensión (`from`, `sheet` = `X <Tipo> · …`, `dashboard`, `replace_zone`, `hidden`, `title_from`, `title_replace`) |
| `kpi_clones` | Tarjeta KPI **nativa** nueva a partir de otra, con fórmula propia (`prefix_from`/`prefix_to`, `formula_replace`, `caption_replace`, `title_replace`), puesta en lugar de una zona |
| `sheet_edits` | Reemplazos o `regex_remove` dentro de una sola hoja (p. ej. quitar una codificación de color) |
| `raw_replace` | Reemplazos literales en todo el `.twb`: títulos, valor por omisión de un parámetro, fórmula de un cálculo. Falla si el texto no existe |
| `clear_action_filters` | Quita selecciones de acciones guardadas al publicar (el clic sigue funcionando) |
| `fix_size` | Pasa dashboards de tamaño por rango a fijo |

## Catálogo de visuales (`viz/src/charts.js`)

| Tipo | Datos que espera la hoja clonada | Cuándo usarlo |
|---|---|---|
| `Sankey` | Measure Names = etapas ordenadas (`1 ·`, `①`) + un valor; suma si viene partida por otra dimensión | Embudos anidados. Si alguna etapa supera a la anterior, cae solo a barras |
| `Ranking` | Persona (+ grupo) + una medida | Rankings con nombre, mediana y tope para atípicos. Preferible al enjambre con menos de 30 personas |
| `Enjambre` | Persona + medida (+ grupo); modo adherencia: Turno + Adherencia/Jornadas, meta 80% | Distribución completa con 30+ personas |
| `Waffle` | Estatus + conteo (+ monto) | Proporciones de pocas categorías |
| `Calor` | Fila × columna (fecha u hora) + medida; detecta % y usa escala divergente | Patrones por día/hora o por persona/día. Omite columnas vacías; celda punteada = sin dato |
| `Puntualidad` | Categoría ordenada + conteo | Distribución ordenada en una barra (verde → rojo) con titular |
| `Cuadrantes` | Persona, Turno, Adherencia, Retraso, Jornadas | Puntualidad contra cumplimiento con zonas de acción |
| `Dispersion` | Persona (+ grupo) + 2 medidas | Esfuerzo contra resultado, medianas, ejes titulados y etiquetas sin solape |
| `Sol` | Dos dimensiones + conteo | Casi nunca: con segmentos chicos desaparecen; usa barras apiladas |
| `Debug` | Cualquiera | Imprime columnas, tipos y filas antes de diseñar |

Para agregar un visual: `CHARTS.nuevo = function (root, d) {…}` en `charts.js`. `d` trae `{cols, rows, dims}`; cada fila trae el valor nativo y `campo__f` (texto formateado). Usa `V.svg`, `V.tip` y `V.fmt` de `core.js`. Colores de marca en `V.C` (`core.js`).

## Auditoría de datos (siempre, antes de diseñar)

- **Clics guardados:** busca en el `.twb` `<filter … column='…[Action (…)]'>` con `member=`. Si existen, las hojas que reciben la acción están filtradas para todos (tarjetas infladas o encogidas). Límpialo con `clear_action_filters` y avisa que el original también lo tiene.
- **Denominadores de KPIs de cumplimiento:** si la fórmula filtra filas (p. ej. "solo persona-días con actividad"), puede esconder justo el problema. Compara contra el total sin filtro con `query-datasource` (fuentes embebidas: pasa `workbookLuid`).
- **Cifras que "no cuadran":** antes de llamarlas error, revisa unidad (cuentas contra eventos) y fecha base (asignación, gestión, pago). Si las dos son correctas, que el título diga qué cuenta.
- **Picos:** revisa si coinciden con calendario (quincenas, fines de semana) antes de marcarlos como anomalía.

## Reglas de diseño

- **Título = métrica**: si el gráfico muestra monto prometido, el título no dice "recupera".
- **Tarjetas KPI**: si no hay comparativo, no mostrar "- vs periodo previo" (vacíalo con `raw_replace`).
- **Color con significado**: rojo solo para "malo". Categorías ordinales neutras (antigüedad, turnos) en un solo tono; define con el usuario qué dirección es buena para cada KPI.
- **Ejes de tiempo con fechas**, no índices (1…8).
- **Selectores**: el valor por omisión debe mostrar diferencias (un KPI que se topa en 100% para todos no sirve por omisión).

## Proceso

1. **Inventario.** `get-workbook` / `list-views` (visitas por vista = prioridad). Descarga el libro (REST + PAT) al scratchpad y lista dashboards y zonas desde el `.twb`. Toma imagen de cada dashboard con `shot.py`.
2. **Auditoría de datos** (sección anterior).
3. **Candidatos**: embudos en barras → Sankey; tops N → Ranking/Enjambre; mapas de calor en tabla → Calor; dispersiones ilegibles → Dispersion/Cuadrantes; tarjetas que esconden un problema → `kpi_clones`.
4. **Revisar datos de cada candidata**: spec con hojas `X Debug N`, publica como `<libro> - prueba extension`, corre `debugshot.py`.
5. **Versión A (mejorada)**: 2–3 cambios que ganan claramente. **Versión B**: todos los que aporten + ajustes nativos. Specs en el scratchpad, no en el repo.
6. **Publicar** en pruebas como `<libro> – A mejorada` / `<libro> – B desde cero`; revisar imágenes; iterar con `ow`.
7. **Revisión experta opcional**: un agente con rol de experto en dashboards evalúa las imágenes (original contra copia) y prioriza mejoras.
8. **Reportar**: tabla vista → visual original → nuevo → por qué; hallazgos de datos con cifras verificadas; pendientes que requieren definición de negocio. Pregunta si se borran los libros `- prueba extension`.

## Aprendizajes del piloto (2 libros de cobranza, nov 2026)

- Lo que más valor dio: **Sankey** en embudos, **Ranking/Enjambre** en lugar de "top 10", y la **auditoría de datos** (un clic guardado inflaba las tarjetas de agentes; un KPI de cumplimiento excluía a quien no trabajó).
- Lo que no funcionó: sunburst (segmentos invisibles), waffle con una categoría del 95%, enjambre con pocas personas.
- Libros con la misma estructura de dashboards (Dirección / Operación / Seguimiento) reutilizan casi el mismo spec cambiando nombres de hojas.
- Proyectos con permisos bloqueados: verifica que puedas leer el libro antes de descargarlo.

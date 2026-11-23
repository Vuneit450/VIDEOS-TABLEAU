"""clone.py SRC_TWBX OUT_TWBX SPEC_JSON
SPEC: {"apps":[{"id","name","content_dir"}], "sheets":[{"from":"existing ws","sheet":"new ws","app":"app id",
        "add_cols":[...optional column refs to add to <cols>], "dashboard":opt,"replace_zone":opt}],
       "drop_worksheets":opt[], "rename_dashboards":opt{}}
Clones an existing worksheet (keeping view/filters/params), swaps its mark for a packaged viz extension."""
import sys, json, zipfile, uuid, os, re
import xml.etree.ElementTree as ET
src, out, specf = sys.argv[1:4]
spec = json.load(open(specf))
here = os.path.dirname(os.path.abspath(__file__))
zin = zipfile.ZipFile(src)
twbname = [n for n in zin.namelist() if n.endswith('.twb')][0]
raw = zin.read(twbname).decode('utf-8')
for flag in ['<Extensions />','<VizExtensions />','<_.fcp.Packages.true...Packages />','<_.fcp.VizExtensionsDupEncodingUUID.true...VizExtensionsDupEncodingUUID />']:
    if flag not in raw:
        raw = raw.replace('<document-format-change-manifest>', '<document-format-change-manifest>\n    '+flag, 1)
def swap_viewpoint(raw, dash, old, new):
    # el ajuste de zoom de cada hoja en un dashboard vive en <window class='dashboard'><viewpoints>
    pat = re.compile(r"<window class='dashboard'[^>]*name='" + re.escape(esc(dash)) + r"'>.*?</window>", re.S)
    m = pat.search(raw)
    if not m: return raw
    w = m.group(0).replace(f"<viewpoint name='{esc(old)}'", f"<viewpoint name='{esc(new)}'")
    return raw[:m.start()] + w + raw[m.end():]

def esc(n): return n.replace('&','&amp;').replace("'",'&apos;')
def ws_block(name):
    m = re.search(r"\n\s*<worksheet name='" + re.escape(esc(name)) + r"'>.*?</worksheet>", raw, re.S)
    assert m, 'no worksheet '+name; return m
def win_block(name):
    m = re.search(r"\n\s*<window class='worksheet'[^>]*name='" + re.escape(esc(name)) + r"'.*?</window>", raw, re.S)
    return m
addin = lambda aid: (f"<mark class='VizExtension' />\n            <add-in add-in-id='{aid}' extension-url='tableaulocalext:///{aid}/content/index.html' extension-version='1.0.0' instance-id='{uuid.uuid4().hex.upper()}'>"
        "<instance-settings /><type-settings><worksheet /></type-settings></add-in>")
# --- Tarjetas KPI clonadas con otra fórmula (nativas, sin extensión) ---
for kc in spec.get('kpi_clones', []):
    if f"<worksheet name='{esc(kc['sheet'])}'>" in raw: continue
    pf, pt = kc['prefix_from'], kc['prefix_to']
    def tf(t):
        t = t.replace(pf, pt)
        for o, n in kc.get('formula_replace', []): t = t.replace(o, n)
        return t
    # 1) definiciones de cálculo en la fuente principal (primer bloque inline)
    m = re.search(r"<datasource [^>]*inline='true'[^>]*name='" + re.escape(kc['datasource']) + r"'[^>]*>.*?</datasource>", raw, re.S)
    ds = m.group(0)
    defs = re.findall(r"\s*<column [^>]*name='\[" + re.escape(pf) + r"[^\]]*\]'[^>]*>\s*<calculation[^>]*/>\s*</column>", ds)
    newdefs = ''.join(tf(d) for d in defs)
    for o, n in kc.get('caption_replace', []): newdefs = newdefs.replace(o, n)
    ds2 = ds.replace(defs[-1], defs[-1] + newdefs, 1)
    raw = raw[:m.start()] + ds2 + raw[m.end():]
    # 2) hoja y ventana
    b = ws_block(kc['from']).group(0).replace(f"<worksheet name='{esc(kc['from'])}'>", f"<worksheet name='{esc(kc['sheet'])}'>", 1)
    b = tf(b)
    for o, n in kc.get('caption_replace', []) + kc.get('title_replace', []): b = b.replace(o, n)
    b = re.sub(r"<simple-id uuid='[^']*' />", f"<simple-id uuid='{{{str(uuid.uuid4()).upper()}}}' />", b)
    b = re.sub(r"\s*<repository-location[^>]*/>", "", b)
    raw = raw.replace('</worksheets>', b + '\n  </worksheets>', 1)
    w = win_block(kc['from']).group(0).replace(f"name='{esc(kc['from'])}'", f"name='{esc(kc['sheet'])}'", 1)
    w = re.sub(r"<simple-id uuid='[^']*' />", f"<simple-id uuid='{{{str(uuid.uuid4()).upper()}}}' />", w)
    raw = raw.replace('</windows>', w + '\n  </windows>', 1)
    if kc.get('replace_zone'):
        pat = re.compile(r"<dashboard[^>]*name='" + re.escape(esc(kc['dashboard'])) + r"'.*?</dashboard>", re.S)
        mm = pat.search(raw); seg = mm.group(0)
        seg = re.sub(r"<zone ([^>]*)name='" + re.escape(esc(kc['replace_zone'])) + r"'([^>]*?)(/?)>", lambda z: f"<zone {z.group(1)}name='{esc(kc['sheet'])}'{z.group(2)}{z.group(3)}>", seg, count=1)
        raw = raw[:mm.start()] + seg + raw[mm.end():]
        raw = swap_viewpoint(raw, kc['dashboard'], kc['replace_zone'], kc['sheet'])
    print('kpi clonada', kc['sheet'], len(defs), 'cálculos')
# --- Ediciones dentro de una hoja concreta ---
for se in spec.get('sheet_edits', []):
    mb = ws_block(se['sheet']); b = mb.group(0)
    for o, n in se.get('replace', []):
        assert o in b, 'sheet_edit sin coincidencia en ' + se['sheet'] + ': ' + o[:60]
        b = b.replace(o, n)
    for rx in se.get('regex_remove', []): b = re.sub(rx, '', b, flags=re.S)
    raw = raw[:mb.start()] + b + raw[mb.end():]

refs = {}
new_ws, new_win = [], []
for sh in spec['sheets']:
    if f"<worksheet name='{esc(sh['sheet'])}'>" in raw: continue
    b = ws_block(sh['from']).group(0)
    b = b.replace(f"<worksheet name='{esc(sh['from'])}'>", f"<worksheet name='{esc(sh['sheet'])}'>", 1)
    if sh.get('title_from'):
        lo = re.search(r"<layout-options>.*?</layout-options>", ws_block(sh['title_from']).group(0), re.S)
        b = re.sub(r"\s*<layout-options>.*?</layout-options>", "", b, flags=re.S)
        if lo: b = b.replace("<table>", lo.group(0) + "\n      <table>", 1)
    # one pane only; replace mark
    for o, n in sh.get('title_replace', []): b = b.replace(o, n)
    b = re.sub(r"<mark class='[^']*' />", addin(sh['app']), b, count=1)
    b = re.sub(r"<customized-(tooltip|label)>.*?</customized-\1>", "", b, flags=re.S)
    b = re.sub(r"<simple-id uuid='[^']*' />", f"<simple-id uuid='{{{str(uuid.uuid4()).upper()}}}' />", b)
    b = re.sub(r"\s*<repository-location[^>]*/>", "", b)
    new_ws.append(b)
    w = win_block(sh['from'])
    wb = w.group(0) if w else f"\n    <window class='worksheet' name='{esc(sh['from'])}'><simple-id uuid='{{X}}' /></window>"
    wb = wb.replace(f"name='{esc(sh['from'])}'", f"name='{esc(sh['sheet'])}'", 1).replace(" maximized='true'", "").replace(" hidden='true'", "")
    wb = re.sub(r"<simple-id uuid='[^']*' />", f"<simple-id uuid='{{{str(uuid.uuid4()).upper()}}}' />", wb)
    if sh.get('hidden'): wb = wb.replace("<window class='worksheet'", "<window class='worksheet' hidden='true'", 1)
    new_win.append(wb)
    refs.setdefault(sh['app'], []).append(sh['sheet'])
raw = raw.replace('</worksheets>', ''.join(new_ws) + '\n  </worksheets>', 1)
raw = raw.replace('</windows>', ''.join(new_win) + '\n  </windows>', 1)
apps = {a['id']: a for a in spec['apps']}
def ref_xml(aid, sheets):
    a = apps[aid]
    rv = ''.join(f"<referenced-view instances='1' viewId='{esc(s)}' />" for s in sheets)
    return f"""<referenced-extension><manifest manifest-version='0.1'><worksheet-extension extension-version='1.0.0' id='{aid}'>
<default-locale>en_US</default-locale><name>{a['name']}</name><description>Embedded workbook extension.</description>
<author email='noreply@tableau.com' name='Binatsa' organization='Binatsa' website='https://www.tableau.com' />
<min-api-version>1.11</min-api-version><source-location><url>tableaulocalext:///{aid}/content/index.html</url></source-location>
<icon>iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=</icon>
<permissions><permission>full data</permission></permissions>
<encoding id='field'><display-name>Data</display-name><role-spec><role-type>discrete-dimension</role-type><role-type>discrete-measure</role-type><role-type>continuous-dimension</role-type><role-type>continuous-measure</role-type></role-spec><fields max-count='50' /><encoding-icon token='level' /></encoding>
</worksheet-extension></manifest><referenced-views>{rv}</referenced-views></referenced-extension>"""
r = ''.join(ref_xml(k, v) for k, v in refs.items())
if r:
    if '<referenced-extensions>' in raw: raw = raw.replace('</referenced-extensions>', r + '</referenced-extensions>', 1)
    else:
        m = re.search(r'</windows>', raw); raw = raw[:m.end()] + '\n  <referenced-extensions>' + r + '</referenced-extensions>' + raw[m.end():]
for sh in spec['sheets']:
    if sh.get('replace_zone'):
        pat = re.compile(r"<dashboard[^>]*name='" + re.escape(esc(sh['dashboard'])) + r"'.*?</dashboard>", re.S)
        m = pat.search(raw); assert m, sh['dashboard']
        seg = m.group(0).replace(f"name='{esc(sh['replace_zone'])}'", f"name='{esc(sh['sheet'])}'")
        raw = raw[:m.start()] + seg + raw[m.end():]
        raw = swap_viewpoint(raw, sh['dashboard'], sh['replace_zone'], sh['sheet'])
# Quita selecciones de acciones guardadas al publicar (equivale a limpiar el clic; la acción sigue viva)
for an in spec.get('clear_action_filters', []):
    col = re.escape('[' + an + ']')
    raw, k = re.subn(r"\s*<filter class='categorical' column='[^']*" + col + r"'>.*?</filter>", '', raw, flags=re.S)
    raw = re.sub(r"\s*<column>[^<]*" + col + r"</column>", '', raw)
    print('acción limpiada', an, k, 'hojas')
for o, n in spec.get('raw_replace', []):
    assert o in raw, 'raw_replace sin coincidencia: ' + o
    raw = raw.replace(o, n)
for dn in spec.get('fix_size', []):
    pat = re.compile(r"(<dashboard [^>]*name='" + re.escape(esc(dn)) + r"'>.*?)<size maxheight='(\d+)' maxwidth='(\d+)'[^/]*/>", re.S)
    raw = pat.sub(lambda m: m.group(1) + f"<size maxheight='{m.group(2)}' maxwidth='{m.group(3)}' minheight='{m.group(2)}' minwidth='{m.group(3)}' sizing-mode='fixed' />", raw, count=1)
ET.fromstring(raw.encode('utf-8'))
zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
for n in zin.namelist():
    if n == twbname: zout.writestr(n, raw)
    elif not n.startswith('Packages/'): zout.writestr(n, zin.read(n))
trex_t = open(os.path.join(here, 'data-app.trex')).read()
for a in spec['apps']:
    for dp, _, fs in os.walk(a['content_dir']):
        for f in fs:
            p = os.path.join(dp, f); zout.write(p, f"Packages/{a['id']}/content/" + os.path.relpath(p, a['content_dir']))
    zout.writestr(f"Packages/{a['id']}/manifest.json", json.dumps({"id": a['id'], "version": "1.0.0", "manifestVersion": "0.1", "name": a['name'], "author": "Binatsa", "requestedOrigins": ""}, indent=2))
    zout.writestr(f"Packages/{a['id']}/extensions/data-app.trex", trex_t.replace('TODO-MANIFEST-ID', a['id']).replace('TODO App Name', a['name']).replace('TODO-MANIFEST-VERSION', '1.0.0').replace('TODO Author Name', 'Binatsa'))
zout.close(); print('ok', out, sum(len(v) for v in refs.values()), 'sheets')

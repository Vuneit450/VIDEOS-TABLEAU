# Genera portadas 1600x560 con los personajes de cada video (sin logos).
# Uso: python3 herramientas/generar_portadas.py portadas portadas/logos
#      node herramientas/svg_a_png.mjs "$PWD/portadas" "$PWD/portadas"   (requiere Playwright)
# Para agregar el logo de un cliente, ponlo en portadas/logos y súmalo en _logo_img() y en logos([...]).
import sys, os, math
OUT = sys.argv[1]
W, H = 1600, 560
FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
INK = '#0b1220'

def svg(bg, body, defs=''):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">
<defs>{defs}</defs>{bg}{body}</svg>'''

def grad(id, a, b, x2='1', y2='1'):
    return f'<linearGradient id="{id}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'

def title(kicker, big, sub, color, kc, x=90):
    return f'''<g>
<text x="{x}" y="200" font-size="26" font-weight="700" fill="{kc}" letter-spacing="4">{kicker}</text>
<text x="{x}" y="285" font-size="84" font-weight="900" fill="{color}">{big}</text>
<text x="{x}" y="340" font-size="30" font-weight="500" fill="{color}" opacity=".8">{sub}</text>
</g>'''

def dots(color, n=40, seed=1, area=(0,0,W,H), r=(2,5), op=.25):
    import random; rnd=random.Random(seed); out=[]
    for _ in range(n):
        x=rnd.uniform(area[0],area[2]); y=rnd.uniform(area[1],area[3]); rr=rnd.uniform(*r)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rr:.1f}" fill="{color}" opacity="{op}"/>')
    return ''.join(out)

OUTLINE = 'stroke="#13202f" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"'

def face(cx, cy, s=1, mood='happy'):
    ex=26*s; ey=-6*s
    eyes = ''.join(f'<ellipse cx="{cx+dx}" cy="{cy+ey}" rx="{15*s}" ry="{19*s}" fill="#fff" {OUTLINE}/><circle cx="{cx+dx+3*s}" cy="{cy+ey+3*s}" r="{7*s}" fill="#13202f"/><circle cx="{cx+dx+5*s}" cy="{cy+ey-1*s}" r="{2.5*s}" fill="#fff"/>' for dx in (-ex, ex))
    cheeks = f'<ellipse cx="{cx-46*s}" cy="{cy+22*s}" rx="{10*s}" ry="{6*s}" fill="#ff9aa8" opacity=".85"/><ellipse cx="{cx+46*s}" cy="{cy+22*s}" rx="{10*s}" ry="{6*s}" fill="#ff9aa8" opacity=".85"/>'
    if mood=='happy': m=f'<path d="M{cx-16*s} {cy+22*s} Q{cx} {cy+42*s} {cx+16*s} {cy+22*s}" fill="#7a1f2b" {OUTLINE}/>'
    elif mood=='wow': m=f'<ellipse cx="{cx}" cy="{cy+30*s}" rx="{9*s}" ry="{12*s}" fill="#7a1f2b" {OUTLINE}/>'
    else: m=f'<path d="M{cx-14*s} {cy+28*s} Q{cx} {cy+36*s} {cx+14*s} {cy+28*s}" fill="none" {OUTLINE}/>'
    return eyes+cheeks+m

def cap(cx, top, w, color='#1e3a5f'):
    return f'''<path d="M{cx-w/2} {top} Q{cx} {top-w*0.55} {cx+w/2} {top} Z" fill="{color}" {OUTLINE}/>
<path d="M{cx+w*0.15} {top} L{cx+w*0.72} {top+6} L{cx+w*0.5} {top-4} Z" fill="{color}" {OUTLINE}/>
<rect x="{cx-12}" y="{top-w*0.32}" width="24" height="24" rx="4" fill="#fff"/><rect x="{cx-8}" y="{top-w*0.32+4}" width="7" height="7" fill="#2a9d8f"/><rect x="{cx+1}" y="{top-w*0.32+4}" width="7" height="7" fill="#2a9d8f"/><rect x="{cx-8}" y="{top-w*0.32+13}" width="7" height="7" fill="#2a9d8f"/>'''

def limb(x1,y1,x2,y2,hand='#fff',col='#2f7d4f'):
    return f'<path d="M{x1} {y1} Q{(x1+x2)/2} {min(y1,y2)-10} {x2} {y2}" fill="none" stroke="#13202f" stroke-width="16" stroke-linecap="round"/><path d="M{x1} {y1} Q{(x1+x2)/2} {min(y1,y2)-10} {x2} {y2}" fill="none" stroke="{col}" stroke-width="8" stroke-linecap="round"/><circle cx="{x2}" cy="{y2}" r="15" fill="{hand}" {OUTLINE}/>'

def leg(x,y,len_,foot='#b0243a',col='#2f7d4f',dx=0):
    return f'<path d="M{x} {y} L{x+dx} {y+len_}" stroke="#13202f" stroke-width="16" stroke-linecap="round"/><path d="M{x} {y} L{x+dx} {y+len_}" stroke="{col}" stroke-width="8" stroke-linecap="round"/><ellipse cx="{x+dx+8}" cy="{y+len_+6}" rx="24" ry="12" fill="{foot}" {OUTLINE}/>'

def card(cx, cy, mood='happy', rot=0):
    # Tarjeta verde con gorra (TikTok / Total Play)
    w,h=190,140
    return f'''<g transform="rotate({rot} {cx} {cy})">
<rect x="{cx-w/2}" y="{cy-h/2}" width="{w}" height="{h}" rx="18" fill="#3f9a5f" {OUTLINE}/>
<rect x="{cx-w/2+12}" y="{cy-h/2+12}" width="{w-24}" height="{h-24}" rx="12" fill="none" stroke="#7cc79a" stroke-width="3"/>
<circle cx="{cx-w/2+8}" cy="{cy}" r="10" fill="#e0475f" {OUTLINE}/><circle cx="{cx+w/2-8}" cy="{cy}" r="10" fill="#e0475f" {OUTLINE}/>
{face(cx, cy-4, 1, mood)}
<path d="M{cx-26} {cy+16} q13 -10 26 0 q13 -10 26 0" fill="#13202f"/>
{cap(cx, cy-h/2+6, 150)}
</g>'''

def bill(cx, cy, mood='happy'):
    w,h=230,140
    return f'''<g>
<rect x="{cx-w/2}" y="{cy-h/2}" width="{w}" height="{h}" rx="10" fill="#3d9b5c" {OUTLINE}/>
<rect x="{cx-w/2+10}" y="{cy-h/2+10}" width="{w-20}" height="{h-20}" rx="6" fill="none" stroke="#b9e3c6" stroke-width="3" stroke-dasharray="6 6"/>
<circle cx="{cx}" cy="{cy}" r="56" fill="#f3e6c4" {OUTLINE}/>
{''.join(f'<text x="{cx+dx}" y="{cy+dy}" font-size="34" font-weight="900" fill="#e9f7ee" text-anchor="middle">$</text>' for dx,dy in ((-88,-30),(88,-30),(-88,52),(88,52)))}
{face(cx, cy-6, .78, mood)}
{cap(cx, cy-h/2+4, 120, '#ffffff').replace('fill="#ffffff" stroke','fill="#f4f6f8" stroke')}
</g>'''

def lina(cx, cy, mood='happy', headset=True):
    w,h=150,250
    hs = f'<path d="M{cx-w/2-8} {cy-40} Q{cx} {cy-170} {cx+w/2+8} {cy-40}" fill="none" stroke="#13202f" stroke-width="12"/><rect x="{cx+w/2-6}" y="{cy-60}" width="22" height="44" rx="8" fill="#1e3a5f" {OUTLINE}/><rect x="{cx-w/2-16}" y="{cy-60}" width="22" height="44" rx="8" fill="#1e3a5f" {OUTLINE}/><path d="M{cx-w/2-6} {cy-20} Q{cx-w/2-10} {cy+40} {cx-20} {cy+44}" fill="none" stroke="#13202f" stroke-width="6"/><circle cx="{cx-18}" cy="{cy+44}" r="8" fill="#13202f"/>' if headset else ''
    return f'''<g>
<rect x="{cx-w/2}" y="{cy-h/2}" width="{w}" height="{h}" rx="30" fill="#54c6b1" {OUTLINE}/>
<rect x="{cx-w/2+14}" y="{cy-h/2+30}" width="{w-28}" height="{h-70}" rx="14" fill="#e8fbf6" {OUTLINE}/>
<rect x="{cx-16}" y="{cy-h/2+12}" width="32" height="7" rx="3" fill="#13202f"/>
<circle cx="{cx}" cy="{cy+h/2-20}" r="8" fill="#e8fbf6" {OUTLINE}/>
{face(cx, cy-10, .9, mood)}
{cap(cx, cy-h/2+8, 140)}
{hs}
</g>'''

def bot(cx, cy):
    return f'''<g>
<line x1="{cx}" y1="{cy-95}" x2="{cx}" y2="{cy-140}" stroke="#13202f" stroke-width="6"/><circle cx="{cx}" cy="{cy-146}" r="12" fill="#ffd166" {OUTLINE}/>
<rect x="{cx-95}" y="{cy-100}" width="190" height="150" rx="34" fill="#2bb3a3" {OUTLINE}/>
<rect x="{cx-70}" y="{cy-72}" width="140" height="86" rx="22" fill="#0e2f3a" {OUTLINE}/>
<ellipse cx="{cx-30}" cy="{cy-30}" rx="14" ry="18" fill="#7ff9e7"/><ellipse cx="{cx+30}" cy="{cy-30}" rx="14" ry="18" fill="#7ff9e7"/>
<path d="M{cx-20} {cy-4} Q{cx} {cy+10} {cx+20} {cy-4}" fill="none" stroke="#7ff9e7" stroke-width="5" stroke-linecap="round"/>
<rect x="{cx-70}" y="{cy+50}" width="140" height="70" rx="20" fill="#239a8c" {OUTLINE}/>
<circle cx="{cx}" cy="{cy+84}" r="14" fill="#ffd166" {OUTLINE}/>
</g>'''

def gauge_char(cx, cy):
    r=120
    segs=[('#3b82c4',180,228),('#f0a43a',228,276),('#e2505c',276,360)]
    def arc(a1,a2,rr):
        x1=cx+rr*math.cos(math.radians(a1)); y1=cy+rr*math.sin(math.radians(a1)); x2=cx+rr*math.cos(math.radians(a2)); y2=cy+rr*math.sin(math.radians(a2))
        return f'M{x1:.1f} {y1:.1f} A{rr} {rr} 0 0 1 {x2:.1f} {y2:.1f}'
    a=''.join(f'<path d="{arc(s,e,r)}" fill="none" stroke="{c}" stroke-width="34"/>' for c,s,e in segs)
    return f'''<g>
<circle cx="{cx}" cy="{cy}" r="{r+34}" fill="#eaf1f8" {OUTLINE}/>
{a}
<line x1="{cx}" y1="{cy}" x2="{cx+92*math.cos(math.radians(330)):.1f}" y2="{cy+92*math.sin(math.radians(330)):.1f}" stroke="#13202f" stroke-width="10" stroke-linecap="round"/>
<circle cx="{cx}" cy="{cy}" r="16" fill="#13202f"/>
{face(cx, cy+58, .7, 'happy')}
</g>'''

def screen(x,y,w,h,inner,fill='#ffffff'):
    return f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{fill}" {OUTLINE}/>{inner}</g>'

def bars(x,y,vals,colors,bw=34,gap=14,scale=1.6):
    out=[]
    for i,v in enumerate(vals):
        out.append(f'<rect x="{x+i*(bw+gap)}" y="{y-v*scale}" width="{bw}" height="{v*scale}" rx="6" fill="{colors[i%len(colors)]}"/>')
    return ''.join(out)

def bubble(x,y,text,w=None,fs=30,fill='#fff',col='#13202f'):
    w=w or len(text)*fs*0.56+40
    return f'<g><rect x="{x}" y="{y}" width="{w}" height="{fs+30}" rx="{(fs+30)/2}" fill="{fill}" {OUTLINE}/><path d="M{x+40} {y+fs+28} l-12 26 l34 -24" fill="{fill}" {OUTLINE}/><text x="{x+w/2}" y="{y+fs+5}" font-size="{fs}" font-weight="800" fill="{col}" text-anchor="middle">{text}</text></g>'

def note(x,y,s=1,c='#fff'):
    return f'<g transform="translate({x} {y}) scale({s})"><path d="M0 0 L0 -50 L34 -60 L34 -10" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="-8" cy="2" rx="12" ry="9" fill="{c}"/><ellipse cx="26" cy="-8" rx="12" ry="9" fill="{c}"/></g>'


import base64
LOGOS_DIR = sys.argv[2]
def _b64(p): return base64.b64encode(open(os.path.join(LOGOS_DIR,p),'rb').read()).decode()
BINATSA_SVG = open(os.path.join(LOGOS_DIR,'binatsa.svg')).read()
def _logo_img(name, h):
    if name=='binatsa':
        w=h*1220/230
        return w, f'<image width="{w:.0f}" height="{h}" href="data:image/svg+xml;base64,{base64.b64encode(BINATSA_SVG.encode()).decode()}"/>'
    if name=='inter':
        w=h*1182/440
        return w, f'<image width="{w:.0f}" height="{h}" href="data:image/png;base64,{_b64("logo_inter.png")}"/>'
    if name=='gmf':
        w=h*665/147
        return w, f'<image width="{w:.0f}" height="{h}" href="data:image/png;base64,{_b64("gmf_logo.png")}"/>'
def logos(names, x=90, y=392, h=44):
    pad=22; gap=26; parts=[]; cx=x+pad
    for i,n in enumerate(names):
        hh=h if n=='binatsa' else h*1.45
        w,img=_logo_img(n,hh)
        if i: parts.append(f'<line x1="{cx-gap/2:.0f}" y1="{y+14}" x2="{cx-gap/2:.0f}" y2="{y+h+18}" stroke="#cbd5e1" stroke-width="2"/>')
        parts.append(f'<g transform="translate({cx:.0f} {y+16-(hh-h)/2:.0f})">{img}</g>'); cx+=w+gap
    total=cx-gap+pad-x
    return f'<rect x="{x}" y="{y}" width="{total:.0f}" height="{h+32}" rx="{(h+32)/2}" fill="#ffffff" opacity=".96"/>'+''.join(parts)

covers={}

# 1) TikTok: la tarjeta baila con el celular mientras suben las barras
d=grad('bg','#0f0c1d','#2a1035')
body=dots('#ff2d6f',30,3,(780,0,W,H),(2,6),.35)+dots('#25f4ee',30,4,(780,0,W,H),(2,6),.35)
body+=f'<circle cx="1210" cy="290" r="230" fill="#ff2d6f" opacity=".12"/><circle cx="1250" cy="270" r="200" fill="#25f4ee" opacity=".1"/>'
body+=screen(1300,120,190,330,f'<rect x="1316" y="150" width="158" height="270" rx="10" fill="#141026"/>'+bars(1330,400,[40,70,55,100,130],['#25f4ee','#ff2d6f'],22,8,1.9)+'<circle cx="1395" cy="435" r="7" fill="#fff"/>',fill='#2b2440')
body+=note(860,190,1.1,'#25f4ee')+note(1500,90,.8,'#ff2d6f')+note(910,430,.7,'#fff')
body+=leg(1090,370,70,dx=-30)+leg(1150,370,70,dx=36)
body+=limb(1030,300,960,220)+limb(1210,300,1300,250)
body+=card(1120,300,'happy',-8)
body+=logos(['binatsa'])
body+=title('MANUAL DE USO','TikTok','Cobranza: monto recuperado, promesas y contacto','#ffffff','#25f4ee')
covers['TikTok_cobranza']=svg(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',body,d)

# 2) GMF: el velocímetro lleva la aguja del atraso al pago, con auto
d=grad('bg','#0c1f3a','#123d6b')
road=f'<rect x="760" y="440" width="840" height="120" fill="#0a1628"/>'+''.join(f'<rect x="{x}" y="495" width="60" height="10" rx="5" fill="#f0a43a"/>' for x in range(780,1600,110))
car=f'''<g transform="translate(830 360)"><path d="M0 70 Q10 20 70 18 L160 14 Q200 14 230 50 L290 60 Q310 64 310 90 L310 100 L0 100 Z" fill="#3b82c4" {OUTLINE}/><path d="M80 26 L150 22 Q180 24 200 50 L80 52 Z" fill="#cfe6fb" {OUTLINE}/><circle cx="70" cy="100" r="28" fill="#13202f"/><circle cx="70" cy="100" r="11" fill="#9aa9b8"/><circle cx="240" cy="100" r="28" fill="#13202f"/><circle cx="240" cy="100" r="11" fill="#9aa9b8"/></g>'''
body=dots('#7fb3e6',40,5,(760,0,W,430),(1.5,3.5),.4)+road+car
body+=gauge_char(1340,230)+limb(1220,250,1150,170,col='#9fb4c9')+limb(1460,250,1530,160,col='#9fb4c9')
body+=f'<g transform="translate(1515 60)"><line x1="15" y1="100" x2="15" y2="0" stroke="#13202f" stroke-width="6"/><path d="M15 0 L80 18 L15 40 Z" fill="#2fbf71" {OUTLINE}/></g>'
body+=bubble(1120,400,'¡Del atraso al pago!',360,26,'#fff3dc')
body+=logos(['binatsa','gmf'])
body+=title('MANUAL DE USO','GMF','Cobranza de autos: del atraso al pago','#ffffff','#f0a43a')
covers['GMF_cobranza']=svg(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',body,d)

# 3) Inter ATC: Lina contesta la llamada a tiempo
d=grad('bg','#0b2a45','#0f4c6e')
body=dots('#54c6b1',35,7,(760,0,W,H),(2,5),.35)
body+=f'<circle cx="1230" cy="290" r="220" fill="#54c6b1" opacity=".1"/>'
body+=lina(1180,300,'happy')+limb(1105,330,1040,250,col='#54c6b1')+limb(1255,330,1330,380,col='#54c6b1')
body+=f'<g transform="translate(1340 330)"><rect x="0" y="0" width="70" height="110" rx="14" fill="#13202f" {OUTLINE}/><rect x="8" y="12" width="54" height="72" rx="6" fill="#2fbf71"/><path d="M22 58 q13 -24 26 0" fill="none" stroke="#fff" stroke-width="5"/></g>'
body+=f'<g transform="translate(940 90)"><circle cx="60" cy="60" r="56" fill="#fff" {OUTLINE}/><line x1="60" y1="60" x2="60" y2="22" stroke="#13202f" stroke-width="6" stroke-linecap="round"/><line x1="60" y1="60" x2="88" y2="70" stroke="#e2505c" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="60" r="6" fill="#13202f"/></g>'
body+=bubble(1300,110,'¡92,9% a tiempo!',290,28,'#e8fbf6')
body+=logos(['binatsa','inter'])
body+=title('MANUAL DE USO','Inter · ATC','Entra, espera y se atiende','#ffffff','#54c6b1')
covers['Inter_ATC']=svg(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',body,d)

# 4) Presentación Inter: Lina presenta el ranking en una pantalla
d=grad('bg','#101828','#1d2b4a')
rows=''.join(f'<rect x="910" y="{150+i*42}" width="{300-i*30}" height="22" rx="11" fill="{c}"/><text x="890" y="{167+i*42}" font-size="20" font-weight="800" fill="#cfe0f5" text-anchor="end">{i+1}</text>' for i,c in enumerate(['#2fbf71','#2fbf71','#f0a43a','#3b82c4','#3b82c4']))
body=dots('#9ab8e6',30,9,(760,0,W,H),(1.5,3.5),.35)
body+=screen(860,110,400,280,f'<text x="1060" y="140" font-size="22" font-weight="800" fill="#cfe0f5" text-anchor="middle">RANKING NPS</text>'+rows,fill='#0f1a2e')
body+=f'<line x1="1060" y1="390" x2="1060" y2="470" stroke="#13202f" stroke-width="10"/><rect x="990" y="465" width="140" height="14" rx="7" fill="#13202f"/>'
body+=lina(1420,300,'happy',headset=False)+limb(1345,300,1240,220,col='#54c6b1')+limb(1495,330,1545,390,col='#54c6b1')
body+=f'<line x1="1240" y1="220" x2="1180" y2="190" stroke="#c8a165" stroke-width="7" stroke-linecap="round"/>'
body+=f'<g transform="translate(1460 70) rotate(12)"><rect x="0" y="0" width="110" height="74" rx="10" fill="#fff" {OUTLINE}/><text x="55" y="30" font-size="16" font-weight="900" fill="#3b82c4" text-anchor="middle">PÓLIZA</text><circle cx="85" cy="54" r="10" fill="#e2505c"/></g>'
body+=logos(['binatsa','inter'])
body+=title('PRESENTACIÓN','Inter','Una campaña a la vez, un indicador a la vez','#ffffff','#9ab8e6')
covers['Inter_presentacion']=svg(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',body,d)

# 5) Cobranza: el billete hace malabares con las tres campañas
d=grad('bg','#0d2018','#123528')
def sheet(x,y,name,c,rot):
    return f'<g transform="rotate({rot} {x+90} {y+60})"><rect x="{x}" y="{y}" width="180" height="120" rx="10" fill="#fff" {OUTLINE}/><rect x="{x}" y="{y}" width="180" height="32" rx="10" fill="{c}"/><rect x="{x}" y="{y+20}" width="180" height="12" fill="{c}"/><text x="{x+90}" y="{y+24}" font-size="20" font-weight="900" fill="#fff" text-anchor="middle">{name}</text>'+''.join(f'<rect x="{x+16}" y="{y+46+i*22}" width="{148-i*24}" height="12" rx="6" fill="#d9e3ea"/>' for i in range(3))+'</g>'
body=dots('#7fd8a0',35,11,(760,0,W,H),(2,5),.3)
body+=f'<path d="M950 300 Q1010 60 1200 70 Q1390 60 1450 300" fill="none" stroke="#7fd8a0" stroke-width="4" stroke-dasharray="10 14" opacity=".6"/>'
body+=sheet(860,190,'GMF','#3b82c4',-12)+sheet(1110,40,'TikTok','#e0336b',4)+sheet(1360,200,'Total Play','#2a9d8f',12)
body+=limb(1110,360,1010,300,col='#3d9b5c')+limb(1290,360,1390,300,col='#3d9b5c')
body+=leg(1160,410,60,col='#3d9b5c')+leg(1240,410,60,col='#3d9b5c')
body+=bill(1200,350,'happy')
body+=logos(['binatsa','gmf'])
body+=title('MANUAL DE USO','Cobranza','Tres campañas en un solo tablero','#ffffff','#7fd8a0')
covers['Cobranza_union']=svg(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',body,d)

# 6) Total Play: la tarjeta revisa la dona con lupa
d=grad('bg','#0b1b33','#1a2f55')
def donut(cx,cy,r):
    parts=[('#1e3a8a',.55),('#3b82c4',.25),('#93c5fd',.2)]; out=[]; a=-90
    for c,f in parts:
        a2=a+360*f; x1=cx+r*math.cos(math.radians(a)); y1=cy+r*math.sin(math.radians(a)); x2=cx+r*math.cos(math.radians(a2)); y2=cy+r*math.sin(math.radians(a2))
        out.append(f'<path d="M{x1:.1f} {y1:.1f} A{r} {r} 0 {1 if f>.5 else 0} 1 {x2:.1f} {y2:.1f}" fill="none" stroke="{c}" stroke-width="48"/>'); a=a2
    return ''.join(out)+f'<text x="{cx}" y="{cy+12}" font-size="36" font-weight="900" fill="#fff" text-anchor="middle">50,442</text>'
body=dots('#8fb6ff',35,13,(760,0,W,H),(1.5,4),.35)
body+=donut(1000,270,130)
body+=leg(1300,370,70,dx=-10)+leg(1360,370,70,dx=14)
body+=limb(1245,300,1150,250)+limb(1415,300,1480,200)
body+=card(1330,300,'wow',6)
body+=f'<g transform="translate(1110 210)"><circle cx="0" cy="0" r="48" fill="#cfe6fb" fill-opacity=".35" stroke="#13202f" stroke-width="10"/><line x1="34" y1="34" x2="70" y2="70" stroke="#13202f" stroke-width="16" stroke-linecap="round"/></g>'
body+=f'<g transform="translate(1470 120)"><path d="M0 0 L0 60 L16 46 L28 72 L38 66 L26 42 L46 42 Z" fill="#fff" {OUTLINE}/></g>'
body+=logos(['binatsa'])
body+=title('MANUAL DE USO','Total Play','Cuentas, llamadas y adherencia del agente','#ffffff','#8fb6ff')
covers['TotalPlay_cobranza']=svg(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',body,d)

# 7) Binatsa: el robot convierte llamadas en hallazgos
d=grad('bg','#05070d','#0d1b2a')
body=dots('#7ff9e7',45,17,(0,0,W,H),(1,2.5),.4)
body+=f'<path d="M780 420 C900 380 1000 460 1120 420 S1380 380 1560 420" fill="none" stroke="#cfe0f5" stroke-width="5" opacity=".8"/>'
body+=f'<g transform="translate(820 360) rotate(-20)"><rect x="0" y="0" width="34" height="86" rx="12" fill="#4f6fd8" {OUTLINE}/></g>'
body+=''.join(f'<rect x="{930+i*16}" y="{400-h}" width="9" height="{h*2}" rx="4" fill="#f08a3a"/>' for i,h in enumerate([14,28,40,22,34,18]))
body+=bot(1230,300)+limb(1135,320,1060,250,col='#2bb3a3')+limb(1325,320,1400,250,col='#2bb3a3')
body+=f'<g transform="translate(1480 380)"><polygon points="0,-46 40,-23 40,23 0,46 -40,23 -40,-23" fill="#8b6cf0" {OUTLINE}/><text x="0" y="12" font-size="34" font-weight="900" fill="#fff" text-anchor="middle">!</text></g>'
body+=''.join(f'<rect x="{1380+dx}" y="{120+dy}" width="44" height="44" rx="8" fill="#7ff9e7" opacity=".85" {OUTLINE}/>' for dx,dy in ((0,0),(56,30),(20,74)))
body+=logos(['binatsa'])
body+=title('PRESENTACIÓN','Binatsa','Datos que mueven decisiones','#ffffff','#7ff9e7')
covers['Binatsa_tableau']=svg(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',body,d)

os.makedirs(OUT,exist_ok=True)
for k,v in covers.items(): open(os.path.join(OUT,k+'.svg'),'w').write(v)
print(len(covers))

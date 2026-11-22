import sys; sys.path.insert(0,'build'); import tab, requests
from PIL import Image
wb,out=sys.argv[1:3]
t,s=tab.signin(); h={"X-Tableau-Auth":t,"Accept":"application/json"}
v=requests.get(f"{tab.S}/sites/{s}/workbooks/{wb}/views",headers=h).json()['views']['view']
ims=[]
for x in sorted([x for x in v if x['name'].startswith('X Debug')],key=lambda x:int(x['name'].split()[-1])):
    r=requests.get(f"{tab.S}/sites/{s}/views/{x['id']}/image?maxAge=1&vizWidth=1400&vizHeight=230",headers={"X-Tableau-Auth":t})
    open('shots/t.png','wb').write(r.content); im=Image.open('shots/t.png').convert('RGB'); ims.append(im.crop((0,0,im.width,min(im.height,230))))
out_im=Image.new('RGB',(max(i.width for i in ims),sum(i.height for i in ims)),'white'); y=0
for i in ims: out_im.paste(i,(0,y)); y+=i.height
out_im.save(out)

import sys,time; sys.path.insert(0,sys.path[0]); import tab, requests
wbid=sys.argv[1]; names=sys.argv[2:]
t,s=tab.signin(); h={"X-Tableau-Auth":t,"Accept":"application/json"}
v=requests.get(f"{tab.S}/sites/{s}/workbooks/{wbid}/views",headers=h).json()['views']['view']
print([x["name"] for x in v])
for x in v:
  if not names or x['name'] in names:
    r=requests.get(f"{tab.S}/sites/{s}/views/{x['id']}/image?resolution=high&maxAge=1",headers={"X-Tableau-Auth":t})
    fn=(__import__('os').environ.get('OUT','shots'))+'/'+x['name'].replace(' ','_').replace('/','_')+'.png'; open(fn,'wb').write(r.content); print(r.status_code,fn)

import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import tab, requests
wbid=sys.argv[1]; names=sys.argv[2:]
t,s=tab.signin(); h={"X-Tableau-Auth":t,"Accept":"application/json"}
v=requests.get(f"{tab.S}/sites/{s}/workbooks/{wbid}/views",headers=h).json()['views']['view']
print([x["name"] for x in v])
for x in v:
  if not names or x['name'] in names:
    r=requests.get(f"{tab.S}/sites/{s}/views/{x['id']}/image?resolution=high&maxAge=1",headers={"X-Tableau-Auth":t})
    d=os.environ.get('OUT','shots'); os.makedirs(d, exist_ok=True)
    fn=d+'/'+x['name'].replace(' ','_').replace('/','_')+'.png'; open(fn,'wb').write(r.content); print(r.status_code,fn)

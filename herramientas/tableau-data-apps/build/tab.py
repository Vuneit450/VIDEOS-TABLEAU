import os, sys, json, requests
S = "https://us-east-1.online.tableau.com/api/3.22"
def signin():
    r = requests.post(f"{S}/auth/signin", json={"credentials": {"personalAccessTokenName": os.environ['TABLEAU_PAT_NAME'], "personalAccessTokenSecret": os.environ['TABLEAU_PAT_SECRET'], "site": {"contentUrl": os.environ['TABLEAU_SITE']}}}, headers={"Accept": "application/json"})
    r.raise_for_status(); c = r.json()['credentials']; return c['token'], c['site']['id']
def publish(path, name, project="f9ab466f-c8f4-4940-943c-38736c657c1b", overwrite=False):
    tok, sid = signin()
    req = f"<tsRequest><workbook name='{name}' showTabs='true'><project id='{project}'/></workbook></tsRequest>"
    b = 'binatsaBoundary7MA4YWxk'
    body = (f'--{b}\r\nContent-Disposition: name="request_payload"\r\nContent-Type: text/xml\r\n\r\n{req}\r\n'
            f'--{b}\r\nContent-Disposition: name="tableau_workbook"; filename="wb.twbx"\r\nContent-Type: application/octet-stream\r\n\r\n').encode() + open(path,'rb').read() + f'\r\n--{b}--\r\n'.encode()
    r = requests.post(f"{S}/sites/{sid}/workbooks?workbookType=twbx&overwrite={'true' if overwrite else 'false'}", data=body, headers={"X-Tableau-Auth": tok, "Accept": "application/json", "Content-Type": f"multipart/mixed; boundary={b}"})
    print(r.status_code, r.text[:800]); r.raise_for_status()
    wb = r.json()['workbook']; return wb
if __name__ == '__main__':
    wb = publish(sys.argv[1], sys.argv[2], overwrite=len(sys.argv) > 3)
    print(wb['id'], wb.get('webpageUrl'))

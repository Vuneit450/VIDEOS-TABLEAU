import {createRequire} from 'module';const {chromium}=createRequire(import.meta.url)('playwright');import fs from 'fs';
const [dir,out]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:560}});
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.svg'))){await p.goto('file://'+dir+'/'+f);await p.screenshot({path:out+'/'+f.replace('.svg','.png')});}
await b.close();

import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const parts=['source-part-01.txt','source-part-02.txt','source-part-03.txt'];
writeFileSync('nagartrace-source.zip',Buffer.from(parts.map(p=>readFileSync(new URL(p,import.meta.url),'utf8')).join(''),'base64'));
execFileSync('unzip',['-o','nagartrace-source.zip','-d','app'],{stdio:'inherit'});
console.log('Source restored to app/. Run: cd app && npm ci && npm run dev');

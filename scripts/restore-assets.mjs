import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory='assets/social-preview';
const parts=readdirSync(directory).filter(p=>p.endsWith('.b64')).sort();
if(!parts.length)throw new Error('Missing social preview source parts');
const bytes=Buffer.from(parts.map(p=>readFileSync(`${directory}/${p}`,'utf8')).join(''),'base64');
const expected=JSON.parse(readFileSync(`${directory}/manifest.json`,'utf8')).sha256;
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('Social preview checksum mismatch');
for(const path of ['docs/social-preview.png','public/og.png']){mkdirSync(path.split('/')[0],{recursive:true});writeFileSync(path,bytes);}
console.log('Verified and restored social preview assets.');

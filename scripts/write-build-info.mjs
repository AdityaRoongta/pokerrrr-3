import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const git=(args,fallback)=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()||fallback}catch{return fallback}};
const info={schemaVersion:1,builtAt:new Date().toISOString(),revision:git(['rev-parse','--short','HEAD'],'unknown'),dirty:git(['status','--porcelain'],'')!==''};
writeFileSync(new URL('../public/build-info.json',import.meta.url),`${JSON.stringify(info,null,2)}\n`);

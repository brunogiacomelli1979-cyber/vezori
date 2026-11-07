import {readFileSync,writeFileSync} from 'node:fs';
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
const packages=Object.entries(lock.packages).filter(([path])=>path).map(([path,p])=>({name:path.split('node_modules/').at(-1),version:p.version,license:p.license||'UNDECLARED',development:p.dev===true}));
writeFileSync('docs/DEPENDENCY_LICENSES.json',JSON.stringify({generatedAt:new Date().toISOString(),scope:'npm lockfile metadata; library licence does not grant rights to market data',packages},null,2)+'\n');
const counts={};for(const p of packages)counts[p.license]=(counts[p.license]||0)+1;
console.log(JSON.stringify({packages:packages.length,licenses:counts}));

import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
for(const dir of ['src','public','scripts']){
 for(const name of readdirSync(dir)){
  if(/\.(?:m?js)$/.test(name))execFileSync(process.execPath,['--check',dir+'/'+name],{stdio:'inherit'});
 }
}

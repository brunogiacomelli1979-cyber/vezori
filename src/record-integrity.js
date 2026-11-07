/** Integrity detects accidental corruption; it is not an authenticity signature. */
async function digest(record){
 const {integrity,...payload}=record;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function sealRecord(record){
 return {...record,integrity:{algorithm:'SHA-256',sha256:await digest(record)}};
}
export async function verifyRecord(record){
 if(!record?.integrity)return 'legacy_unsigned';
 if(record.integrity.algorithm!=='SHA-256'||record.integrity.sha256!==await digest(record))throw Error('Integridade SHA-256 do registro inválida; não sobrescrever');
 return 'verified';
}

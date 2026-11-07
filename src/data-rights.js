/** These flags record an owner's verified provider agreement; an API key is not a licence. */
export function publicDashboard(data,env={}){
 const quotes=data.quotes.filter(q=>q.market!=='BR'||env.BR_PUBLIC_DISPLAY_AUTHORIZED==='true');
 return {...data,quotes,availability:{...data.availability,...(env.BR_PUBLIC_DISPLAY_AUTHORIZED==='true'?{}:{brapi:'display_rights_required'})},
  meta:{...data.meta,brPublicDisplayAuthorized:env.BR_PUBLIC_DISPLAY_AUTHORIZED==='true',licensingNote:'Exibição B3 exige autorização documentada do fornecedor; acesso sandbox não concede redistribuição.'}};
}
export function archiveDashboard(data,env={}){
 const flags={BR:'BR_ARCHIVE_AUTHORIZED',US:'US_ARCHIVE_AUTHORIZED',CRYPTO:'CRYPTO_ARCHIVE_AUTHORIZED'};
 const quotes=data.quotes.filter(q=>env[flags[q.market]]==='true');
 return {...data,quotes,fx:env.FX_ARCHIVE_AUTHORIZED==='true'?data.fx:[],
  // BCB explicitly permits reproduction with source and integrity preserved.
  macro:data.macro.filter(m=>m.provider==='BCB / SGS 432'),
  meta:{...data.meta,archivePolicy:{blockedQuotes:data.quotes.length-quotes.length,
   policy:'Cotações/FX só são arquivados após autorização de retenção específica. Dados BCB mantêm fonte e unidade.',
   bcbTerms:'https://www.bcb.gov.br/acessoinformacao/politicaprivacidade'}}};
}

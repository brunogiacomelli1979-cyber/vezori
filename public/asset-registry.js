/** Known asset identities; null means not verified. No listing date or ISIN is guessed. */
const core=Object.freeze({
  PETR4:{currency:'BRL',market:'BR',name:'Petrobras PN'},VALE3:{currency:'BRL',market:'BR',name:'Vale ON'},ITUB4:{currency:'BRL',market:'BR',name:'Itaú PN'},MGLU3:{currency:'BRL',market:'BR',name:'Magazine Luiza'},
  VOO:{currency:'USD',market:'US',name:'Vanguard S&P 500'},QQQ:{currency:'USD',market:'US',name:'Invesco Nasdaq 100'},AAPL:{currency:'USD',market:'US',name:'Apple'},
  MSFT:{currency:'USD',market:'US',name:'Microsoft'},O:{currency:'USD',market:'US',name:'Realty Income (REIT)'},PLD:{currency:'USD',market:'US',name:'Prologis (REIT)'},
  BTC:{currency:'BRL',market:'CRYPTO',name:'Bitcoin'},ETH:{currency:'BRL',market:'CRYPTO',name:'Ethereum'},SOL:{currency:'BRL',market:'CRYPTO',name:'Solana'}
});
const ciks={AAPL:'0000320193',MSFT:'0000789019',O:'0000726728',PLD:'0001045609'};
const coins={BTC:'bitcoin',ETH:'ethereum',SOL:'solana'};
export const ASSETS=Object.freeze(Object.fromEntries(Object.entries(core).map(([symbol,meta])=>[symbol,Object.freeze({
 ...meta,symbol,id:meta.market+':'+symbol,exchange:meta.market==='BR'?'B3':null,
 assetClass:meta.market==='CRYPTO'?'crypto':['VOO','QQQ'].includes(symbol)?'etf':['O','PLD'].includes(symbol)?'reit':'stock',
 isin:null,cik:ciks[symbol]||null,providerId:coins[symbol]||symbol,
 listingDate:null,delistingDate:null,status:'catalogued',
 primaryProvider:meta.market==='BR'?'brapi':meta.market==='US'?'Twelve Data':'CoinGecko',alternativeProvider:null
})])));

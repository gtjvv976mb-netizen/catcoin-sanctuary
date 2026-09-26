import fs from "node:fs";
const USDT="Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", WSOL="So11111111111111111111111111111111111111112";
const CATS=[["MEW","MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5"],["POPCAT","7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"],["KITTY","4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk"],["GRUMPY","GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR"],["KWIF","6Rwcmkz9yiYVM5EzyMcr4JsQPGEAWhcUvLvfBperYnUt"],["KHAI","3TWgDvYBL2YPET2LxnWAwsMeoA8aL4DutNuwat2pKCjC"]];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const BASE="https://lite-api.jup.ag/swap/v1/quote";
const rows=[];
for (const [sym,mint] of CATS) for (const [ask,extra] of [["direct",{onlyDirectRoutes:"true",restrictIntermediateTokens:"true"}],["maxAccounts24",{onlyDirectRoutes:"false",restrictIntermediateTokens:"true",maxAccounts:"24"}]]) {
  await sleep(1150);
  const params={inputMint:USDT,outputMint:mint,amount:"25000000",slippageBps:"100",swapMode:"ExactIn",...extra,instructionVersion:"V2"};
  const r=await fetch(`${BASE}?${new URLSearchParams(params)}`); const j=await r.json();
  const row={symbol:sym,side:"buy",settlement:"USDT",ask,status:r.status};
  if (j.routePlan) { Object.assign(row,{inAmount:j.inAmount,outAmount:j.outAmount,priceImpactPct:j.priceImpactPct,contextSlot:j.contextSlot,routePlan:j.routePlan.map(h=>({label:h.swapInfo.label,ammKey:h.swapInfo.ammKey,inputMint:h.swapInfo.inputMint,outputMint:h.swapInfo.outputMint,bps:h.bps}))});
    const mids=[...new Set(j.routePlan.flatMap(h=>[h.swapInfo.inputMint,h.swapInfo.outputMint]).filter(m=>m!==USDT&&m!==mint))]; row.intermediates=mids; row.shape=mids.length===0?"direct":mids.length===1&&mids[0]===WSOL?"one hop through SOL":`${mids.length} intermediate(s)${mids.includes(WSOL)?"":" not SOL"}`; }
  else { row.errorCode=j.errorCode??null; row.error=j.error??null; row.shape="no route"; }
  rows.push(row); console.log(sym,ask,row.shape,row.errorCode??row.priceImpactPct);
}
fs.writeFileSync(process.argv[2], JSON.stringify({capturedAt:new Date().toISOString(), rows},null,2));

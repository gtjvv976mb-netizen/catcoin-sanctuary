import fs from "node:fs";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", WSOL="So11111111111111111111111111111111111111112";
const CATS=[["MEW","MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5"],["POPCAT","7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"],["KITTY","4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk"],["GRUMPY","GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR"],["KWIF","6Rwcmkz9yiYVM5EzyMcr4JsQPGEAWhcUvLvfBperYnUt"],["KHAI","3TWgDvYBL2YPET2LxnWAwsMeoA8aL4DutNuwat2pKCjC"]];
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const BASE="https://lite-api.jup.ag/swap/v1/quote";
async function q(params){ await sleep(1150); const r=await fetch(`${BASE}?${new URLSearchParams(params)}`); const t=await r.text(); let j; try{j=JSON.parse(t)}catch{j={raw:t}} return {status:r.status,j}; }
const asks={ direct:{onlyDirectRoutes:"true",restrictIntermediateTokens:"true"} };
for (const n of [20,24,28,32]) asks[`maxAccounts${n}`]={onlyDirectRoutes:"false",restrictIntermediateTokens:"true",maxAccounts:String(n)};
const rows=[];
const sellAmt={};
for (const [sym,mint] of CATS) for (const side of ["buy","sell"]) for (const [ask,extra] of Object.entries(asks)) {
  if (side==="sell" && !sellAmt[sym]) { continue; }
  const params={inputMint:side==="buy"?USDC:mint,outputMint:side==="buy"?mint:USDC,amount:side==="buy"?"25000000":sellAmt[sym],slippageBps:"100",swapMode:"ExactIn",...extra,instructionVersion:"V2"};
  const {status,j}=await q(params);
  const row={symbol:sym,side,ask,status};
  if (j.routePlan) {
    if (side==="buy" && !sellAmt[sym]) sellAmt[sym]=j.outAmount;
    Object.assign(row,{inAmount:j.inAmount,outAmount:j.outAmount,priceImpactPct:j.priceImpactPct,contextSlot:j.contextSlot,
      routePlan:j.routePlan.map(h=>({label:h.swapInfo.label,ammKey:h.swapInfo.ammKey,inputMint:h.swapInfo.inputMint,outputMint:h.swapInfo.outputMint,bps:h.bps}))});
    const mids=[...new Set(j.routePlan.flatMap(h=>[h.swapInfo.inputMint,h.swapInfo.outputMint]).filter(m=>m!==params.inputMint&&m!==params.outputMint))];
    row.intermediates=mids; row.shape=mids.length===0?"direct":mids.length===1&&mids[0]===WSOL?"one hop through SOL":`${mids.length} intermediate(s)${mids.includes(WSOL)?"":" not SOL"}`;
  } else { row.errorCode=j.errorCode??null; row.error=j.error??null; row.shape="no route"; }
  rows.push(row);
  console.log(sym,side,ask,row.shape,row.priceImpactPct??row.errorCode);
}
/* the sell of a coin whose buy found no route was skipped: say so */
fs.writeFileSync(process.argv[2], JSON.stringify({ capturedAt:new Date().toISOString(), source:`GET ${BASE}`,
  note:"", query:{ common:{slippageBps:"100",swapMode:"ExactIn",instructionVersion:"V2"}, buyAmount:"25000000 (25 USDC)", sellAmount:"the first buy answer's outAmount", asks }, rows }, null, 2)+"\n");

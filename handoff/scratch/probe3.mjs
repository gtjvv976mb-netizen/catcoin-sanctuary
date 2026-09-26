const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const T={MEW:["MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",5],POPCAT:["7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",9],KITTY:["4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk",9],GRUMPY:["GRUmPYbiTpq9ZPy5LAqBMMze7kErf5dEX2i9qYfwoSmR",9],KWIF:["6Rwcmkz9yiYVM5EzyMcr4JsQPGEAWhcUvLvfBperYnUt",6],KHAI:["3TWgDvYBL2YPET2LxnWAwsMeoA8aL4DutNuwat2pKCjC",8]};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const names={[USDC]:"USDC","So11111111111111111111111111111111111111112":"SOL",JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN:"JUP","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB":"USDT",...Object.fromEntries(Object.entries(T).map(([k,v])=>[v[0],k]))};
const sym=(m)=>names[m]??m.slice(0,6);
async function q(params){ const u="https://lite-api.jup.ag/swap/v1/quote?"+new URLSearchParams(params); const r=await fetch(u); const t=await r.text(); let j; try{j=JSON.parse(t)}catch{j=t} return {status:r.status,j}; }
const cfgs=[["direct",{onlyDirectRoutes:"true",restrictIntermediateTokens:"true"}],["ma24",{restrictIntermediateTokens:"true",maxAccounts:"24"}],["ma28",{restrictIntermediateTokens:"true",maxAccounts:"28"}],["ma32",{restrictIntermediateTokens:"true",maxAccounts:"32"}]];
const sellAmt={};
for (const [tk,[mint]] of Object.entries(T)) for (const dir of ["buy","sell"]) for (const [cn,c] of cfgs) {
  if (dir==="sell" && !sellAmt[tk]) continue;
  const p={inputMint:dir==="buy"?USDC:mint,outputMint:dir==="buy"?mint:USDC,amount:dir==="buy"?"25000000":sellAmt[tk],slippageBps:"100",swapMode:"ExactIn",instructionVersion:"V2",...c};
  const {status,j}=await q(p);
  if(j.routePlan){ if(dir==="buy"&&!sellAmt[tk]) sellAmt[tk]=j.outAmount; console.log(tk,dir,cn,"out",j.outAmount,"impact",(+j.priceImpactPct*100).toFixed(3)+"%",j.routePlan.map(h=>`${sym(h.swapInfo.inputMint)}>${sym(h.swapInfo.outputMint)}@${h.swapInfo.label}(${h.bps})`).join(" "));}
  else console.log(tk,dir,cn,status,JSON.stringify(j).slice(0,120));
  await sleep(1100);
}

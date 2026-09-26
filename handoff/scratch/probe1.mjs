const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", MEW="MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", KITTY="4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk", POPCAT="7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr";
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function q(params){
  const u="https://lite-api.jup.ag/swap/v1/quote?"+new URLSearchParams(params);
  const r=await fetch(u); const t=await r.text(); let j; try{j=JSON.parse(t)}catch{j=t}
  return {status:r.status, j};
}
const base={amount:"10000000",slippageBps:"100",swapMode:"ExactIn",instructionVersion:"V2"};
const tries=[
  ["MEW any restrict", {inputMint:USDC,outputMint:MEW,...base,restrictIntermediateTokens:"true"}],
  ["MEW maxHops=2 (unknown param?)", {inputMint:USDC,outputMint:MEW,...base,restrictIntermediateTokens:"true",maxHops:"2"}],
  ["MEW bogusParam", {inputMint:USDC,outputMint:MEW,...base,fooBar:"1"}],
  ["KITTY any restrict", {inputMint:USDC,outputMint:KITTY,...base,restrictIntermediateTokens:"true"}],
  ["POPCAT any restrict", {inputMint:USDC,outputMint:POPCAT,...base,restrictIntermediateTokens:"true"}],
];
for(const [name,p] of tries){
  const {status,j}=await q(p);
  console.log("==",name,status);
  if(typeof j==="object"&&j.routePlan){console.log(" out",j.outAmount,"impact",j.priceImpactPct);for(const h of j.routePlan)console.log("  ",h.swapInfo.label,h.swapInfo.ammKey,h.swapInfo.inputMint.slice(0,6),"->",h.swapInfo.outputMint.slice(0,6),"bps",h.bps,"pct",h.percent, h.swapInfo.inAmount, h.swapInfo.outAmount);}
  else console.log(JSON.stringify(j).slice(0,400));
  await sleep(1300);
}

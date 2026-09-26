import fs from "node:fs";
const R="/home/user/Cat-Intelligence-Agency";
const rules = await import(`${R}/bots/lib/content-rules.mjs`);
const { verifiedIndex, tickerFree } = await import(`${R}/bots/cashcat/tickers.mjs`);
const { copycatOf } = await import(`${R}/bots/popcat/established.mjs`);
const DIR=new URL(".",import.meta.url).pathname;
const vlist=JSON.parse(fs.readFileSync(DIR+"../EDITOR/jup-verified-list.json","utf8"));
let vidx=null; try{ vidx=verifiedIndex(vlist);}catch(e){console.error("vidx",e.message)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url){for(let i=0;i<4;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});const t=await r.text();if(r.status===429){await sleep(2500);continue}return{status:r.status,body:JSON.parse(t)}}catch(e){await sleep(1500)}}return{status:0,body:null}}
const up=s=>String(s).toUpperCase();
const cands=JSON.parse(process.argv[2]);
const out=[];
for(const [name,ticker] of cands){
  const j=await get(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(ticker)}`);
  const ja=Array.isArray(j.body)?j.body:[];
  const same=ja.filter(x=>up(x.symbol)===ticker);
  const ver=same.filter(x=>x.isVerified===true||(x.tags||[]).includes("verified"));
  const sf=await get(`https://www.stonkfun.xyz/api/public/v1/tokens?q=${encodeURIComponent(ticker)}`);
  const sfl=sf.body?.data?.tokens??[];
  const sfn=await get(`https://www.stonkfun.xyz/api/public/v1/tokens?q=${encodeURIComponent(name)}`);
  const sfnl=sfn.body?.data?.tokens??[];
  out.push({name,ticker,tickerFormat:rules.TICKER.test(ticker),
    checkProposal:rules.checkProposal({name,symbol:ticker,tagline:"A cat."}),
    displaySafe:rules.displaySafe({name,symbol:ticker}),
    copycatOf:copycatOf({name,symbol:ticker})??null,
    tickerFree:vidx?tickerFree(vidx,{name,symbol:ticker}):null,
    jupiter:{status:j.status,results:ja.length,sameSymbol:same.length,verifiedSameSymbol:ver.length,verifiedNames:ver.map(x=>x.name)},
    stonkfun:{status:sf.status,sameSymbol:sfl.filter(t=>up(t.symbol)===ticker).map(t=>t.name),nameStatus:sfn.status,sameName:sfnl.filter(t=>String(t.name).toLowerCase()===name.toLowerCase()).map(t=>t.symbol)}});
}
console.log(JSON.stringify(out,null,1));

/* Records fixtures/agent/jupiter-usdc-<sym>-sol-hop.json for MEW and KITTY. */
import fs from "node:fs";
import { VersionedTransaction, TransactionMessage, AddressLookupTableAccount, PublicKey } from "@solana/web3.js";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USER="J5sCaGHaVmUGsoYTsLnvoX71air9ffpaFnE959kudPt6";
const JUP="JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const LITE="https://lite-api.jup.ag/swap/v1";
const RPC="https://api.mainnet-beta.solana.com";
const [,, sym, mint, outFile] = process.argv;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let last=0; async function pace(){ const w=last+1250-Date.now(); if(w>0) await sleep(w); last=Date.now(); }
async function rpc(method, params){ await sleep(400); const r=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})}); const j=await r.json(); if(j.error) throw new Error(JSON.stringify(j.error)); return j.result; }
const quoteQuery=(inputMint,outputMint,amount)=>({inputMint,outputMint,amount:String(amount),slippageBps:"100",swapMode:"ExactIn",onlyDirectRoutes:"false",restrictIntermediateTokens:"true",maxAccounts:"24",instructionVersion:"V2"});
const swapBody=(quote,shared)=>({quoteResponse:quote,userPublicKey:USER,wrapAndUnwrapSol:false,dynamicComputeUnitLimit:false,useSharedAccounts:shared,prioritizationFeeLamports:{priorityLevelWithMaxLamports:{maxLamports:50000,priorityLevel:"veryHigh",global:false}}});
async function getQuote(q){ await pace(); const r=await fetch(`${LITE}/quote?${new URLSearchParams(q)}`); const j=await r.json(); if(!r.ok) throw new Error(`quote ${r.status} ${JSON.stringify(j)}`); return j; }
async function postSwap(b){ await pace(); const r=await fetch(`${LITE}/swap`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)}); const j=await r.json(); if(!r.ok) throw new Error(`swap ${r.status} ${JSON.stringify(j)}`); return j; }
const qb=quoteQuery(USDC,mint,10_000_000);
const quoteBuy=await getQuote(qb);
const swapBuy=await postSwap(swapBody(quoteBuy,true));
const swapBuyUnshared=await postSwap(swapBody(quoteBuy,false));
const qs=quoteQuery(mint,USDC,quoteBuy.outAmount);
const quoteSell=await getQuote(qs);
const swapSell=await postSwap(swapBody(quoteSell,true));
const txs=[swapBuy,swapBuyUnshared,swapSell].map(s=>VersionedTransaction.deserialize(Buffer.from(s.swapTransaction,"base64")));
const altAddrs=[...new Set(txs.flatMap(t=>t.message.addressTableLookups.map(l=>l.accountKey.toBase58())))];
const altRead=await rpc("getMultipleAccounts",[altAddrs,{encoding:"base64",commitment:"confirmed"}]);
const lookupTables=altAddrs.map((address,i)=>({address,owner:altRead.value[i].owner,lamports:altRead.value[i].lamports,data:altRead.value[i].data}));
const tables=lookupTables.map(t=>new AddressLookupTableAccount({key:new PublicKey(t.address),state:AddressLookupTableAccount.deserialize(Buffer.from(t.data[0],"base64"))}));
/* every account the three transactions name writable, read once on the same RPC */
const writable=[...new Set(txs.flatMap(t=>{const m=TransactionMessage.decompile(t.message,{addressLookupTableAccounts:tables.filter(x=>t.message.addressTableLookups.some(l=>l.accountKey.equals(x.key)))}); return m.instructions.flatMap(ix=>ix.keys.filter(k=>k.isWritable).map(k=>k.pubkey.toBase58()));}))];
const wr=await rpc("getMultipleAccounts",[writable,{encoding:"base64",commitment:"confirmed"}]);
const writableAccounts=writable.map((address,i)=>({address,account:wr.value[i]?{owner:wr.value[i].owner,lamports:wr.value[i].lamports,data:wr.value[i].data}:null}));
const out={ note:"", capturedAt:new Date().toISOString(),
  sources:{ quote:`GET ${LITE}/quote`, swap:`POST ${LITE}/swap`, accounts:`POST ${RPC} getMultipleAccounts (base64, confirmed)` },
  query:{ quoteBuy:qb, quoteSell:qs, swapBody:{...swapBody({"…":"the quote above"},true)}, swapBuyUnsharedBody:{...swapBody({"…":"quoteBuy"},false)} },
  user:USER, settlementMint:USDC, tokenMint:mint, symbol:sym,
  quoteBuy, swapBuy, swapBuyUnshared, quoteSell, swapSell,
  accountsSlot:wr.context.slot, lookupTables, writableAccounts };
fs.writeFileSync(outFile, JSON.stringify(out,null,2)+"\n");
console.log(sym,"buy",quoteBuy.routePlan.map(h=>`${h.swapInfo.inputMint.slice(0,4)}>${h.swapInfo.outputMint.slice(0,4)}@${h.swapInfo.label}`).join(" "),"impact",quoteBuy.priceImpactPct,"sell",quoteSell.routePlan.map(h=>`${h.swapInfo.inputMint.slice(0,4)}>${h.swapInfo.outputMint.slice(0,4)}@${h.swapInfo.label}`).join(" "),"impact",quoteSell.priceImpactPct);

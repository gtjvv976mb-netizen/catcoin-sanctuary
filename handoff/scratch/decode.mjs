import fs from "node:fs";
import { VersionedTransaction, TransactionMessage, AddressLookupTableAccount, PublicKey } from "@solana/web3.js";
const f=process.argv[2]; const d=JSON.parse(fs.readFileSync(f,"utf8"));
const tables=d.lookupTables.map(t=>new AddressLookupTableAccount({key:new PublicKey(t.address),state:AddressLookupTableAccount.deserialize(Buffer.from(t.data[0],"base64"))}));
const acc=new Map(d.writableAccounts.map(w=>[w.address,w.account]));
const desc=(k)=>{const a=acc.get(k); if(a===undefined) return ""; if(!a) return "(absent)"; const b=Buffer.from(a.data[0],"base64"); if(b.length>=165&&a.owner.startsWith("Token")) return `token acct mint=${new PublicKey(b.subarray(0,32)).toBase58().slice(0,4)} owner=${new PublicKey(b.subarray(32,64)).toBase58()} amt=${b.readBigUInt64LE(64)}`; return `owner=${a.owner.slice(0,8)} len=${b.length}`;};
for (const k of process.argv.slice(3)) {
  const tx=VersionedTransaction.deserialize(Buffer.from(d[k].swapTransaction,"base64"));
  const m=TransactionMessage.decompile(tx.message,{addressLookupTableAccounts:tables.filter(x=>tx.message.addressTableLookups.some(l=>l.accountKey.equals(x.key)))});
  console.log("==",k,"sigs",tx.message.header.numRequiredSignatures,"alts",tx.message.addressTableLookups.length, "static", tx.message.staticAccountKeys.length);
  m.instructions.forEach((ix,i)=>{console.log(`#${i} ${ix.programId.toBase58().slice(0,8)} data=${Buffer.from(ix.data).toString("hex")}`); ix.keys.forEach((kk,j)=>{ if(ix.programId.toBase58().startsWith("Compute")) return; console.log(`   [${j}] ${kk.pubkey.toBase58()} ${kk.isSigner?"S":"-"}${kk.isWritable?"W":"-"} ${kk.isWritable?desc(kk.pubkey.toBase58()):""}`);});});
}

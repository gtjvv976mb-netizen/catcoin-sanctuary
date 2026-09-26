import fs from "node:fs";
import { VersionedTransaction, TransactionMessage, AddressLookupTableAccount, PublicKey } from "@solana/web3.js";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const J="JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
for (const f of ["/home/user/Cat-Intelligence-Agency/fixtures/agent/jupiter-usdc-popcat-swap.json","/home/user/Cat-Intelligence-Agency/fixtures/xstock-pools/jupiter-gldx-swap.json"]) {
  const d=JSON.parse(fs.readFileSync(f,"utf8"));
  const tables=d.lookupTables.map(t=>new AddressLookupTableAccount({key:new PublicKey(t.address),state:AddressLookupTableAccount.deserialize(Buffer.from(t.data[0],"base64"))}));
  for (const k of ["swapBuy","swapSell"]) {
    const tx=VersionedTransaction.deserialize(Buffer.from(d[k].swapTransaction,"base64"));
    const m=TransactionMessage.decompile(tx.message,{addressLookupTableAccounts:tables});
    const r=m.instructions.find(i=>i.programId.toBase58()===J);
    console.log(f.split("/").pop(),k,Buffer.from(r.data).toString("hex"));
  }
}
for (let id=0; id<8; id++) console.log(id, PublicKey.findProgramAddressSync([Buffer.from("authority"), Buffer.from([id])], new PublicKey(J))[0].toBase58());
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", WSOL="So11111111111111111111111111111111111111112", TK="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
console.log("ATA 6U91 USDC", associatedTokenAddress("6U91aKa8pmMxkJwBCfPTmUEfZi6dHe7DcFq2ALvB2tbB", USDC, TK));
console.log("ATA 6U91 WSOL", associatedTokenAddress("6U91aKa8pmMxkJwBCfPTmUEfZi6dHe7DcFq2ALvB2tbB", WSOL, TK));
console.log("ATA 6U91 MEW", associatedTokenAddress("6U91aKa8pmMxkJwBCfPTmUEfZi6dHe7DcFq2ALvB2tbB", "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", TK));
console.log("ATA BQ72 WSOL", associatedTokenAddress("BQ72nSv9f3PRyRKCBnHLVrerrv37CYTHm5h3s9VSGQDV", WSOL, TK));
console.log("ATA BQ72 USDC", associatedTokenAddress("BQ72nSv9f3PRyRKCBnHLVrerrv37CYTHm5h3s9VSGQDV", USDC, TK));
console.log("ATA user WSOL", associatedTokenAddress("J5sCaGHaVmUGsoYTsLnvoX71air9ffpaFnE959kudPt6", WSOL, TK));

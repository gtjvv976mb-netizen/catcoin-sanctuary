// Mainnet simulation (sigVerify off, nothing sent): an outsider sends the 0-byte rent minimum to a
// wallet's not-yet-created KITTY account address, then the wallet's idempotent create runs (as in
// Jupiter's build). How many lamports does the WALLET pay for the create, and what does the
// runner's rent term (post lamports only when the pre read was null) allow?
import { PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { associatedTokenAddress } from "/home/user/Cat-Intelligence-Agency/src/lib/tx.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const OUTSIDER = "FnppzHx6iP1vzTj8KVjs3AqDiHEC3T8R33WsitK77wVE", WALLET = "GJvewfRjqTUPtx6WsBSUnaFbdgXwgXnWfpDyLm65T4YA";
const KITTY = "4N4DnNo3qpPks9aQCkcWkzoir8tnvT6diS4TnnZibonk", TK = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const ata = associatedTokenAddress(WALLET, KITTY, TK);
const pk = (k) => new PublicKey(k);
const create = new TransactionInstruction({ programId: pk(ATA), data: Buffer.from([1]), keys: [
  { pubkey: pk(WALLET), isSigner: true, isWritable: true }, { pubkey: pk(ata), isSigner: false, isWritable: true }, { pubkey: pk(WALLET), isSigner: false, isWritable: false },
  { pubkey: pk(KITTY), isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, { pubkey: pk(TK), isSigner: false, isWritable: false }] });
const { blockhash } = await rpc.getLatestBlockhash();
for (const prefund of [0, 650_240]) {
  const ixs = [...(prefund ? [SystemProgram.transfer({ fromPubkey: pk(OUTSIDER), toPubkey: pk(ata), lamports: prefund })] : []), create];
  const msg = new TransactionMessage({ payerKey: pk(OUTSIDER), recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  const b64 = Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
  const pre = await rpc.getMultipleAccounts([WALLET, ata]);
  const sim = await rpc.call("simulateTransaction", [b64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "processed", accounts: { encoding: "base64", addresses: [WALLET, ata] } }]);
  const v = sim.value;
  console.log(`prefund ${prefund}: err ${JSON.stringify(v.err)} pre slot ${pre.slot} sim slot ${sim.context.slot}; ata pre ${JSON.stringify(pre.accounts[1])} ata post lamports ${v.accounts?.[1]?.lamports} owner ${v.accounts?.[1]?.owner}`);
  console.log(`   the WALLET paid ${BigInt(pre.accounts[0].lamports) - BigInt(v.accounts[0].lamports)} lamports for the create`);
  await new Promise((r) => setTimeout(r, 1500));
}

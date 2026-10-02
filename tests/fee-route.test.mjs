/* The fee route (scripts/lib/fee-route.mjs): a new coin's creator fees, for good, to UsePaid's recipient, as pump.fun's
   own app and UsePaid's coins send it. Pinned to a real transaction: Mars3D (AoGw7mp6…), 2026-10-01, 3saF9Xnw…. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  PUMP_FEES, PUMP_AMM, USEPAID_RECIPIENT, usePaidLine, CREATE_FEE_SHARING_CONFIG_DISC, UPDATE_FEE_SHARES_DISC, sharingConfig, pumpCreatorVault,
  coinCreatorVaultAuthority, coinCreatorVaultAta, createFeeSharingConfigAccounts, updateFeeSharesAccounts, updateFeeSharesData,
  buildFeeRouteTransaction, checkFeeRouteMessage, signFeeRouteTransaction, unsignedFeeRouteTransaction, decodeSharingConfig, routedTo,
} from "../scripts/lib/fee-route.mjs";
import { pda } from "../scripts/lib/chain.mjs";
import { keypairFromSecret, decodeLegacyMessage } from "../scripts/lib/solana-tx.mjs";
import { base58Decode, base58Encode } from "../assets/collection.js";

const MARS = { mint: "AoGw7mp6FyF5c3Pj31SuJxwWLrNrNureP14LBHsBiAce", creator: "CShzf96Wmp1XyhZyEicb6HEyr2tqBTrV3ThHnywfTK2Y" };
// The real transaction's two Fees Program instructions: [address, signer, writable], and their data (base58).
const REAL_CREATE = [["D6QxXDt6hhcCpto4HiZKkN2YQ2iZRF5R7S3caCHpUsML", 0, 0], ["pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ", 0, 0], [MARS.creator, 1, 1],
  ["4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf", 0, 0], [MARS.mint, 0, 0], ["7AG5ABWypXRWPJWasAXaQ1YkqnEhNdrqdw1rcvc4W1bX", 0, 1], ["11111111111111111111111111111111", 0, 0],
  ["EfBWnaNYtS7Bz4gymG3fmAXoJuLWaCetjZCsnWJiqKBc", 0, 1], ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", 0, 0], ["Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1", 0, 0],
  ["pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ", 0, 0], ["pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ", 0, 0], ["pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ", 0, 0]];
const REAL_UPDATE = [["D6QxXDt6hhcCpto4HiZKkN2YQ2iZRF5R7S3caCHpUsML", 0, 0], ["pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ", 0, 0], [MARS.creator, 1, 1],
  ["4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf", 0, 0], [MARS.mint, 0, 0], ["7AG5ABWypXRWPJWasAXaQ1YkqnEhNdrqdw1rcvc4W1bX", 0, 1], ["EfBWnaNYtS7Bz4gymG3fmAXoJuLWaCetjZCsnWJiqKBc", 0, 1],
  ["5dNXrfMW1k9xAYi8UcEuyJngNJ1Cpek4ZMiFS7odfURL", 0, 1], ["11111111111111111111111111111111", 0, 0], ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", 0, 0],
  ["Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1", 0, 0], ["pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", 0, 0], ["GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR", 0, 0],
  ["So11111111111111111111111111111111111111112", 0, 0], ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", 0, 0], ["ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", 0, 0],
  ["RTRF3ZLRPfVoyZ3ZLdntUzNXznswrTnKT92rHTrtETf", 0, 1], ["3WbpNMkaZz74csGxHpQNmfygEXjn4YpZ2w4h74WEMUBQ", 0, 1], [MARS.creator, 1, 1]];
const flat = (keys) => keys.map((k) => [k.pubkey, k.isSigner ? 1 : 0, k.isWritable ? 1 : 0]);
const BLOCKHASH = "11111111111111111111111111111111";
const W = keypairFromSecret(new Uint8Array(32).fill(7));

test("the fee route is UsePaid's, byte for byte: Mars3D's real create_fee_sharing_config and update_fee_shares", () => {
  assert.deepEqual(flat(createFeeSharingConfigAccounts(MARS.mint, MARS.creator)), REAL_CREATE);
  assert.deepEqual(flat(updateFeeSharesAccounts(MARS.mint, MARS.creator)), REAL_UPDATE);
  assert.equal(base58Encode(Buffer.from(CREATE_FEE_SHARING_CONFIG_DISC, "hex")), "ZfiMAoCYrsN");
  assert.equal(base58Encode(updateFeeSharesData(USEPAID_RECIPIENT)), "MeVmhzUJB639DZAW1YuXPE9vHA3xTRBC8jGtJpkbLjrsBTQRMaS8YdgJ25gYRnE");
  // The discriminators are Anchor's, and the PDAs derive as pinned.
  for (const [hex, name] of [[CREATE_FEE_SHARING_CONFIG_DISC, "create_fee_sharing_config"], [UPDATE_FEE_SHARES_DISC, "update_fee_shares"]]) {
    assert.equal(hex, createHash("sha256").update(`global:${name}`).digest().subarray(0, 8).toString("hex"));
  }
  assert.equal(pda(["utf8:__event_authority"], PUMP_FEES.program), PUMP_FEES.eventAuthority);
  assert.equal(pda(["utf8:__event_authority"], PUMP_AMM.program), PUMP_AMM.eventAuthority);
  const config = sharingConfig(MARS.mint);
  assert.deepEqual([config, pumpCreatorVault(config), coinCreatorVaultAuthority(config), coinCreatorVaultAta(config)],
    ["7AG5ABWypXRWPJWasAXaQ1YkqnEhNdrqdw1rcvc4W1bX", "5dNXrfMW1k9xAYi8UcEuyJngNJ1Cpek4ZMiFS7odfURL", "RTRF3ZLRPfVoyZ3ZLdntUzNXznswrTnKT92rHTrtETf", "3WbpNMkaZz74csGxHpQNmfygEXjn4YpZ2w4h74WEMUBQ"]);
  // UsePaid's recipient: Fees Program social fee account ["social-fee-pda", "322216527", 2] (its GitHub account).
  assert.equal(pda(["utf8:social-fee-pda", "utf8:322216527", base58Encode(Buffer.from([2]))], PUMP_FEES.program), USEPAID_RECIPIENT);
  assert.equal(usePaidLine("KittiesVids"), "Fees to @KittiesVids via UsePaid");
});

test("the fee route's transaction: one signer, the wallet; only these instructions; anything else refused before signing", () => {
  const built = buildFeeRouteTransaction({ wallet: W.publicKey, mint: MARS.mint, recentBlockhash: BLOCKHASH });
  assert.ok(1 + 64 + built.messageBytes.length <= 1232, "a plain legacy transaction");
  assert.deepEqual(built.signers, [W.publicKey]);
  assert.equal(checkFeeRouteMessage(built.messageBytes, built), true);
  const signed = Buffer.from(signFeeRouteTransaction(built, W), "base64");
  assert.equal(signed[0], 1);
  assert.ok(Buffer.from(unsignedFeeRouteTransaction(built), "base64").subarray(1, 65).every((b) => b === 0));
  // Another recipient, another mint or a different wallet is not this route.
  assert.throws(() => checkFeeRouteMessage(built.messageBytes, { ...built, recipient: MARS.creator }), /every basis point/);
  assert.throws(() => checkFeeRouteMessage(built.messageBytes, { ...built, mint: MARS.creator }), /not the one for this mint/);
  assert.throws(() => checkFeeRouteMessage(built.messageBytes, { ...built, wallet: MARS.creator }), /signer is not the wallet/);
  assert.throws(() => signFeeRouteTransaction(built, keypairFromSecret(new Uint8Array(32).fill(8))), /not the fee route's wallet/);
  assert.throws(() => buildFeeRouteTransaction({ wallet: W.publicKey, mint: MARS.mint, recentBlockhash: BLOCKHASH, recipient: W.publicKey }), /nothing to route/);
  assert.throws(() => buildFeeRouteTransaction({ wallet: W.publicKey, mint: MARS.mint, recentBlockhash: BLOCKHASH, computeUnitPriceMicroLamports: 10 ** 12 }), /priority fee/);
  // A tampered byte in update_fee_shares's share is refused from the bytes.
  const bytes = Uint8Array.from(built.messageBytes);
  const at = Buffer.from(bytes).indexOf(Buffer.from([0x10, 0x27]));                 // 10,000 little-endian
  bytes[at] = 0x0f;
  assert.throws(() => checkFeeRouteMessage(bytes, built));
  assert.equal(decodeLegacyMessage(built.messageBytes).accountKeys[0], W.publicKey);
});

test("a sharing config is read back: routed to UsePaid for good only with one shareholder, all 10,000 basis points, the admin revoked", () => {
  const data = (shareholders, revoked = 1) => {
    const b = Buffer.alloc(1024);
    b[8] = 254; b[9] = 2; b[10] = 1;
    Buffer.from(base58Decode(MARS.mint)).copy(b, 11); Buffer.from(base58Decode(MARS.creator)).copy(b, 43); b[75] = revoked;
    b.writeUInt32LE(shareholders.length, 76);
    shareholders.forEach(([a, bps], i) => { Buffer.from(base58Decode(a)).copy(b, 80 + 34 * i); b.writeUInt16LE(bps, 112 + 34 * i); });
    return b;
  };
  const ok = decodeSharingConfig(data([[USEPAID_RECIPIENT, 10_000]]));
  assert.deepEqual(ok, { mint: MARS.mint, admin: MARS.creator, adminRevoked: true, shareholders: [{ address: USEPAID_RECIPIENT, bps: 10_000 }] });
  assert.equal(routedTo(ok), true);
  assert.equal(routedTo(decodeSharingConfig(data([[USEPAID_RECIPIENT, 10_000]], 0))), false, "not revoked: could still change");
  assert.equal(routedTo(decodeSharingConfig(data([[MARS.creator, 10_000]]))), false);
  assert.equal(routedTo(decodeSharingConfig(data([[USEPAID_RECIPIENT, 5_000], [MARS.creator, 5_000]]))), false);
  assert.equal(decodeSharingConfig(Buffer.alloc(20)), null);
  assert.equal(routedTo(null), false);
});

section("15. A LIVE HOP THROUGH SOL: KITTY BOUGHT AND SOLD BACK, THE SOL NEVER IN THE WALLET");
{
  /* KITTY has no USDC pool on this chain, as on the live API: Jupiter's double quotes it
     through SOL and builds the hop on program authority 3's accounts, as the live routes
     were built. The real engine's guard and fences, the real autopilot key. */
  const { w, r, AUTO, held } = await liveRig({ spec: { universe: [POPCAT, KITTY] } });
  const walletSol = w.chain.ataOf(AUTO, WSOL);
  const lamportsBefore = w.chain.st.lamports.get(AUTO);
  w.decisions.push({ rationale: "KITTY: a $15 buy.", actions: [buy(KITTY, 15, "trend")] });
  await r.tick();
  const fill = journalOf(r, "fill")[0];
  const sent = [...w.chain.st.sent.values()];
  const msg = sent.length ? TransactionMessage.decompile(VersionedTransaction.deserialize(sent[0].bytes).message, { addressLookupTableAccounts: VersionedTransaction.deserialize(sent[0].bytes).message.addressTableLookups.map((l) => altObject(l.accountKey.toBase58(), w.chain.st.alts.get(l.accountKey.toBase58()))) }) : null;
  const jup = msg?.instructions.find((ix) => ix.programId.toBase58() === JUPITER_PROGRAM);
  ok("the live KITTY buy filled through one hop: USDC → SOL → KITTY, signed by the autopilot key", fill?.side === "buy" && fill.symbol === "KITTY" && fill.paper === false && fill.usd === 15 && w.quoteLog.at(-1)?.ask.maxAccounts === "24",
    JSON.stringify(journalOf(r, "refusal")[0] ?? {}));
  ok("…built on Jupiter's shared accounts (asked for, and so sent): shared_accounts_route_v2 on program authority 3",
    w.swapBodies.at(-1)?.useSharedAccounts === true && Buffer.from(jup?.data ?? []).subarray(0, 8).equals(SHARED_ROUTE_V2) && jup.keys[0].pubkey.toBase58() === w.chain.JUP_AUTH);
  ok("the wallet was left holding NO wrapped SOL: no wrapped-SOL account, and none named by what it signed",
    !w.chain.st.tokens.has(walletSol) && !msg.instructions.some((ix) => ix.keys.some((k) => k.pubkey.toBase58() === walletSol)));
  const feeAndRent = lamportsBefore - w.chain.st.lamports.get(AUTO);
  ok("its SOL moved by the fee and the KITTY account's rent, and not a lamport more", feeAndRent === 5_000n + 50_000n + RENT_ATA, `${feeAndRent} lamports`);
  ok("the chain moved exactly $15 of USDC, and the book holds exactly the KITTY it delivered", held(USDC) === 85_000_000n && r.state().positions[KITTY]?.qtyRaw === held(KITTY).toString() && held(KITTY) > 0n);
  ok("…and the SOL in the middle passed through Jupiter's account and left it", w.chain.st.tokens.get(w.chain.ataOf(w.chain.JUP_AUTH, WSOL)).amount === 0n);

  for (const [mode, clause, what] of [
    ["hop_unshared", "intermediate_in_wallet", "a hop built as route_v2, its SOL in the wallet's own wrapped-SOL account (what Jupiter built unshared)"],
    ["hop_sol_input", "sol_as_input", "a hop whose route takes 3,000,000 of the wallet's lamports on the way — inside the engine's own fee and rent caps"],
  ]) {
    w.jupMode = mode;
    const sends = w.chain.st.sent.size;
    w.decisions.push({ rationale: `More KITTY (${mode}).`, actions: [buy(KITTY, 10)] });
    await r.runNow();
    await r.tick();
    const refusal = journalOf(r, "refusal")[0];
    ok(`${what}: refused at ${clause} before signing, nothing sent`, refusal?.clause === clause && refusal.from === "execution" && w.chain.st.sent.size === sends, `${refusal?.clause}: ${refusal?.message?.slice(0, 100)}`);
  }
  w.jupMode = null;
  ok("…and the wallet still holds no wrapped SOL, and only the KITTY the good buy delivered", !w.chain.st.tokens.has(walletSol) && r.state().positions[KITTY]?.qtyRaw === held(KITTY).toString());

  const usdcBefore = held(USDC), lamportsMid = w.chain.st.lamports.get(AUTO);
  w.decisions.push({ rationale: "Take KITTY off.", actions: [sell(KITTY, 1)] });
  await r.runNow();
  await r.tick();
  const back = journalOf(r, "fill")[0];
  ok("the KITTY sold back live through SOL (KITTY → SOL → USDC): USDC returned, the position closed", back?.side === "sell" && back.symbol === "KITTY" && back.paper === false && held(USDC) > usdcBefore && held(KITTY) === 0n && !r.state().positions[KITTY]);
  ok("…its SOL moved by the fee alone, and still no wrapped SOL in the wallet", lamportsMid - w.chain.st.lamports.get(AUTO) === 5_000n + 50_000n && !w.chain.st.tokens.has(walletSol));
  w.decisions.push({ rationale: "POPCAT, direct.", actions: [buy(POPCAT, 12)] });
  await r.runNow();
  await r.tick();
  ok("in the same agent a POPCAT buy still goes direct, exactly as before: route_v2 on its USDC pool, no shared-accounts switch in the body",
    journalOf(r, "fill")[0]?.symbol === "POPCAT" && w.swapBodies.at(-1)?.quoteResponse.routePlan.length === 1 && !("useSharedAccounts" in w.swapBodies.at(-1)));
}



section("14. ONE HOP THROUGH SOL, ON THE LIVE RECORDED USDC → MEW AND USDC → KITTY TRANSACTIONS");
{
  /* Recorded 2026-09-25 for the same throwaway key as the POPCAT pair, asked exactly as the
     agent asks (solHop: maxAccounts 24, not direct only; the build on shared accounts). MEW
     and KITTY have no USDC pool: both routes pass through SOL. Hostile edits are made to the
     LIVE bytes — decompiled against the recorded tables, one thing changed, recompiled — and
     each is refused by name before any signature exists. */
  const MEWFX = read("./fixtures/agent/jupiter-usdc-mew-swap.json");
  const KITFX = read("./fixtures/agent/jupiter-usdc-kitty-swap.json");
  const SHAPES = read("./fixtures/agent/jupiter-cat-route-shapes.json");
  const tablesOf = (fx, txBase64) => loadLookupTables({ async getMultipleAccounts(a) { return { accounts: a.map((x) => fx.lookupTables.find((t) => t.address === x) ?? null) }; } }, lookupTableKeysOf(txBase64));
  const spec = normalizeAgentSpec({ universe: [MEW, KITTY] });
  const quoteOf = (fx, side) => (side === "buy" ? fx.quoteBuy : fx.quoteSell);
  const qargs = (fx, side, over = {}) => ({ inputMint: quoteOf(fx, side).inputMint, outputMint: quoteOf(fx, side).outputMint, amountRaw: quoteOf(fx, side).inAmount, slippageBps: 100, slippageCapBps: 100,
    maxPriceImpactPct: side === "buy" ? AGENT_MAX_BUY_IMPACT_PCT : 100, solHop: true, ...over });
  const quoteClause = (quote, a) => { try { checkQuote(quote, a); return "passed"; } catch (e) { return e.clause ?? e.message; } };
  const txArgs = async (fx, side, swapKey = side === "buy" ? "swapBuy" : "swapSell") => ({ txBase64: fx[swapKey].swapTransaction, wallet: fx.user, inputMint: quoteOf(fx, side).inputMint, outputMint: quoteOf(fx, side).outputMint,
    inputProgram: TK, outputProgram: TK, amountRaw: quoteOf(fx, side).inAmount, quote: quoteOf(fx, side), slippageCapBps: 100, lookupTables: await tablesOf(fx, fx[swapKey].swapTransaction),
    maxPriorityFeeLamports: AGENT_PRIORITY_FEE_LAMPORTS, allowedPairs: allowedPairsFor(spec), solHop: true });
  const txClause = (a) => { try { checkSwapTransaction(a); return "passed"; } catch (e) { return e.clause ?? e.message; } };
  const readOf = (fx, c) => c.writableAddresses.map((a) => fx.writableAccounts.find((x) => x.address === a)?.account ?? null);
  const chainClause = (fx, c, accounts = readOf(fx, c)) => {
    try { checkWritableCustody({ wallet: fx.user, writableAddresses: c.writableAddresses, accounts, allowed: [c.inputAta, c.outputAta] }); checkRouteMints({ writableAddresses: c.writableAddresses, accounts, mints: [USDC, WSOL, fx.tokenMint] }); return "passed"; }
    catch (e) { return e.clause ?? e.message; }
  };
  const authorityOf = (id) => PublicKey.findProgramAddressSync([Buffer.from("authority"), Buffer.from([id])], new PublicKey(JUPITER_PROGRAM))[0].toBase58();

  /* THE QUOTES */
  const mq = checkQuote(MEWFX.quoteBuy, qargs(MEWFX, "buy"));
  ok("the live MEW buy quote passes the agent's check: one hop, USDC → SOL → MEW, inside the 2% buy cap", mq.intermediate === WSOL && mq.legs === 2 && mq.hops.map((h) => `${h.inputMint}>${h.outputMint}`).join() === `${USDC}>${WSOL},${WSOL}>${MEW}` && mq.impactPct < 2);
  ok("…and the MEW sell back to USDC, through SOL again", checkQuote(MEWFX.quoteSell, qargs(MEWFX, "sell")).intermediate === WSOL);
  ok("the same MEW quote, held to the xStock venue's rule (direct only), is refused at route_not_direct: the venue does not take the hop", quoteClause(MEWFX.quoteBuy, qargs(MEWFX, "buy", { solHop: false })) === "route_not_direct");
  ok("the live KITTY buy quote, 2.50% impact over the whole route, is refused at impact_over_cap: the 2% cap is the route's, not one pool's",
    quoteClause(KITFX.quoteBuy, qargs(KITFX, "buy")) === "impact_over_cap" && Math.abs(Number(KITFX.quoteBuy.priceImpactPct) * 100 - 2.495) < 0.001);
  ok("…while its sell (a sell is never refused for impact) passes, through SOL", checkQuote(KITFX.quoteSell, qargs(KITFX, "sell")).intermediate === WSOL);

  /* THE TRANSACTIONS, AND THE CHAIN AS READ THAT MORNING */
  const mb = checkSwapTransaction(await txArgs(MEWFX, "buy"));
  const heldSol = associatedTokenAddress(mb.programAuthority, WSOL, TK);
  ok("the live MEW buy transaction passes: Jupiter's shared-accounts route, two steps ending 1 → 2, run by program authority 7",
    mb.route.name === "shared_accounts_route_v2" && mb.route.id === 7 && mb.route.routeSteps === 2 && mb.route.lastStep.inputIndex === 1 && mb.route.lastStep.outputIndex === 2 && mb.intermediate === WSOL);
  ok("…whose program authority is the PDA of \"authority\" and 7, as its first account says", mb.programAuthority === authorityOf(7) && mb.programAuthority === jupiterProgramAuthority(7));
  ok("…one account created, the wallet's MEW; the wallet's wrapped-SOL account is named nowhere", mb.createdAtas.length === 1 && mb.createdAtas[0] === mb.outputAta && !mb.writableAddresses.includes(mb.walletIntermediateAta)
    && mb.walletIntermediateAta === associatedTokenAddress(MEWFX.user, WSOL, TK));
  ok("the SOL in the middle sits in Jupiter's own wrapped-SOL account, which the route writes, owned by the authority on chain",
    mb.writableAddresses.includes(heldSol) && tokenAccountDetails(readOf(MEWFX, mb)[mb.writableAddresses.indexOf(heldSol)])?.owner === mb.programAuthority);
  ok("on the chain as read that morning: every token account the route writes holds USDC, SOL or MEW, and none but its two is the wallet's", chainClause(MEWFX, mb) === "passed");
  const ms = checkSwapTransaction(await txArgs(MEWFX, "sell"));
  ok("the live MEW sell passes the same way (authority 3, the wallet's USDC account created for the proceeds)", ms.route.id === 3 && ms.intermediate === WSOL && ms.createdAtas[0] === ms.outputAta && chainClause(MEWFX, ms) === "passed");
  const kb = checkSwapTransaction(await txArgs(KITFX, "buy")), ks = checkSwapTransaction(await txArgs(KITFX, "sell"));
  ok("the live KITTY buy and sell transactions pass too (authorities 5 and 3), and so does the chain they write",
    kb.route.id === 5 && ks.route.id === 3 && kb.intermediate === WSOL && ks.intermediate === WSOL && chainClause(KITFX, kb) === "passed" && chainClause(KITFX, ks) === "passed");
  ok("Jupiter's OWN build of the same MEW buy without shared accounts — route_v2, the SOL held in the wallet's account — is refused at intermediate_in_wallet",
    txClause(await txArgs(MEWFX, "buy", "swapBuyUnshared")) === "intermediate_in_wallet" && txClause(await txArgs(KITFX, "buy", "swapBuyUnshared")) === "intermediate_in_wallet");
  ok("…and with MEW out of the universe the hop is refused first at pair_not_allowed", txClause({ ...(await txArgs(MEWFX, "buy")), allowedPairs: allowedPairsFor(normalizeAgentSpec({ universe: [KITTY] })) }) === "pair_not_allowed");

  /* HOSTILE QUOTES: the shapes */
  const hopQuote = (plan) => ({ ...MEWFX.quoteBuy, routePlan: plan });
  const leg = (i, o, bps = 10_000) => ({ swapInfo: { inputMint: i, outputMint: o, label: "edit" }, percent: null, bps });
  ok("a second intermediate (USDC → SOL → USDT → MEW) is refused at route_too_many_hops", quoteClause(hopQuote([leg(USDC, WSOL), leg(WSOL, USDT), leg(USDT, MEW)]), qargs(MEWFX, "buy")) === "route_too_many_hops");
  const kwif = SHAPES.rows.find((x) => x.symbol === "KWIF" && x.side === "buy" && x.ask === "maxAccounts32");
  const kwifClause = (() => { try { routeShape(kwif.routePlan.map((h) => ({ swapInfo: h, bps: h.bps })), { inputMint: USDC, outputMint: KWIF, solHop: true }); return "passed"; } catch (e) { return e.clause; } })();
  ok("…as Jupiter really answered KWIF at maxAccounts 32 that morning (USDC → USDT → SOL → KWIF): route_too_many_hops", kwif?.intermediates.length === 2 && kwifClause === "route_too_many_hops");
  ok("a non-SOL intermediate (USDC → USDT → MEW) is refused at route_intermediate_not_sol", quoteClause(hopQuote([leg(USDC, USDT), leg(USDT, MEW)]), qargs(MEWFX, "buy")) === "route_intermediate_not_sol");
  ok("a split across different intermediates (60% through SOL, 40% through USDT) is refused at route_split_intermediates",
    quoteClause(hopQuote([leg(USDC, WSOL, 6_000), leg(USDC, USDT, 4_000), leg(WSOL, MEW), leg(USDT, MEW)]), qargs(MEWFX, "buy")) === "route_split_intermediates");
  ok("…and so is a direct pool beside a path through SOL", quoteClause(hopQuote([leg(USDC, MEW, 5_000), leg(USDC, WSOL, 5_000), leg(WSOL, MEW)]), qargs(MEWFX, "buy")) === "route_split_intermediates");
  ok("a path through SOL that does not carry the whole amount is refused at quote_malformed", quoteClause(hopQuote([leg(USDC, WSOL, 6_000), leg(WSOL, MEW)]), qargs(MEWFX, "buy")) === "quote_malformed");
  ok("…while one hop split across two SOL pools is still one way through SOL, and passes", quoteClause(hopQuote([leg(USDC, WSOL, 6_000), leg(USDC, WSOL, 4_000), leg(WSOL, MEW)]), qargs(MEWFX, "buy")) === "passed");

  /* HOSTILE TRANSACTIONS: the live MEW buy, edited */
  const tables = await tablesOf(MEWFX, MEWFX.swapBuy.swapTransaction);
  const alts = [...tables.values()];
  const liveMsg = TransactionMessage.decompile(VersionedTransaction.deserialize(fromBase64(MEWFX.swapBuy.swapTransaction)).message, { addressLookupTableAccounts: alts });
  const rebuild = (edit) => {
    const ixs = liveMsg.instructions.map((ix) => new TransactionInstruction({ programId: ix.programId, keys: ix.keys.map((k) => ({ ...k })), data: Buffer.from(ix.data) }));
    edit(ixs);
    return toBase64(new VersionedTransaction(new TransactionMessage({ payerKey: new PublicKey(MEWFX.user), recentBlockhash: liveMsg.recentBlockhash, instructions: ixs }).compileToV0Message(alts)).serialize());
  };
  const base = await txArgs(MEWFX, "buy");
  const edited = (edit, over = {}) => txClause({ ...base, txBase64: rebuild(edit), ...over });
  const route = (ixs) => ixs.find((ix) => ix.programId.toBase58() === JUPITER_PROGRAM);
  const swapKey = (ix, from, to) => { for (const k of ix.keys) if (k.pubkey.toBase58() === from) k.pubkey = new PublicKey(to); };
  const ATTACKER = newKey();
  const walletSol = mb.walletIntermediateAta;
  const ataCreate = (ata, mint) => new TransactionInstruction({ programId: new PublicKey(ATA_PROGRAM), data: Buffer.from([1]),
    keys: [MEWFX.user, ata, MEWFX.user, mint, SYSTEM, TK].map((k, i) => ({ pubkey: new PublicKey(k), isSigner: i === 0, isWritable: i < 2 })) });
  ok("rebuilt unchanged, the live MEW transaction still passes (the edit harness is honest)", edited(() => {}) === "passed");
  ok("a second intermediate in the bytes (a third step, ending 2 → 3) is refused at route_too_many_hops",
    edited((ixs) => { const r = route(ixs); r.data = Buffer.concat([r.data, Buffer.from([0x69, 0x10, 0x27, 0x02, 0x03])]); r.data.writeUInt32LE(3, 31); }) === "route_too_many_hops");
  ok("a non-SOL intermediate in the bytes (Jupiter's USDT account where its SOL account was) is refused at route_intermediate_not_sol",
    edited((ixs) => swapKey(route(ixs), heldSol, associatedTokenAddress(mb.programAuthority, USDT, TK))) === "route_intermediate_not_sol");
  const vault = mb.writableAddresses.findIndex((a, i) => { const d = tokenAccountDetails(readOf(MEWFX, mb)[i]); return d && d.owner !== mb.programAuthority && d.owner !== MEWFX.user; });
  const usdtVault = readOf(MEWFX, mb).map((a, i) => { if (i !== vault) return a; const b = Buffer.from(a.data[0], "base64"); key(USDT).copy(b, 0); return { ...a, data: [b.toString("base64"), "base64"] }; });
  ok("…and on the chain: a pool vault the route writes that holds USDT is refused at route_intermediate_not_sol", vault >= 0 && chainClause(MEWFX, mb, usdtVault) === "route_intermediate_not_sol");
  ok("the output redirected to another wallet's MEW account is refused at route_accounts", edited((ixs) => { route(ixs).keys[5].pubkey = new PublicKey(associatedTokenAddress(ATTACKER, MEW, TK)); }) === "route_accounts");
  ok("…and so is Jupiter's own output account swapped for another's", edited((ixs) => { route(ixs).keys[4].pubkey = new PublicKey(associatedTokenAddress(ATTACKER, MEW, TK)); }) === "route_accounts");
  ok("…and a program authority other than the one its id byte names", edited((ixs) => { route(ixs).data[8] = 3; }) === "route_accounts");
  ok("stray wrapped SOL: a create of the wallet's own wrapped-SOL account is refused at intermediate_in_wallet", edited((ixs) => { ixs.splice(2, 0, ataCreate(walletSol, WSOL)); }) === "intermediate_in_wallet");
  ok("…and so is a route that holds its SOL in the wallet's wrapped-SOL account instead of Jupiter's", edited((ixs) => swapKey(route(ixs), heldSol, walletSol)) === "intermediate_in_wallet");
  const syncNative = (account) => new TransactionInstruction({ programId: new PublicKey(TK), keys: [{ pubkey: new PublicKey(account), isSigner: false, isWritable: true }], data: Buffer.from([17]) });
  ok("the wallet's SOL spent as input — lamports sent into Jupiter's wrapped-SOL account and synced — is refused at sol_as_input",
    edited((ixs) => { ixs.splice(3, 0, SystemProgram.transfer({ fromPubkey: new PublicKey(MEWFX.user), toPubkey: new PublicKey(heldSol), lamports: 5_000_000 }), syncNative(heldSol)); }) === "sol_as_input");
  ok("…a SyncNative alone is refused at sol_as_input too", edited((ixs) => { ixs.splice(3, 0, syncNative(heldSol)); }) === "sol_as_input");
  ok("…while a System transfer to anyone else is still program_not_allowed, as it always was",
    edited((ixs) => { ixs.push(SystemProgram.transfer({ fromPubkey: new PublicKey(MEWFX.user), toPubkey: new PublicKey(ATTACKER), lamports: 1 })); }) === "program_not_allowed");
  ok("the route not matching the quote: another amount is refused at route_mismatch", edited((ixs) => { route(ixs).data.writeBigUInt64LE(10_000_001n, 9); }) === "route_mismatch");
  ok("…another quoted output", edited((ixs) => { route(ixs).data.writeBigUInt64LE(1n, 17); }) === "route_mismatch");
  ok("…a route plan of one step where the quote has two", edited((ixs) => { const r = route(ixs); r.data = Buffer.from(r.data.subarray(0, r.data.length - 5)); r.data.writeUInt32LE(1, 31); }) === "route_mismatch");
  ok("…and a hop's bytes for a quote that says direct", txClause({ ...base, quote: hopQuote([leg(USDC, MEW)]) }) === "route_mismatch");

  /* THE SIMULATION: what the wallet holds after, and what its SOL paid */
  const wsol = (amount) => ({ owner: TK, lamports: Number(RENT_ATA) + amount, data: [tokenAccountBytes({ mint: WSOL, owner: MEWFX.user, amount }).toString("base64"), "base64"] });
  const leftClause = (before, after) => { try { checkIntermediateLeft({ address: walletSol, before, after }); return "passed"; } catch (e) { return e.clause; } };
  ok("after the simulation, no wrapped-SOL account where there was none: passes", leftClause(null, null) === "passed");
  ok("a stray wrapped-SOL account the simulation leaves in the wallet is refused at intermediate_in_wallet, dust or empty", leftClause(null, wsol(1_000)) === "intermediate_in_wallet" && leftClause(null, wsol(0)) === "intermediate_in_wallet");
  ok("…and so is one the wallet held that the swap moved; one it held, untouched, passes", leftClause(wsol(1_000), wsol(2_000)) === "intermediate_in_wallet" && leftClause(wsol(1_000), wsol(1_000)) === "passed");
  const spendClause = (spent, rent) => { try { checkNativeSpend({ spentLamports: spent, signatures: mb.signatures, priorityFeeLamports: mb.priorityFeeLamports, rentLamports: rent }); return "passed"; } catch (e) { return e.clause; } };
  ok("the wallet's SOL may move by this transaction's fee (5,000 + its 50,000 priority) and the MEW account's rent, exactly",
    mb.priorityFeeLamports === 50_000n && spendClause(5_000n + 50_000n + RENT_ATA, RENT_ATA) === "passed");
  ok("one lamport more is the wallet's SOL spent as trade input: sol_as_input", spendClause(5_000n + 50_000n + RENT_ATA + 1n, RENT_ATA) === "sol_as_input");

  /* THE ASKS: the agent's, and the venue's unchanged */
  const asked = [];
  const client = createJupiterClient({ fetchImpl: async (url, init = {}) => { asked.push({ url, body: init.body ? JSON.parse(init.body) : null }); return response(200, url.includes("/quote") ? MEWFX.quoteBuy : MEWFX.swapBuy); }, clock: () => 0, sleep: async () => {} });
  await client.quote({ inputMint: USDC, outputMint: MEW, amountRaw: 10_000_000n, slippageBps: 100, solHop: true });
  await client.swapTransaction({ quote: MEWFX.quoteBuy, wallet: MEWFX.user, priorityFeeLamports: 50_000, sharedAccounts: true });
  await client.quote({ inputMint: USDC, outputMint: POPCAT, amountRaw: 10_000_000n, slippageBps: 100 });
  await client.swapTransaction({ quote: MEWFX.quoteBuy, wallet: MEWFX.user, priorityFeeLamports: 50_000 });
  const q = (i) => Object.fromEntries(new URL(asked[i].url).searchParams);
  ok("the agent's ask is the recorded one: not direct only, restrictIntermediateTokens, maxAccounts 24", JSON.stringify(q(0)) === JSON.stringify(MEWFX.query.quoteBuy));
  ok("…and its hop is built on shared accounts, no SOL wrapping", asked[1].body.useSharedAccounts === true && asked[1].body.wrapAndUnwrapSol === false);
  ok("a direct ask and build are what they always were: onlyDirectRoutes, no maxAccounts, no useSharedAccounts", q(2).onlyDirectRoutes === "true" && !("maxAccounts" in q(2)) && !("useSharedAccounts" in asked[3].body));
}

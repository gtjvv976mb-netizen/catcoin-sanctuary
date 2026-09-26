import fs from "node:fs";
const src = fs.readFileSync("/home/user/Cat-Intelligence-Agency/test-agent-runner.mjs", "utf8");
function patch(s, a, b) { if (!s.includes(a)) throw new Error("patch anchor missing: " + a.slice(0, 80)); return s.replace(a, b); }
function build({ srcDir, out }) {
  let t = src;
  if (srcDir !== "./src") t = t.replaceAll('from "./src/lib/', `from "${srcDir}/lib/`).replace('new URL("./src/lib/agent-runner.mjs"', `new URL("${srcDir}/lib/agent-runner.mjs"`);
  // 1. the ATA create behaves like spl-associated-token-account's create_pda_account:
  //    an address already holding lamports is topped up (payer pays only the difference), allocated, assigned.
  t = patch(t,
`        if (bal(payerKey) < RENT_ATA) throw new Error("insufficient lamports for rent");
        s.lamports.set(payerKey, bal(payerKey) - RENT_ATA);
        s.tokens.set(ata, { mint, owner, amount: 0n, delegate: null, lamports: RENT_ATA });`,
`        const had = s.lamports.get(ata) ?? 0n;                       // MY EDIT: top-up like create_pda_account
        const need = RENT_ATA > had ? RENT_ATA - had : 0n;
        if (bal(payerKey) < need) throw new Error("insufficient lamports for rent");
        s.lamports.set(payerKey, bal(payerKey) - need);
        s.lamports.delete(ata);
        s.tokens.set(ata, { mint, owner, amount: 0n, delegate: null, lamports: had > RENT_ATA ? had : RENT_ATA });`);
  // 2. sendTransaction's meta: preBalances as the real chain reports them (a System account's lamports too).
  t = patch(t,
`      const pre = before.map((a) => ({ a, lamports: a === payer ? st.lamports.get(a) ?? 0n : st.tokens.get(a)?.lamports ?? 0n, token: st.tokens.get(a) ? { ...st.tokens.get(a) } : null }));`,
`      const snapLam = new Map(st.lamports), snapTok = new Map([...st.tokens].map(([k, v]) => [k, { ...v }]));   // MY EDIT
      const pre = before.map((a) => ({ a, lamports: a === payer ? st.lamports.get(a) ?? 0n : st.tokens.get(a)?.lamports ?? 0n, token: st.tokens.get(a) ? { ...st.tokens.get(a) } : null }));`);
  t = patch(t,
`      const preOf = (a) => pre.find((p) => p.a === a);`,
`      const preOf = (a) => pre.find((p) => p.a === a) ?? { a, lamports: snapTok.get(a)?.lamports ?? snapLam.get(a) ?? 0n, token: snapTok.get(a) ?? null };   // MY EDIT`);
  // 3. my scenario, before section 15, then exit.
  const mine = fs.readFileSync(new URL("./scenario.mjs.txt", import.meta.url), "utf8");
  t = patch(t, `section("15. A LIVE HOP THROUGH SOL`, mine + `\nconsole.log(\`\\n\${pass} passed, \${fail} failed\\n\`);\nprocess.exit(0);\nsection("15. A LIVE HOP THROUGH SOL`);
  fs.writeFileSync(new URL(out, import.meta.url), t);
}
build({ srcDir: "./src", out: "./t-head.mjs" });
build({ srcDir: "./srcfix", out: "./t-fix.mjs" });

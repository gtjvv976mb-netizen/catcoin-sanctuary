#!/bin/bash
# Rebuild the pre-fix sources, then layer the fixes one file at a time; run the new sections each time.
REPO=/home/user/Cat-Intelligence-Agency
SP=/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/prefix
DIFF=/root/.claude/projects/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/tool-results/b4z4ohy2i.txt
cd $REPO
for f in jupiter-swap agent-runner engine agent-strategy rpc tx; do git show HEAD:src/lib/$f.mjs > $SP/src/lib/$f.mjs; done
(cd $SP && patch -s -p1 < $DIFF)
node -e '
const fs=require("fs"); const cur=fs.readFileSync(process.argv[2]+"/src/lib/jupiter-swap.mjs","utf8");
const start=cur.indexOf("/* ── the rent a swap may charge the wallet"); const end=cur.indexOf("/** After the simulation: the wallet\x27s SOL moved by");
const consts = `export const SYSVAR_RENT = "SysvarRent111111111111111111111111111111111";\nconst SYSVAR_OWNER = "Sysvar1111111111111111111111111111111111111";\nconst ACCOUNT_STORAGE_OVERHEAD = 128n;\n`;
fs.appendFileSync(process.argv[1]+"/src/lib/jupiter-swap.mjs", "\n/* SHIM */\n"+consts+cur.slice(start,end));
fs.appendFileSync(process.argv[1]+"/src/lib/engine.mjs", "\nexport const SIMULATION_PIN_TRIES = 6;\n");
' $SP $REPO
cp $REPO/test-agent-runner.mjs $SP/test-agent-runner.mjs
sed -i 's/asked\[2\]\.body\.useSharedAccounts === true && asked\[2\]\.body\.wrapAndUnwrapSol === false/asked[2]?.body?.useSharedAccounts === true \&\& asked[2]?.body?.wrapAndUnwrapSol === false/; s/!("useSharedAccounts" in asked\[4\]\.body)/!("useSharedAccounts" in (asked[4]?.body ?? {}))/; s/w\.chain\.st\.tokens\.get(w\.chain\.ataOf(A, KITTY))\.lamports/w.chain.st.tokens.get(w.chain.ataOf(A, KITTY))?.lamports/; s/w\.chain\.st\.tokens\.get(w\.chain\.ataOf(A, POPCAT))\.lamports/w.chain.st.tokens.get(w.chain.ataOf(A, POPCAT))?.lamports/; s/w\.chain\.st\.other\.get(userAccount)\.lamports === rentHere/w.chain.st.other.get(userAccount)?.lamports === rentHere/' $SP/test-agent-runner.mjs
run() { echo "=== $1"; (cd $SP && timeout 300 node test-agent-runner.mjs 2>&1 | grep -E "FAIL|passed|rror:" | cut -c1-240); }
run "STAGE 0: every file pre-fix"
cp $REPO/src/lib/jupiter-swap.mjs $SP/src/lib/; run "STAGE A: + jupiter-swap.mjs (direct first; the rent helpers)"
cp $REPO/src/lib/agent-runner.mjs $SP/src/lib/; run "STAGE B: + agent-runner.mjs (rent of every opened account; asks pinSlot)"
cp $REPO/src/lib/engine.mjs $SP/src/lib/; run "STAGE C: + engine.mjs (the guard pins the slot)"
cp $REPO/src/lib/rpc.mjs $SP/src/lib/; run "STAGE D: + rpc.mjs (contextSlot)"
cp $REPO/src/lib/tx.mjs $SP/src/lib/; run "STAGE E: + tx.mjs (the fill reader)"

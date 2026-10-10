# Catcoin Sanctuary

A static 3D cat garden (catcoinsanctuary.com) plus GitHub Actions bots that launch pump.fun coins for real, verified
famous cats and post them on X as @catcosanctuary. No build step; Node 22.

- **Start here:** `handoff/HANDOFF.md` covers what is live, what is waiting (cats that need Higgsfield art) and the
  owner's rules. How everything works is in `README.md`; how a cat's 3D model is made is in `scripts/CAT-MODELS.md`.
- **Tests:** `npm test`. Pages runs the same suite before every deploy, so a red test stops the site from updating.
- **Never put a usepaid.app link in an X post:** X refuses the domain. A coin's UsePaid page goes only in its
  metadata's website field.
- **Real cats only,** with proof for every story; nothing invented. The scout writes only `data/research/`. One dated
  exception, the owner's: Schrödinger's Cat (CAT1935, 2026-10-10), approved as a character in `data/launch-approvals.json`.
- **Changes land through a branch and a PR.** The bots commit to `main` all the time, so merge `main` in before
  pushing.
- **Never symlink `data/` into a scratch copy to run tests there:** the launcher tests' fixtures would overwrite the
  live data files.

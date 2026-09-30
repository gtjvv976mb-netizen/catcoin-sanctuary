/**
 * Solana program ids shared by scripts/lib/chain.mjs (which re-exports them), scripts/lib/pump.mjs
 * and scripts/lib/solana-tx.mjs. They live in a module of their own because chain.mjs imports
 * pump.mjs (to prove a pump.fun launch with the builder's own derivations) and pump.mjs needs these
 * ids while it loads: a `const` read across that import cycle would not be initialised yet.
 */
export const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";

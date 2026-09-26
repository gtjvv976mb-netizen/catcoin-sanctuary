> ## Documentation Index
> Fetch the complete documentation index at: https://docs.phantom.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Sign and send transactions

> Sign and send transactions on Solana and Ethereum using the Phantom Connect Browser SDK.

The Phantom Connect Browser SDK provides chain-specific transaction methods through dedicated interfaces (`sdk.solana` and `sdk.ethereum`) for optimal transaction handling.

<Warning>
  **Embedded wallet limitations**: The `signTransaction` and `signAllTransactions` methods **aren't supported** for embedded wallets. For embedded wallets, use only `signAndSendTransaction` that signs and broadcasts the transaction in a single step.
</Warning>

<Info>
  **Transaction security for embedded wallets**: All transactions signed for embedded wallets pass through Phantom's advanced simulation system before execution. This security layer automatically blocks malicious transactions and transactions from origins that have been reported as malicious, providing an additional layer of protection for your users' assets.
</Info>

## Chain-specific transaction methods

### Solana transactions (sdk.solana)

```typescript theme={null}
// Sign and send transaction
const result = await sdk.solana.signAndSendTransaction(transaction);

// Just sign (without sending) - Note: Not supported for embedded wallets
const signedTx = await sdk.solana.signTransaction(transaction);
```

### Ethereum transactions (sdk.ethereum)

```typescript theme={null}
// Send transaction
const result = await sdk.ethereum.sendTransaction({
  to: "0x...",
  value: "1000000000000000000",
  gas: "21000",
});
```

## Dapp-sponsored transactions

Pass a `presignTransaction` callback to `signAndSendTransaction` for Solana transactions that need double signing, such as dapp fee payer flows. Calls without it proceed normally — it is never applied globally.

<Warning>
  Phantom embedded wallets do not accept pre-signed transactions. If your use case requires a second signer (for example, your app as the fee payer), that signing must happen via this callback, after Phantom has constructed and validated the transaction. This restriction does not apply to injected providers (Phantom browser extension).
</Warning>

<Info>
  `presignTransaction` only fires for Solana transactions via the embedded provider. EVM transactions and injected providers are unaffected.
</Info>

### Transaction format

The `transaction` string passed to the callback is **base64url-encoded** (URL-safe base64 without `=` padding, using `-` and `_` instead of `+` and `/`). The SDK exports `base64urlDecode` and `base64urlEncode` utilities:

```typescript theme={null}
import { base64urlDecode, base64urlEncode } from "@phantom/browser-sdk";
```

### Example: dapp fee payer

```typescript theme={null}
import { base64urlDecode, base64urlEncode } from "@phantom/browser-sdk";
import { VersionedTransaction } from "@solana/web3.js";

// This call co-signs as fee payer
const result = await sdk.solana.signAndSendTransaction(transaction, {
  presignTransaction: async (tx, context) => {
    // Send the transaction to your backend for fee payer signing
    const response = await fetch("/api/presign", {
      method: "POST",
      body: JSON.stringify({ transaction: tx, networkId: context.networkId }),
      headers: { "Content-Type": "application/json" },
    });
    const { transaction: signedTx } = await response.json();
    return signedTx; // base64url-encoded, partially signed by the fee payer
  },
});

// This call has no co-signer
const result2 = await sdk.solana.signAndSendTransaction(otherTransaction);
```

<Warning>
  Never hold a fee payer keypair in frontend code. The `presignTransaction` callback runs in the browser — use it to call your own backend, which holds the keypair securely and returns the partially-signed transaction.
</Warning>

## Transaction examples

### Solana transaction examples

The SDK supports multiple Solana transaction libraries. Here are examples using both `@solana/web3.js` and `@solana/kit`:

#### Solana with @solana/web3.js

```typescript theme={null}
import {
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import { BrowserSDK, AddressType } from "@phantom/browser-sdk";

const sdk = new BrowserSDK({
  providers: ["injected"],
  addressTypes: [AddressType.solana],
});

await sdk.connect({ provider: "injected" });

// Get recent blockhash
const connection = new Connection("https://api.mainnet-beta.solana.com");
const { blockhash } = await connection.getLatestBlockhash();

// Create transfer instruction
const fromAddress = await sdk.solana.getPublicKey();
const transferInstruction = SystemProgram.transfer({
  fromPubkey: new PublicKey(fromAddress),
  toPubkey: new PublicKey(toAddress),
  lamports: 0.001 * LAMPORTS_PER_SOL,
});

// Create VersionedTransaction
const messageV0 = new TransactionMessage({
  payerKey: new PublicKey(fromAddress),
  recentBlockhash: blockhash,
  instructions: [transferInstruction],
}).compileToV0Message();

const transaction = new VersionedTransaction(messageV0);

// Send transaction using chain-specific API
const result = await sdk.solana.signAndSendTransaction(transaction);
console.log("Transaction signature:", result.hash);
```

#### Solana with @solana/kit

```typescript theme={null}
import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  address,
  compileTransaction,
} from "@solana/kit";
import { BrowserSDK, AddressType } from "@phantom/browser-sdk";

const sdk = new BrowserSDK({
  providers: ["injected"],
  addressTypes: [AddressType.solana],
});

await sdk.connect({ provider: "injected" });

// Create transaction with @solana/kit
const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");
const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const userPublicKey = await sdk.solana.getPublicKey();
const transactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  tx => setTransactionMessageFeePayer(address(userPublicKey), tx),
  tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
);

const transaction = compileTransaction(transactionMessage);

// Send using chain-specific API
const result = await sdk.solana.signAndSendTransaction(transaction);
console.log("Transaction signature:", result.hash);
```

### Dapp-sponsored transactions

By default, the user's embedded wallet is the fee payer for all Solana transactions. The `presignTransaction` hook lets your app co-sign the transaction before the wallet signs it, enabling use cases like:

* **Dapp-as-fee-payer** — your app covers the transaction fee so users don't need SOL
* **Platform fees** — add a fee instruction signed by your app's keypair
* **Multi-signer flows** — any scenario where the app needs to sign alongside the user's wallet

<Warning>
  Phantom embedded wallets do not accept pre-signed transactions. If your use case requires a second signer, this hook is the only supported approach — your app's signing must happen after Phantom has constructed and validated the transaction. This restriction does not apply to injected providers (e.g. the Phantom browser extension).
</Warning>

Pass `presignTransaction` directly to `signAndSendTransaction` for the specific calls that need it. Calls without it proceed normally — the function is never applied globally.

#### Example: app as fee payer

```typescript theme={null}
import { base64urlDecode, base64urlEncode } from "@phantom/browser-sdk";
import { Keypair, VersionedTransaction } from "@solana/web3.js";

// Your app's fee payer keypair (keep this on your backend in production)
const feePayerKeypair = Keypair.fromSecretKey(/* your fee payer secret key */);

// This call co-signs as fee payer
const result = await sdk.solana.signAndSendTransaction(transaction, {
  presignTransaction: async (tx, context) => {
    // tx: base64url-encoded Solana transaction bytes
    // context: { networkId: string, walletId: string }

    // 1. Decode base64url → raw bytes
    const txBytes = base64urlDecode(tx);

    // 2. Deserialize
    const versionedTx = VersionedTransaction.deserialize(txBytes);

    // 3. Partially sign as fee payer — the user's wallet will sign next
    versionedTx.sign([feePayerKeypair]);

    // 4. Re-serialize → encode back to base64url
    return base64urlEncode(versionedTx.serialize());
  },
});

// This call has no presignTransaction — proceeds without any co-signing
const result2 = await sdk.solana.signAndSendTransaction(otherTransaction);
```

<Note>
  The hook only fires for Solana transactions via the embedded provider. EVM transactions and injected providers are unaffected.
</Note>

### Ethereum transaction examples

```typescript theme={null}
import { BrowserSDK, AddressType } from "@phantom/browser-sdk";

const sdk = new BrowserSDK({
  providers: ["injected"],
  addressTypes: [AddressType.ethereum],
});

await sdk.connect({ provider: "injected" });

// Simple ETH transfer
const result = await sdk.ethereum.sendTransaction({
  to: "0x742d35Cc6634C0532925a3b8D4C8db86fB5C4A7E",
  value: "1000000000000000000", // 1 ETH in wei
  gas: "21000",
  gasPrice: "20000000000", // 20 gwei
});

// EIP-1559 transaction with maxFeePerGas
const result2 = await sdk.ethereum.sendTransaction({
  to: "0x742d35Cc6634C0532925a3b8D4C8db86fB5C4A7E",
  value: "1000000000000000000", // 1 ETH in wei
  data: "0x...", // contract call data
  gas: "50000",
  maxFeePerGas: "30000000000", // 30 gwei
  maxPriorityFeePerGas: "2000000000", // 2 gwei
});

console.log("Transaction hash:", result.hash);
```

#### Ethereum with viem

```typescript theme={null}
import { parseEther, parseGwei, encodeFunctionData } from "viem";
import { BrowserSDK, AddressType } from "@phantom/browser-sdk";

const sdk = new BrowserSDK({
  providers: ["injected"],
  addressTypes: [AddressType.ethereum],
});

// Simple transfer with viem utilities
const result = await sdk.ethereum.sendTransaction({
  to: "0x742d35Cc6634C0532925a3b8D4C8db86fB5C4A7E",
  value: parseEther("1").toString(), // 1 ETH
  gas: "21000",
  gasPrice: parseGwei("20").toString(), // 20 gwei
});

// Contract interaction
const result2 = await sdk.ethereum.sendTransaction({
  to: tokenContractAddress,
  data: encodeFunctionData({
    abi: tokenAbi,
    functionName: "transfer",
    args: [recipientAddress, parseEther("100")],
  }),
  gas: "50000",
  maxFeePerGas: parseGwei("30").toString(),
  maxPriorityFeePerGas: parseGwei("2").toString(),
});
```

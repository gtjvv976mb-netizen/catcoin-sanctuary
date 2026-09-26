> ## Documentation Index
> Fetch the complete documentation index at: https://docs.phantom.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Transaction Validation

> Learn how Phantom uses Lighthouse assertion instructions to validate Solana transactions at runtime.

When building with Phantom, you may see transactions that include Lighthouse assertion instructions. Lighthouse is a Solana program that adds runtime checks to transactions. These checks validate onchain state and will cause the transaction to fail if conditions aren't met.

These assertions are included to ensure user safety by protecting against unexpected outcomes like simulation spoofing or malicious transaction manipulation.

## What this means for your transactions

When you submit a transaction to Phantom, it may be augmented with Lighthouse assertion instructions before being submitted to the network. This means that if you're checking transactions onchain as part of your confirmation flow, you should be aware that the transaction onchain will be different from what you originally submitted.

Additionally, these assertions can cause a transaction to fail even when it would otherwise execute successfully. For example, if a swap transaction includes an assertion checking for a specific token balance and the actual balance differs, the entire transaction will fail.

You don't need to do anything special to handle these assertions. They're included in the transaction by Phantom and are processed automatically onchain.

## Additional information

For guidance on handling transaction warnings and best practices, see [Domain and transaction warnings](/developer-powertools/domain-and-transaction-warnings).

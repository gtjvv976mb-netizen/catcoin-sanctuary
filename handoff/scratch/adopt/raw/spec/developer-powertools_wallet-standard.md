> ## Documentation Index
> Fetch the complete documentation index at: https://docs.phantom.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Wallet Standard

> Learn how Phantom implements Wallet Standard for standardized wallet-dapp interactions on Solana.

[Wallet Standard](https://github.com/wallet-standard/wallet-standard) is a chain-agnostic set of interfaces and conventions that aim to improve how applications interact with injected wallets such as Phantom. The standard was pioneered on Solana and is used as the foundation for the [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter). Phantom supports the Wallet Standard and is open to working with others to bring this innovation to other ecosystems.

Wallet Standard introduces an event-based model that:

1. Standardizes the way wallets attach themselves to the window.
2. Defines a set of standard APIs that dapps can rely upon.

At a high-level, Wallet Standard defines the following [Window interface](https://github.com/wallet-standard/wallet-standard/blob/ce280f05f6eb16d0e77939827e0b7fa294460e1f/packages/core/base/src/window.ts#L16-L25) for events:

```typescript theme={null}
export interface WalletEventsWindow extends Omit<Window, 'addEventListener' | 'dispatchEvent'> {
    /** Add a listener for {@link WindowAppReadyEvent}. */
    addEventListener(type: WindowAppReadyEventType, listener: (event: WindowAppReadyEvent) => void): void;
    /** Add a listener for {@link WindowRegisterWalletEvent}. */
    addEventListener(type: WindowRegisterWalletEventType, listener: (event: WindowRegisterWalletEvent) => void): void;
    /** Dispatch a {@link WindowAppReadyEvent}. */
    dispatchEvent(event: WindowAppReadyEvent): void;
    /** Dispatch a {@link WindowRegisterWalletEvent}. */
    dispatchEvent(event: WindowRegisterWalletEvent): void;
}
```

When a wallet is ready to inject into a website, it will [dispatch](https://github.com/wallet-standard/wallet-standard/blob/ce280f05f6eb16d0e77939827e0b7fa294460e1f/packages/core/wallet/src/register.ts#L27-L38) a `register-wallet` event and listen for an `app-ready` event. Conversely, an app will [dispatch](https://github.com/wallet-standard/wallet-standard/blob/master/packages/core/app/src/wallets.ts#L39-L50) an `app-ready` event and listen for `register-wallet` events.

## For app developers

Phantom comes with built-in support for Wallet Standard on **Solana**. To get started, simply update the [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) to the latest release. For a demo, check out the [Wallet Adapter](https://anza-xyz.github.io/wallet-adapter/example/) example.

<Warning>
  If you are migrating an existing Solana dapp to use Wallet Standard, please ensure that you are not mutating transactions in place. Failure to do so will result in a breaking change.
</Warning>

## Further reading

[Wallet Standard design document](https://github.com/wallet-standard/wallet-standard/blob/master/DESIGN.md)

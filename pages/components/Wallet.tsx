import { ConnectWallet } from "@thirdweb-dev/react";

export function Wallet() {
  return (
    <>
      <div className="wallet-connect">
        <ConnectWallet />
      </div>
    </>
  );
}
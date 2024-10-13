import { useEffect } from "react";
import { useChainId, useSwitchChain, useAddress } from "@thirdweb-dev/react";
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../const/constants';

export const useNetworkValidation = () => {
  const chainId = useChainId();
  const switchChain = useSwitchChain();
  const address = useAddress();

  useEffect(() => {
    if (address && chainId && chainId !== MAINNET_CHAIN_ID && chainId !== SEPOLIA_CHAIN_ID) {
      switchChain(MAINNET_CHAIN_ID)
      alert("Please switch to the Ethereum Mainnet or Sepolia testnet.");
    }
  }, [address, chainId, switchChain]);
};
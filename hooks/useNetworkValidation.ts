import { useEffect } from "react";
import { useChainId, useSwitchChain, useAddress } from "@thirdweb-dev/react";

const MAINNET_CHAIN_ID = 1;
const SEPOLIA_CHAIN_ID = 11155111; // Sepolia chain ID

export const useNetworkValidation = () => {
  const chainId = useChainId(); // Hook to get the current chain ID
  const switchChain = useSwitchChain(); // Hook to switch the network
  const address = useAddress(); // Hook to get the user's wallet address

  useEffect(() => {
    if (address && chainId && chainId !== MAINNET_CHAIN_ID && chainId !== SEPOLIA_CHAIN_ID) {
      switchChain(MAINNET_CHAIN_ID)
      alert("Please switch to the Ethereum Mainnet or Sepolia testnet.");
    }
  }, [address, chainId, switchChain]);
};
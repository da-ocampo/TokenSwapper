import { useEffect } from "react";
import { useChainId, useSwitchChain, useAddress } from "@thirdweb-dev/react";

const SEPOLIA_CHAIN_ID = 11155111; // Sepolia chain ID

export const useNetworkValidation = () => {
  const chainId = useChainId(); // Hook to get the current chain ID
  const switchChain = useSwitchChain(); // Hook to switch the network
  const address = useAddress(); // Hook to get the user's wallet address

  useEffect(() => {
    if (address && chainId !== SEPOLIA_CHAIN_ID) { // Check if wallet is connected and chain ID is not Sepolia
      switchChain(SEPOLIA_CHAIN_ID); // Switch to Sepolia testnet
      alert("Please switch to the Sepolia testnet.");
    }
  }, [address, chainId, switchChain]);
};
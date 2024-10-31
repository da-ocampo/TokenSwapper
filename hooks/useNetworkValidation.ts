import { useEffect } from "react";
import { useChainId, useSwitchChain, useAddress } from "@thirdweb-dev/react";
import { 
  MAINNET_CHAIN_ID, 
  SEPOLIA_CHAIN_ID, 
  LINEA_MAINNET_CHAIN_ID, 
  LINEA_TESTNET_CHAIN_ID 
} from '../const/constants';

export const useNetworkValidation = () => {
  const chainId = useChainId();
  const switchChain = useSwitchChain();
  const address = useAddress();

  useEffect(() => {
    const validChainIds = [
      MAINNET_CHAIN_ID,
      SEPOLIA_CHAIN_ID,
      LINEA_MAINNET_CHAIN_ID,
      LINEA_TESTNET_CHAIN_ID
    ];

    if (address && chainId && !validChainIds.includes(chainId)) {
      switchChain(MAINNET_CHAIN_ID);
      alert("Please switch to Ethereum Mainnet, Sepolia testnet, or Linea networks.");
    }
  }, [address, chainId, switchChain]);
};
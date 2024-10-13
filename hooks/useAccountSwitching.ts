import { useEffect } from 'react';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../const/constants';

export const useAccountSwitching = (address: string | undefined, chainId: number | undefined, disconnect: () => void, connectWithMetamask: () => void, switchChain: (chainId: number) => void) => {
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        const newAddress = accounts[0];
        if (newAddress !== address) {
          disconnect();
          connectWithMetamask();
        }
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [address, disconnect, connectWithMetamask]);

  useEffect(() => {
    if (address && chainId && chainId !== MAINNET_CHAIN_ID && chainId !== SEPOLIA_CHAIN_ID) {
      switchChain(MAINNET_CHAIN_ID);
      alert("Please switch to the Ethereum Mainnet or Sepolia testnet.");
    }
  }, [address, chainId, switchChain]);
};
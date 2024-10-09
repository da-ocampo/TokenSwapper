import React, { useCallback, useEffect, useState } from 'react';
import { Web3Button, ConnectWallet, useAddress, useContract } from '@thirdweb-dev/react';
import { ethers } from 'ethers';

interface WalletProps {
  contractAddress: string;
  swapContract: any;
}

const Wallet: React.FC<WalletProps> = ({ contractAddress, swapContract }) => {
  const address = useAddress();
  const [walletBalance, setWalletBalance] = useState<string>('0');

  const fetchWalletBalance = useCallback(async () => {
    if (swapContract && address) {
      try {
        const balance = await swapContract.call('balances', [address]);
        setWalletBalance(ethers.utils.formatEther(balance));
      } catch (error) {
        console.error('Error fetching wallet balance:', error);
        setWalletBalance('Error');
      }
    }
  }, [swapContract, address]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const handleWithdraw = async () => {
    if (!address || !swapContract || !contractAddress) {
      console.error('Wallet not connected, contract not found, or unsupported network.');
      return;
    }

    try {
      await swapContract.call('withdraw');
      fetchWalletBalance();
    } catch (error) {
      console.error('Error withdrawing:', error);
    }
  };

  return (
    <section id="wallet" style={{ textAlign: 'center', marginBottom: '1em' }}>
      <div>
        {!address && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '1em' }}>Connect Your Wallet</h3>
            <ConnectWallet />
          </div>
        )}
        {address && (
          <div>
            <h3>Wallet Balance</h3>
            <p>Your current balance: {walletBalance} ETH</p>
            <Web3Button
              className="button"
              contractAddress={contractAddress}
              action={handleWithdraw}
              isDisabled={!address || parseFloat(walletBalance) === 0}
            >
              Withdraw
            </Web3Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Wallet;
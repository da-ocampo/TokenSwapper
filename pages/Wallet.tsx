import React, { useCallback, useEffect, useState } from 'react';
import { Web3Button, ConnectWallet, useAddress } from '@thirdweb-dev/react';
import { ethers } from 'ethers';
import { parseErrorReason } from '../hooks/useHelpers';

interface WalletProps {
  contractAddress: string;
  swapContract: any;
  setFormState: (state: any) => void;
}

const Wallet: React.FC<WalletProps> = ({ contractAddress, swapContract, setFormState }) => {
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
        setFormState((prevState: any) => ({
          ...prevState,
          modalMessage: 'Error fetching wallet balance. Please try again.'
        }));
      }
    }
  }, [swapContract, address, setFormState]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const handleWithdraw = async () => {
    if (!address || !swapContract || !contractAddress) {
      setFormState((prevState: any) => ({
        ...prevState,
        modalMessage: 'Wallet not connected, contract not found, or unsupported network.'
      }));
      return;
    }

    try {
      const tx = await swapContract.call('withdraw');
      
      // Store initial balance before waiting for confirmation
      const initialBalance = walletBalance;
      
      try {
        await tx.wait();
        // Get new balance after withdrawal
        const newBalance = await swapContract.call('balances', [address]);
        const formattedNewBalance = ethers.utils.formatEther(newBalance);
        setWalletBalance(formattedNewBalance);

        if (parseFloat(formattedNewBalance) < parseFloat(initialBalance)) {
          const withdrawnAmount = parseFloat(initialBalance) - parseFloat(formattedNewBalance);
          setFormState((prevState: any) => ({
            ...prevState,
            modalMessage: `Successfully withdrawn ${withdrawnAmount.toFixed(4)} ETH to your wallet!`
          }));
        }
      } catch (waitError) {
        // Even if wait() fails, check if the balance actually changed
        const newBalance = await swapContract.call('balances', [address]);
        const formattedNewBalance = ethers.utils.formatEther(newBalance);
        setWalletBalance(formattedNewBalance);

        if (parseFloat(formattedNewBalance) < parseFloat(initialBalance)) {
          const withdrawnAmount = parseFloat(initialBalance) - parseFloat(formattedNewBalance);
          setFormState((prevState: any) => ({
            ...prevState,
            modalMessage: `Successfully withdrawn ${withdrawnAmount.toFixed(4)} ETH to your wallet!`
          }));
        } else {
          throw waitError; // Re-throw if balance didn't change
        }
      }
    } catch (error) {
      console.error('Error withdrawing:', error);
      const reason = parseErrorReason(error);
      setFormState((prevState: any) => ({
        ...prevState,
        modalMessage: `Withdrawal failed: ${reason}. Please try again.`
      }));
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
            <h3>Wallet Balance:</h3>
            <p style={{fontSize: '2em'}}>{walletBalance} ETH</p>
            <Web3Button
              className="button"
              contractAddress={contractAddress}
              action={handleWithdraw}
              isDisabled={!address || parseFloat(walletBalance) === 0}
            >
              Withdraw
            </Web3Button>
            <p style={{ fontSize: '0.85em', fontStyle: 'italic', padding: '2em 0 0 0', color: 'rgba(0, 0, 0, 0.7)' }}>This page shows your current balance of ETH stored in the P2PSwap contract. When a swap involving ETH is completed, 
            the ETH portion is stored here until you withdraw it. You can withdraw your balance at any time by clicking the button above.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Wallet;
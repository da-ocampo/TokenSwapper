import { NextPage } from 'next';
import { useAddress, useContract, useDisconnect, useMetamask, useChainId } from '@thirdweb-dev/react';
import { useState, useEffect } from 'react';
import { MAINNET_CONTRACT_ADDRESS, SEPOLIA_CONTRACT_ADDRESS } from '../const/addresses';
import Modal from './components/Modal';
import Swapper from './Swapper';
import styles from '../styles/Home.module.css';
import { useNetworkValidation } from "../hooks/useNetworkValidation";

// Define chain IDs
const MAINNET_CHAIN_ID = 1;
const SEPOLIA_CHAIN_ID = 11155111;

const Home: NextPage = () => {
  useNetworkValidation();
  const address = useAddress();
  const disconnect = useDisconnect();
  const connectWithMetamask = useMetamask();
  const chainId = useChainId();
  
  const [contractAddress, setContractAddress] = useState(MAINNET_CONTRACT_ADDRESS);
  const { contract, isLoading, error } = useContract(contractAddress);
  
  const [walletConnected, setWalletConnected] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [networkMessage, setNetworkMessage] = useState<string | null>(null);

  useEffect(() => {
    if (chainId === SEPOLIA_CHAIN_ID) {
      setContractAddress(SEPOLIA_CONTRACT_ADDRESS);
    } else {
      setContractAddress(MAINNET_CONTRACT_ADDRESS);
    }
  }, [chainId]);

  useEffect(() => {
    const checkStatus = async () => {
      if (!address || !contract) {
        setWalletConnected(false);
        return;
      }
      try {
        setWalletConnected(true);
      } catch (error) {
        console.error('Error checking status:', error);
        setWalletConnected(false);
      }
    };
    if (!isLoading && !error) {
      checkStatus();
    }
  }, [address, contract, isLoading, error]);

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
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [address, disconnect, connectWithMetamask]);

  const closeModal = () => setSuccessMessage(null);

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className="guide">
          <main>
            <section>
              <div>
                <div className={styles.swapContent}>
                  <Swapper />
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
      {successMessage && <Modal message={successMessage} onClose={closeModal} />}
    </div>
  );
};

export default Home;
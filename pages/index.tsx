import { NextPage } from 'next';
import { useAddress, useContract, useDisconnect } from '@thirdweb-dev/react';
import { useState, useEffect } from 'react';
import { CONTRACT_ADDRESS } from '../const/addresses';
import Modal from './components/Modal';
import Swapper from './Swapper';
import styles from '../styles/Home.module.css';
import { useNetworkValidation } from "../hooks/useNetworkValidation";

const Home: NextPage = () => {
  useNetworkValidation();

  const address = useAddress();
  const disconnect = useDisconnect();
  const { contract, isLoading, error } = useContract(CONTRACT_ADDRESS);
  const [walletConnected, setWalletConnected] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      if (!address || !contract) {
        setWalletConnected(false);
        localStorage.removeItem('walletConnected');
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

  const closeModal = () => setSuccessMessage(null);

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className="guide">
          <main>
            <section>
              <div id="exchange">
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
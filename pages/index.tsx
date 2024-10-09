import { NextPage } from 'next';
import { useAddress, useDisconnect, useMetamask } from '@thirdweb-dev/react';
import { useEffect } from 'react';
import Swapper from './Swapper';
import styles from '../styles/Home.module.css';
import { useNetworkValidation } from "../hooks/useNetworkValidation";

const Home: NextPage = () => {
  useNetworkValidation();
  const address = useAddress();
  const disconnect = useDisconnect();
  const connectWithMetamask = useMetamask();

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

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className="app-box">
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
    </div>
  );
};

export default Home;
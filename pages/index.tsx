import { NextPage } from 'next';
import { useAddress, useDisconnect, useMetamask, useChainId, useSwitchChain } from '@thirdweb-dev/react';
import Swapper from './Swapper';
import styles from '../styles/Home.module.css';
import { useAccountSwitching } from '../hooks/useAccountSwitching';

const Home: NextPage = () => {
  const address = useAddress();
  const disconnect = useDisconnect();
  const connectWithMetamask = useMetamask();
  const chainId = useChainId();
  const switchChain = useSwitchChain();

  useAccountSwitching(address, chainId, disconnect, connectWithMetamask, switchChain);

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
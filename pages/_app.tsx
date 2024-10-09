import type { AppProps } from "next/app";
import { ThirdwebProvider } from '@thirdweb-dev/react';
import '../styles/globals.css';
import Head from "next/head";
import { useState, useEffect } from 'react';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../const/constants';


function MyApp({ Component, pageProps }: AppProps) {
  const [activeChain, setActiveChain] = useState<number>(MAINNET_CHAIN_ID);

  useEffect(() => {
    const handleChainChanged = (chainId: string) => {
      const newChainId = parseInt(chainId, 16);
      setActiveChain(newChainId === SEPOLIA_CHAIN_ID ? SEPOLIA_CHAIN_ID : MAINNET_CHAIN_ID);
    };

    const init = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          handleChainChanged(chainId);
          window.ethereum.on('chainChanged', handleChainChanged);
        } catch (error) {
          console.error("Failed to initialize chain:", error);
        }
      }
    };

    init();

    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  return (
    <ThirdwebProvider
      clientId={process.env.NEXT_PUBLIC_TEMPLATE_CLIENT_ID}
      activeChain={activeChain}
    >
      <Head>
        <title>Token Swapper</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Token Swapper Application" />
      </Head>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}

export default MyApp;
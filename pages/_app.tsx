import type { AppProps } from "next/app";
import { ThirdwebProvider } from '@thirdweb-dev/react';
import '../styles/globals.css';
import Head from "next/head";
import { useState, useEffect } from 'react';

// Define chain IDs
const MAINNET_CHAIN_ID = 1;
const SEPOLIA_CHAIN_ID = 11155111;

function MyApp({ Component, pageProps }: AppProps) {
  const [activeChain, setActiveChain] = useState<number>(MAINNET_CHAIN_ID);

  useEffect(() => {
    const handleChainChanged = (chainId: string) => {
      const newChainId = parseInt(chainId, 16);
      if (newChainId === SEPOLIA_CHAIN_ID) {
        setActiveChain(SEPOLIA_CHAIN_ID);
      } else {
        // Default to Mainnet for any other chain
        setActiveChain(MAINNET_CHAIN_ID);
      }
    };

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_chainId' }).then(handleChainChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

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
      </Head>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}

export default MyApp;
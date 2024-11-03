import type { AppProps } from "next/app";
import { ThirdwebProvider } from '@thirdweb-dev/react';
import { Sepolia, Ethereum, Chain } from "@thirdweb-dev/chains";
import '../styles/globals.css';
import Head from "next/head";
import { useState, useEffect } from 'react';
import { 
  MAINNET_CHAIN_ID, 
  SEPOLIA_CHAIN_ID,
  LINEA_MAINNET_CHAIN_ID,
  LINEA_TESTNET_CHAIN_ID 
} from '../const/constants';

const LineaMainnet: Chain = {
  chainId: LINEA_MAINNET_CHAIN_ID,
  rpc: ["https://rpc.linea.build"],
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  shortName: "linea",
  slug: "linea",
  testnet: false,
  chain: "Linea",
  name: "Linea Mainnet"
};

const LineaTestnet: Chain = {
  chainId: LINEA_TESTNET_CHAIN_ID,
  rpc: ["https://rpc.sepolia.linea.build"],
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  shortName: "linea-testnet",
  slug: "linea-testnet",
  testnet: true,
  chain: "Linea",
  name: "Linea Testnet"
};

function MyApp({ Component, pageProps }: AppProps) {
  const [activeChain, setActiveChain] = useState<number>(MAINNET_CHAIN_ID);

  useEffect(() => {
    const handleChainChanged = (chainId: string) => {
      const newChainId = parseInt(chainId, 16);
      const validChains = [MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID, LINEA_MAINNET_CHAIN_ID, LINEA_TESTNET_CHAIN_ID];
      if (validChains.includes(newChainId)) {
        setActiveChain(newChainId);
      } else {
        setActiveChain(MAINNET_CHAIN_ID);
      }
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
      supportedChains={[
        Ethereum,
        Sepolia,
        LineaMainnet,
        LineaTestnet
      ]}
    >
      <Head>
        <title>P2PSwap</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Token Swapper Application" />
      </Head>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}

export default MyApp;
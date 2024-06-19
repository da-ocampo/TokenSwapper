import { AppProps } from 'next/app';
import { ThirdwebProvider } from '@thirdweb-dev/react';
import { clientKey } from '../const/addresses';
import '../styles/globals.css';
import Head from "next/head";

const activeChain = 'sepolia';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThirdwebProvider clientId={clientKey} activeChain={activeChain}>
      <Head>
        <title>Token Swapper</title>
      </Head>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}

export default MyApp;
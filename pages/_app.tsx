import type { AppProps } from "next/app";
import { ThirdwebProvider } from '@thirdweb-dev/react';
import '../styles/globals.css';
import Head from "next/head";

const activeChain = 'sepolia';

function MyApp({ Component, pageProps }: AppProps) {
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
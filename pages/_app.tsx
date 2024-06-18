import { AppProps } from 'next/app';
import { ThirdwebProvider } from '@thirdweb-dev/react';
import { clientKey } from '../const/addresses';
import '../styles/globals.css';

const activeChain = 'sepolia';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThirdwebProvider clientId={clientKey} activeChain={activeChain}>
      <Component {...pageProps} />
    </ThirdwebProvider>
  );
}

export default MyApp;
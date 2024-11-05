import React from 'react';
import { 
  MAINNET_CHAIN_ID, 
  SEPOLIA_CHAIN_ID,
  LINEA_MAINNET_CHAIN_ID,
  LINEA_TESTNET_CHAIN_ID 
} from '../../const/constants';

interface HeaderProps {
  address: string | undefined;
  currentPage: 'initSwap' | 'swapList' | 'wallet' | 'disclaimer' | 'privacy' | 'swapInfo';
  setCurrentPage: (page: 'initSwap' | 'swapList' | 'wallet' | 'disclaimer' | 'swapInfo') => void;
  chainId: number | undefined;
}

const Header: React.FC<HeaderProps> = ({
  address,
  currentPage,
  setCurrentPage,
  chainId
}) => {
  return (
    <header className="header">
      <div className="title">
        <a href="#">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>P2PSwap</h1>
        </a>
      </div>

      {address && (
        <nav className="navbar" style={{ display: 'flex', alignItems: 'center', flex: '1 1 auto' }}>
          <ul className="navList" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1.25rem',
            margin: 0,
            padding: 0
          }}>
            <li className="navItem" style={{ margin: 0 }}>
              <a
                className={`toggle-button ${currentPage === 'swapList' ? 'active' : ''}`}
                onClick={() => setCurrentPage('swapList')}
                style={{ 
                  opacity: currentPage === 'swapList' ? 1 : 0.7,
                  padding: '0.5rem',
                  fontSize: '1rem'
                }}
              >
                Swaps
              </a>
            </li>
            <li className="navItem" style={{ margin: 0 }}>
              <a
                className={`toggle-button ${currentPage === 'wallet' ? 'active' : ''}`}
                onClick={() => setCurrentPage('wallet')}
                style={{ 
                  opacity: currentPage === 'wallet' ? 1 : 0.7,
                  padding: '0.5rem',
                  fontSize: '1rem'
                }}
              >
                Wallet
              </a>
            </li>
            <li className="navItem" style={{ margin: 0 }}>
              <a
                className={`button ${currentPage === 'initSwap' ? 'active' : ''}`}
                onClick={() => setCurrentPage('initSwap')}
                style={{ 
                  background: '#f5f6fd',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  color: currentPage === 'initSwap' ? '#000' : '#666',
                  fontSize: '1rem'
                }}
              >
                Start New Swap
              </a>
            </li>
          </ul>
        </nav>
      )}

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        marginLeft: 'auto',
        fontSize: '0.95rem'
      }}>
        {address ? (
          <>
            <span className="wallet-address" style={{ opacity: 0.7, fontWeight: "bold"}}>
              {address.substring(0, 6)}...{address.substring(address.length - 4)}
            </span>
            <span className="network-info" style={{ opacity: 0.7 }}>
              {chainId === MAINNET_CHAIN_ID ? 'Ethereum Mainnet' : 
               chainId === SEPOLIA_CHAIN_ID ? 'Sepolia Testnet' : 
               chainId === LINEA_MAINNET_CHAIN_ID ? 'Linea Mainnet' :
               chainId === LINEA_TESTNET_CHAIN_ID ? 'Linea Sepolia' :
               'Unsupported Network'}
            </span>
          </>
        ) : (
          <div></div>
        )}
      </div>
    </header>
  );
};

export default Header;
import React from 'react';

interface FooterProps {
  setCurrentPage: (page: 'initSwap' | 'swapList' | 'wallet' | 'disclaimer' | 'privacy') => void;
}

const Footer: React.FC<FooterProps> = ({ setCurrentPage }) => {
  return (
    <footer className="footer">
      <div className="footerContainer" style={{marginBottom: "1em"}}>
        <div className="textCenter">
          <a
            onClick={() => setCurrentPage('swapInfo')}
            className="toggle-button"
            style={{padding: ".5em"}}
          >
            More info on swapping
          </a>
          <span style={{ opacity: 0.5 }}>| </span>
          <a
            onClick={() => setCurrentPage('disclaimer')}
            className="toggle-button"
            style={{padding: '0.5em 0.5em 0.5em 0'}}
          >
            Terms of Use
          </a>
          <span style={{ opacity: 0.5 }}>|</span>
          <a
            onClick={() => setCurrentPage('privacy')}
            className="toggle-button"
            style={{padding: ".5em"}}
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
import React from 'react';

interface FooterProps {
  setCurrentPage: (page: 'initSwap' | 'swapList' | 'wallet' | 'disclaimer' | 'privacy') => void;
}

const Footer: React.FC<FooterProps> = ({ setCurrentPage }) => {
  return (
    <footer className="footer">
      <div className="footerContainer" style={{marginBottom: "2em"}}>
        <div className="textCenter">
          <a
            onClick={() => setCurrentPage('disclaimer')}
            className="toggle-button"
            style={{paddingLeft: "0"}}
          >
            Disclaimer/Terms of Use
          </a>
          <span style={{ opacity: 0.5 }}>|</span>
          <a
            onClick={() => setCurrentPage('privacy')}
            className="toggle-button"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
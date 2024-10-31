import React from 'react';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footerContainer">
        <div className="textCenter">
          <Link href="#" passHref legacyBehavior>
            <a className="text-black mr-2 lg:mr-8 xl:mr-8 hover:underline">
              <span className='text-base'>Privacy Policy</span>
            </a>
          </Link>
          <span className="text-gray-200">|</span>
          <Link href="#" passHref legacyBehavior>
            <a className="text-black ml-2 lg:ml-8 xl:ml-8 hover:underline">
              <span className='text-base'>Terms of Service</span>
            </a>
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
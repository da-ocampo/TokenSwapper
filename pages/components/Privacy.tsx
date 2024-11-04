import React from 'react';

const Privacy = () => {
  return (
    <section style={{ textAlign: 'left', padding: '1em' }}>
      <h2 style={{ marginBottom: '1em', color: '#000' }}>Privacy Policy</h2>
      <p style={{ marginBottom: '1em' }}>
        Effective: 2024-11-05
      </p>
      <p style={{ marginBottom: '1em' }}>
        This Privacy Policy explains how we handle your information when you use our website and smart contracts. 
        We are committed to protecting your privacy and ensuring a safe, transparent experience for all users.
      </p>
      
      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>1. Tracking of Personal Information</h3>
      <p style={{ marginBottom: '1em' }}>
        Our developers and operators do not collect, track, or store any personally identifiable information (PII) 
        about users. We value your privacy and have designed our site and smart contracts to require only the minimal 
        information necessary for their operation. Specifically:
      </p>
      <ul style={{ marginLeft: '2em', marginBottom: '1em' }}>
        <li>We do not use any cookies, analytics, or tracking technologies that could identify, track, or profile users.</li>
        <li>We do not share any data with third parties, advertisers, or data brokers.</li>
      </ul>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>2. Limited Use of Information</h3>
      <p style={{ marginBottom: '1em' }}>
        We use only the information necessary to operate the site and smart contracts effectively. This may include:
      </p>
      <ul style={{ marginLeft: '2em', marginBottom: '1em' }}>
        <li>Basic transaction data essential for processing on the blockchain.</li>
        <li>Temporary data stored in your browser's local storage to enhance your experience, which is not accessible to our servers.</li>
      </ul>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>3. Third-Party Wallet and Blockchain Provider Data</h3>
      <p style={{ marginBottom: '1em' }}>
        We do not control, access, or use any information submitted through your chosen wallet or blockchain provider, 
        except for the minimal data required to ensure the application's functionality. Any interactions with the blockchain 
        (e.g., transactions, balances, account information) are handled solely through your blockchain provider or wallet. 
        Your relationship with your wallet and blockchain provider is governed by their respective privacy policies and 
        terms of service.
      </p>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>4. Changes to This Policy</h3>
      <p style={{ marginBottom: '1em' }}>
        We may update this Privacy Policy from time to time to reflect legal or operational requirements. Changes will be 
        posted on this page, and we encourage you to review it periodically.
      </p>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>5. Contact Us</h3>
      <p style={{ marginBottom: '1em' }}>
        Please contact us at <a href="https://github.com/thedarkjester/p2pswap" style={{ color: '#6382FF' }}>
        https://github.com/thedarkjester/p2pswap</a> for issues or concerns.
      </p>
    </section>
  );
};

export default Privacy;
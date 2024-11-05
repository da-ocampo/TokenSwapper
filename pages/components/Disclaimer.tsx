import React from 'react';

const Disclaimer = () => {
  return (
    <section style={{ textAlign: 'left', padding: '1em' }}>
      <h2 style={{ marginBottom: '1em', color: '#000' }}>Disclaimer</h2>
      <p style={{ marginBottom: '1em' }}>
        By using this site, its services, and the associated smart contracts, you acknowledge and agree to the following:
      </p>
      <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5em' }}>
        <li style={{ marginBottom: '1em' }}>
          <strong>No Liability</strong>: The developers of this site, the smart contracts, and any related hosting providers 
          shall not be held liable for any losses, damages, or any negative consequences arising from your use of this 
          platform or the associated smart contracts. This includes, but is not limited to, financial losses, technical 
          issues, errors, or security breaches.
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>User Responsibility</strong>: You are solely responsible for verifying the accuracy of all transaction 
          details prior to any interaction and at the time of transaction submission. This includes, but is not limited 
          to, verifying amounts, including correct decimal placement, and confirming that the contract addresses you are 
          interacting with are the intended and correct addresses. It is your responsibility to check this information 
          before signing and submitting any transaction.
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>Risks</strong>: Blockchain technology, cryptocurrency transactions, and peer-to-peer swapping involve 
          inherent risks. By using this site and its services, you acknowledge that you fully understand these risks 
          and agree to assume them independently.
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>No Guarantees</strong>: The services provided are available &ldquo;as-is&rdquo; without any warranties or 
          guarantees. The developers make no promises regarding the accuracy, reliability, or security of the smart 
          contracts, the site, or any of the services.
        </li>
      </ol>
      <p>
        By proceeding, you accept and agree to all of the above terms and assume full responsibility for any actions 
        taken on this platform. Use of this platform constitutes acceptance of this disclaimer.
      </p>
    </section>
  );
};

export default Disclaimer;
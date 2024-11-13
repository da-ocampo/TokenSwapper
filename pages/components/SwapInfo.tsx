import React from 'react';

const SwapInfo = () => {
  return (
    <section style={{ textAlign: 'left', padding: '1em' }}>
      <h2 style={{ marginBottom: '1em', color: '#000' }}>P2PSwap Information</h2>
      
      <p style={{ marginBottom: '1em' }}>
        This guide explains how the Token Swapper works and how to use it effectively for peer-to-peer token exchanges.
      </p>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>1. What is the Token Swapper?</h3>
      <p style={{ marginBottom: '1em' }}>
        Token Swapper enables direct peer-to-peer token exchanges with the security of an impartial escrow contract. 
        Two parties (the initiator &quot;pI&quot; and the acceptor &quot;pA&quot;) who want to swap tokens can do so safely without requiring 
        trust between parties. These participants typically connect through various communities like Discord, X (Twitter), 
        or Farcaster to arrange their swaps.
      </p>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>2. Supported Swap Types</h3>
      <p style={{ marginBottom: '0.5em' }}>
        The platform supports the following types of swaps:
      </p>
      <ul style={{ marginLeft: '2em', marginBottom: '1em' }}>
        <li>Sell ERC20s (including variants like 777, xERC20) for ETH</li>
        <li>Swap ERC20s for other ERC20s, an ERC721, or ERC1155 tokens</li>
        <li>Sell an ERC721 for ETH</li>
        <li>Swap ERC721s for ERC20s, another ERC721, or ERC1155 tokens</li>
        <li>Sell one or more ERC1155 for ETH</li>
        <li>Swap ERC1155 tokens for ERC20s, an ERC721, or other ERC1155 tokens</li>
      </ul>
      <p style={{ marginBottom: '1em', fontStyle: 'italic' }}>
        Note: All token swaps can optionally include ETH on either side. For example: A Pudgy Penguin for 3000 DAI and 
        1 ETH, or 10 ERC1155 tokens (Id=1) and 0.5 ETH for a Lazy Lion.
      </p>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>3. Key Features</h3>
      <ul style={{ marginLeft: '2em', marginBottom: '1em' }}>
        <li>No fees or commission charged on any swaps or sales</li>
        <li>Non-upgradeable contract with no owner privileges</li>
        <li>Fully decentralized with no intermediaries</li>
        <li>Secure escrow-based swapping mechanism</li>
      </ul>

      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>4. Swap Process</h3>
      <p style={{ marginBottom: '0.5em', color: '#FF3B30', fontWeight: 'bold' }}>
        Important: Initiators can always retrieve their ETH and cancel the swap if the acceptor hasn&apos;t completed it.
      </p>
      <ol style={{ marginLeft: '2em', marginBottom: '1em' }}>
        <li style={{ marginBottom: '1em' }}>
          <strong>Initiation</strong>: The initiator creates the swap by providing:
          <ul style={{ marginLeft: '2em', marginTop: '0.5em' }}>
            <li>Future expiry date</li>
            <li>Their token details (contract, type, ID, quantity)</li>
            <li>Desired token details (contract, type, ID, quantity)</li>
            <li>Acceptor&apos;s address (optional for non-NFT swaps)</li>
            <li>Any ETH additions from either side</li>
          </ul>
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>Verification</strong>: Both parties verify token details and collection information
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>Approval</strong>: Both parties must approve the Token Swapper contract to handle their tokens
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>Pre-acceptance Checks</strong>: Acceptor verifies:
          <ul style={{ marginLeft: '2em', marginTop: '0.5em' }}>
            <li>Current token ownership by both parties</li>
            <li>Contract approvals are in place</li>
            <li>All swap details are correct</li>
          </ul>
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>Completion</strong>: Acceptor completes the swap, including any required ETH
        </li>
        <li style={{ marginBottom: '1em' }}>
          <strong>ETH Withdrawal</strong>: Parties can withdraw their ETH portions at their convenience
        </li>
      </ol>
      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>5. Contract Github Repository</h3>
      <p style={{ marginBottom: '0.5em' }}><a href='https://github.com/thedarkjester/P2PSwap' target='_blank'>View on Github</a></p>
      <h3 style={{ marginTop: '1.5em', marginBottom: '0.5em' }}>6. Verified Contracts</h3>
      <p style={{ marginBottom: '0.5em' }}>Ethereum Network:</p>
      <ul style={{ listStyleType: 'none', marginBottom: '1em', marginLeft: '2em' }}>
        <li>Mainnet: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px' }}><a href='https://etherscan.io/address/0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db' target='_blank'>0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db</a></code></li>
        <li>Sepolia: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px' }}><a href='https://sepolia.etherscan.io/address/0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db' target='_blank'>0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db</a></code></li>
      </ul>
      <p style={{ marginBottom: '0.5em' }}>Linea Network:</p>
      <ul style={{ listStyleType: 'none', marginBottom: '1em', marginLeft: '2em' }}>
        <li>Mainnet: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px' }}><a href='https://lineascan.build/address/0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db' target='_blank'>0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db</a></code></li>
        <li>Sepolia: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px' }}><a href='https://sepolia.lineascan.build/address/0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db' target='_blank'>0x2c8AD0Ac6CA91b3A2650bEf877d2d133Ef13d8db</a></code></li>
      </ul>
    </section>
  );
};

export default SwapInfo;
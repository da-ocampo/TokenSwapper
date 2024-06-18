import { NextPage } from 'next';
import { Web3Button, useAddress, useContract } from '@thirdweb-dev/react';
import { useState, useEffect, useCallback } from 'react';
import { CONTRACT_ADDRESS } from '../const/addresses';
import { Wallet } from './components/Wallet';
import styles from '../styles/Home.module.css';
import Modal from './components/Modal';
import { BigNumber, ethers } from 'ethers';

const tokenTypeMap: { [key: string]: number } = {
  NONE: 0,
  ERC20: 1,
  ERC721: 2,
  ERC1155: 3,
};

const Swapper: NextPage = () => {
  const address = useAddress();
  const { contract: swapContract } = useContract(CONTRACT_ADDRESS);
  const [initiatorTokenId, setInitiatorTokenId] = useState('');
  const [acceptorTokenId, setAcceptorTokenId] = useState('');
  const [acceptorAddress, setAcceptorAddress] = useState('');
  const [swapId, setSwapId] = useState<number | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [initiatorTokenType, setInitiatorTokenType] = useState('NONE');
  const [initiatorERCContract, setInitiatorERCContract] = useState('');
  const [initiatorTokenQuantity, setInitiatorTokenQuantity] = useState('');
  const [initiatorETHPortion, setInitiatorETHPortion] = useState('');
  const [acceptorTokenType, setAcceptorTokenType] = useState('NONE');
  const [acceptorERCContract, setAcceptorERCContract] = useState('');
  const [acceptorTokenQuantity, setAcceptorTokenQuantity] = useState('');
  const [acceptorETHPortion, setAcceptorETHPortion] = useState('');
  const [initiatedTransactions, setInitiatedTransactions] = useState<any[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<any[]>([]);
  const [swapAvailable, setSwapAvailable] = useState<boolean>(false);
  const [approveContractAddress, setApproveContractAddress] = useState('');
  const [approveTokenId, setApproveTokenId] = useState('');
  const { contract: approveContract } = useContract(approveContractAddress);

  useEffect(() => {
    if (swapId !== null) {
      setModalMessage(`Exchange successfully initiated! Your Swap ID is ${swapId}`);
    }
  }, [swapId]);

  const fetchTransactions = useCallback(async () => {
    if (swapContract) {
      try {
        const events = await swapContract.events.getAllEvents();
        const swapInitiatedEvents = events.filter(event => event.eventName === 'SwapInitiated');
        const swapRemovedEvents = events.filter(event => event.eventName === 'SwapRemoved');
        const swapCompletedEvents = events.filter(event => event.eventName === 'SwapCompleted');

        const removedSwapIds = new Set(swapRemovedEvents.map(event => event.data.swapId.toString()));
        const completedSwapIds = new Set(swapCompletedEvents.map(event => event.data.swapId.toString()));

        const filteredInitiatedEvents = swapInitiatedEvents.filter(event =>
          !removedSwapIds.has(event.data.swapId.toString()) && !completedSwapIds.has(event.data.swapId.toString())
        );

        setInitiatedTransactions(filteredInitiatedEvents);
        setCompletedTransactions(swapCompletedEvents);

        const walletAssociated = filteredInitiatedEvents.some(event =>
          event.data.swap.initiator === address || event.data.swap.acceptor === address
        );
        setSwapAvailable(walletAssociated);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setModalMessage('Error fetching transactions. Please try again.');
      }
    }
  }, [swapContract, address]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const mapTokenTypeToEnum = (tokenType: string): number => tokenTypeMap[tokenType] || 0;

  const parseSwapData = (data: any[]): any[] => data.map(value => {
    if (typeof value === 'string' && value.startsWith('0x')) return value;
    if (BigNumber.isBigNumber(value)) return value.toNumber();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseInt(value, 10);
    return value;
  });

  const handleSwap = async () => {
    if (!address || !swapContract) {
      setModalMessage('Wallet not connected or contract not found.');
      return;
    }

    if (!initiatorTokenId || !acceptorTokenId || !acceptorAddress) {
      setModalMessage('Please fill in all required fields.');
      return;
    }

    try {
      const tx = await swapContract.call('initiateSwap', [
        {
          initiator: address,
          acceptor: acceptorAddress,
          initiatorTokenType: mapTokenTypeToEnum(initiatorTokenType),
          initiatorERCContract,
          initiatorTokenId: parseInt(initiatorTokenId) || 0,
          initiatorTokenQuantity: parseInt(initiatorTokenQuantity) || 0,
          initiatorETHPortion: parseFloat(initiatorETHPortion) || 0,
          acceptorTokenType: mapTokenTypeToEnum(acceptorTokenType),
          acceptorERCContract,
          acceptorTokenId: parseInt(acceptorTokenId) || 0,
          acceptorTokenQuantity: parseInt(acceptorTokenQuantity) || 0,
          acceptorETHPortion: parseFloat(acceptorETHPortion) || 0,
        },
      ]);

      const receipt = tx.receipt;
      const swapIdHex = receipt?.logs?.[0]?.topics?.[1];
      if (swapIdHex) {
        setSwapId(parseInt(swapIdHex, 16));
      } else {
        throw new Error('Swap ID not found in receipt');
      }
    } catch (error) {
      console.error('Error initiating exchange:', error);
      setModalMessage('Error initiating exchange. Please try again.');
    }
  };

  const handleCompleteSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract) {
      setModalMessage('Wallet not connected or contract not found.');
      return;
    }

    try {
      const parsedData = parseSwapData(swapData);
      const ethPortion = parseFloat(swapData.acceptorETHPortion) || 0;

      await swapContract.call('completeSwap', [swapId, parsedData], {
        value: ethers.utils.parseEther(ethPortion.toString())
      });

      setModalMessage(`Swap with ID ${swapId} has been completed.`);
      setInitiatedTransactions(prevTransactions => prevTransactions.filter(tx => tx.data.swapId.toString() !== swapId.toString()));
    } catch (error) {
      console.error('Error completing swap:', error);
      setModalMessage('Error completing swap. Please try again.');
    }
  };

  const handleRemoveSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract) {
      setModalMessage('Wallet not connected or contract not found.');
      return;
    }

    try {
      const parsedData = parseSwapData(swapData);
      await swapContract.call('removeSwap', [swapId, parsedData]);
      setModalMessage(`Swap with ID ${swapId} has been removed.`);
      setInitiatedTransactions(prevTransactions => prevTransactions.filter(tx => tx.data.swapId.toString() !== swapId.toString()));
    } catch (error) {
      console.error('Error removing swap:', error);
      setModalMessage('Error removing swap. Please try again.');
    }
  };

  const handleApprove = async () => {
    if (!address || !approveContract) {
      setModalMessage('Wallet not connected or approval contract not found.');
      return;
    }

    if (!approveContractAddress || !approveTokenId) {
      setModalMessage('Please fill in all required fields.');
      return;
    }

    try {
      const receipt = await approveContract.call('approve', [CONTRACT_ADDRESS, parseInt(approveTokenId)]);
      console.log('Token approval receipt:', receipt);
      setModalMessage('Approval successful!');
    } catch (error) {
      console.error('Error approving token:', error);
      setModalMessage('Error approving token. Please try again.');
    }
  };

  const closeModal = () => setModalMessage(null);

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className="guide-grid">
          <div className="guide-left">
            <h3>What is the Token Swapper?</h3>
            <p>The Token Swapper app facilitates secure token exchanges between two parties using an impartial escrow contract. Here's how it works:</p>
            <h4>Participants:</h4>
            <p><strong>Initiator (pI):</strong> The person initiating the swap.</p>
            <p><strong>Acceptor (pA):</strong> The person accepting the swap.</p>
            <h4>Swap Types:</h4>
            <ul>
              <li>Sell ERC20 for ETH</li>
              <li>Swap ERC20</li>
              <li>Sell ERC721 for ETH</li>
              <li>Swap ERC721</li>
              <li>Sell ERC1155 for ETH</li>
              <li>Swap ERC1155</li>
            </ul>
            <h4>Process:</h4>
            <ol>
              <li><strong>Initiate Swap:</strong> pI provides swap details like token types, contract addresses, token IDs, quantities, and optional ETH portions.</li>
              <li><strong>Approve Tokens:</strong> Both pI and pA approve the Token Swapper contract on their respective token contracts.</li>
              <li><strong>Complete Swap:</strong> pA accepts the swap by verifying terms and sending any required ETH. Upon acceptance, tokens and ETH (if any) are exchanged.</li>
            </ol>
            <h4>Key Features:</h4>
            <ul>
              <li><strong>No Fees:</strong> The app does not charge any fees or commissions.</li>
              <li><strong>Non-upgradable:</strong> The contract is immutable and has no owner, ensuring trust and security.</li>
              <li><strong>ETH Withdrawal:</strong> ETH involved in swaps can be withdrawn by the respective parties post-swap.</li>
            </ul>
            <h4>Important Functions:</h4>
            <ul>
              <li><strong>initiateSwap:</strong> Sets up the swap with provided details.</li>
              <li><strong>removeSwap:</strong> Allows pI to cancel the swap and retrieve any sent ETH.</li>
              <li><strong>completeSwap:</strong> Completes the swap upon pA's acceptance.</li>
            </ul>
          </div>
          <div className="guide-right">
            <div>
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Approve Token</h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                <input
                  type="text"
                  placeholder="Token Contract Address"
                  value={approveContractAddress}
                  onChange={(e) => setApproveContractAddress(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Token ID"
                  value={approveTokenId}
                  onChange={(e) => setApproveTokenId(e.target.value)}
                />
                <Web3Button
                  className="button"
                  contractAddress={approveContractAddress}
                  action={handleApprove}
                  isDisabled={!address || !approveContract}
                >
                  Approve Token
                </Web3Button>
              </div>
            </div>
            <div>
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Exchange Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                <input
                  type="text"
                  placeholder="Your Token ID"
                  value={initiatorTokenId}
                  onChange={(e) => setInitiatorTokenId(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Acceptor's Token ID"
                  value={acceptorTokenId}
                  onChange={(e) => setAcceptorTokenId(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Acceptor's Wallet Address"
                  value={acceptorAddress}
                  onChange={(e) => setAcceptorAddress(e.target.value)}
                />
                <select value={initiatorTokenType} onChange={(e) => setInitiatorTokenType(e.target.value)}>
                  <option value="NONE">None</option>
                  <option value="ERC20">ERC20</option>
                  <option value="ERC721">ERC721</option>
                  <option value="ERC1155">ERC1155</option>
                </select>
                {initiatorTokenType !== 'NONE' && (
                  <>
                    <input
                      type="text"
                      placeholder="Initiator's Token Contract Address"
                      value={initiatorERCContract}
                      onChange={(e) => setInitiatorERCContract(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Initiator's Token Quantity"
                      value={initiatorTokenQuantity}
                      onChange={(e) => setInitiatorTokenQuantity(e.target.value)}
                    />
                  </>
                )}
                <input
                  type="text"
                  placeholder="Initiator's ETH Portion"
                  value={initiatorETHPortion}
                  onChange={(e) => setInitiatorETHPortion(e.target.value)}
                />
                <select value={acceptorTokenType} onChange={(e) => setAcceptorTokenType(e.target.value)}>
                  <option value="NONE">None</option>
                  <option value="ERC20">ERC20</option>
                  <option value="ERC721">ERC721</option>
                  <option value="ERC1155">ERC1155</option>
                </select>
                {acceptorTokenType !== 'NONE' && (
                  <>
                    <input
                      type="text"
                      placeholder="Acceptor's Token Contract Address"
                      value={acceptorERCContract}
                      onChange={(e) => setAcceptorERCContract(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Acceptor's Token Quantity"
                      value={acceptorTokenQuantity}
                      onChange={(e) => setAcceptorTokenQuantity(e.target.value)}
                    />
                  </>
                )}
                <input
                  type="text"
                  placeholder="Acceptor's ETH Portion"
                  value={acceptorETHPortion}
                  onChange={(e) => setAcceptorETHPortion(e.target.value)}
                />
                <Web3Button
                  className="button"
                  contractAddress={CONTRACT_ADDRESS}
                  action={handleSwap}
                  isDisabled={!address}
                >
                  Initiate Exchange
                </Web3Button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              {swapAvailable && (
                <div className={styles.transactions}>
                  <h3>Available Swaps</h3>
                  {initiatedTransactions.length === 0 ? (
                    <p>No transactions found.</p>
                  ) : (
                    <div className={styles.swapContainer}>
                      {initiatedTransactions.map((tx, index) => (
                        <div key={index} className={styles.swapBox}>
                          <p><strong>Swap ID:</strong> {tx.data.swapId.toString()}</p>
                          {tx.data.swap.initiator === address && (
                            <Web3Button
                              className="button"
                              contractAddress={CONTRACT_ADDRESS}
                              action={() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap)}
                              isDisabled={!address}
                            >
                              Remove Swap
                            </Web3Button>
                          )}
                          {tx.data.swap.acceptor === address && (
                            <Web3Button
                              className="button"
                              contractAddress={CONTRACT_ADDRESS}
                              action={() => handleCompleteSwap(parseInt(tx.data.swapId.toString()), tx.data.swap)}
                              isDisabled={!address}
                            >
                              Complete Swap
                            </Web3Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {modalMessage && <Modal message={modalMessage} onClose={closeModal} />}
    </div>
  );
};

export default Swapper;
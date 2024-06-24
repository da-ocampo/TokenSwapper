import { NextPage } from 'next';
import { Web3Button, ConnectWallet, useAddress, useContract, useSigner } from '@thirdweb-dev/react';
import { useState, useEffect, useCallback } from 'react';
import { CONTRACT_ADDRESS } from '../const/addresses';
import styles from '../styles/Home.module.css';
import Modal from './components/Modal';
import { BigNumber, ethers } from 'ethers';

const tokenTypeMap: { [key: string]: number } = {
  NONE: 1,
  ERC20: 2,
  ERC721: 3,
  ERC1155: 4,
};

const tokenTypeEnumToName = (enumValue: number): string =>
  Object.keys(tokenTypeMap).find(key => tokenTypeMap[key] === enumValue) || 'Unknown';

const abbreviateAddress = (address: string) =>
  address ? `${address.substring(0, 8)}...${address.substring(address.length - 4)}` : '';

const fetchContractName = async (contractAddress: string, signer: any) => {
  try {
    const contract = new ethers.Contract(contractAddress, ['function name() view returns (string)'], signer);
    return await contract.name();
  } catch (error) {
    console.error('Error fetching contract name:', error);
    return 'Unknown';
  }
};

const fetchSwapStatus = async (swapContract: any, swapId: number, swapData: any, signer: any) => {
  try {
    const swapStatus = await swapContract.call('getSwapStatus', [swapId, swapData]);
    const { initiatorTokenRequiresApproval, acceptorTokenRequiresApproval, isReadyForSwapping } = swapStatus;

    if (initiatorTokenRequiresApproval && acceptorTokenRequiresApproval) {
      return { status: 'Partially Ready', reason: 'both parties must approve their tokens', dotClass: 'partial' };
    }

    if (initiatorTokenRequiresApproval) {
      return { status: 'Partially Ready', reason: 'initiator must approve token', dotClass: 'partial' };
    }

    if (acceptorTokenRequiresApproval) {
      return { status: 'Partially Ready', reason: 'acceptor must approve token', dotClass: 'partial' };
    }

    if (isReadyForSwapping) {
      return { status: 'Ready', reason: '', dotClass: 'ready' };
    }

    return { status: 'Unknown', reason: '', dotClass: 'unknown' };
  } catch (error) {
    console.error('Error fetching swap status:', error);
    return { status: 'Unknown', reason: '', dotClass: 'unknown' };
  }
};

const Swapper: NextPage = () => {
  const address = useAddress();
  const { contract: swapContract } = useContract(CONTRACT_ADDRESS);
  const signer = useSigner();

  const initialFormState = {
    initiatorTokenId: '',
    acceptorTokenId: '',
    acceptorAddress: '',
    swapId: null as number | null,
    modalMessage: null as string | null,
    initiatorTokenType: 'NONE',
    initiatorERCContract: '',
    initiatorTokenQuantity: '',
    initiatorETHPortion: '',
    acceptorTokenType: 'NONE',
    acceptorERCContract: '',
    acceptorTokenQuantity: '',
    acceptorETHPortion: '',
    approveContractAddress: '',
    approveTokenId: '',
  };

  const [formState, setFormState] = useState(initialFormState);
  const [initiatedTransactions, setInitiatedTransactions] = useState<any[]>([]);
  const [toAcceptTransactions, setToAcceptTransactions] = useState<any[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<any[]>([]);
  const [removedTransactions, setRemovedTransactions] = useState<any[]>([]);
  const [showInitiatedSwaps, setShowInitiatedSwaps] = useState<'initiated' | 'toAccept' | 'completed' | 'removed'>('initiated');
  const { contract: approveContract } = useContract(formState.approveContractAddress);
  const [currentPage, setCurrentPage] = useState<'initSwap' | 'swapList'>('initSwap');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  useEffect(() => {
    if (formState.swapId !== null) {
      setFormState(prevState => ({
        ...prevState,
        modalMessage: `Swap successfully initiated! Your Swap ID is ${formState.swapId}`,
      }));
    }
  }, [formState.swapId]);

  const fetchTransactions = useCallback(async () => {
    if (swapContract && signer) {
      try {
        const events = await swapContract.events.getAllEvents();
        const swapInitiatedEvents = events.filter(event => event.eventName === 'SwapInitiated');
        const swapCompletedEvents = events.filter(event => event.eventName === 'SwapComplete');
        const swapRemovedEvents = events.filter(event => event.eventName === 'SwapRemoved');

        const removedSwapIds = new Set(swapRemovedEvents.map(event => event.data.swapId.toString()));
        const completedSwapIds = new Set(swapCompletedEvents.map(event => event.data.swapId.toString()));

        const filteredInitiatedEvents = swapInitiatedEvents.filter(
          event => !removedSwapIds.has(event.data.swapId.toString()) && !completedSwapIds.has(event.data.swapId.toString())
        );

        const fetchNames = async (events: any[]) =>
          Promise.all(
            events.map(async tx => {
              const initiatorContractName = await fetchContractName(tx.data.swap.initiatorERCContract, signer);
              const acceptorContractName = await fetchContractName(tx.data.swap.acceptorERCContract, signer);
              return {
                ...tx,
                initiatorContractName,
                acceptorContractName,
                swapType: `${tokenTypeEnumToName(tx.data.swap.initiatorTokenType)} to ${tokenTypeEnumToName(
                  tx.data.swap.acceptorTokenType
                )}`,
              };
            })
          );

        const initiatedTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter(event => event.data.swap.initiator === address)
        );
        const toAcceptTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter(event => event.data.swap.acceptor === address)
        );
        const completedTransactionsWithNames = await fetchNames(swapCompletedEvents);
        const removedTransactionsWithNames = await fetchNames(
          swapInitiatedEvents.filter(event => removedSwapIds.has(event.data.swapId.toString()) && event.data.swap.initiator === address)
        );

        const addSwapStatus = async (transactions: any[]) => {
          for (const tx of transactions) {
            const status = await fetchSwapStatus(swapContract, tx.data.swapId, tx.data.swap, signer);
            tx.swapStatus = status.status;
            tx.swapReason = status.reason;
            tx.dotClass = status.dotClass;
          }
        };

        await Promise.all([
          addSwapStatus(initiatedTransactionsWithNames),
          addSwapStatus(toAcceptTransactionsWithNames),
        ]);

        setInitiatedTransactions(initiatedTransactionsWithNames);
        setToAcceptTransactions(toAcceptTransactionsWithNames);
        setCompletedTransactions(completedTransactionsWithNames);
        setRemovedTransactions(removedTransactionsWithNames);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setFormState(prevState => ({ ...prevState, modalMessage: 'Error fetching transactions. Please try again.' }));
      }
    }
  }, [swapContract, signer, address]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const mapTokenTypeToEnum = (tokenType: string): number => tokenTypeMap[tokenType] || 0;

  const parseSwapData = (data: any[]): any[] =>
    data.map(value => {
      if (typeof value === 'string' && value.startsWith('0x')) return value;
      if (BigNumber.isBigNumber(value)) return value.toNumber();
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseInt(value, 10);
      return value;
    });

  const handleSwap = async () => {
    const {
      initiatorTokenId,
      acceptorTokenId,
      acceptorAddress,
      initiatorTokenType,
      initiatorERCContract,
      initiatorTokenQuantity,
      initiatorETHPortion,
      acceptorTokenType,
      acceptorERCContract,
      acceptorTokenQuantity,
      acceptorETHPortion,
    } = formState;

    if (!address || !swapContract) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected or contract not found.' }));
      return;
    }

    if (!initiatorTokenId || !acceptorTokenId || !acceptorAddress) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Please fill in all required fields.' }));
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
        setFormState(prevState => ({ ...prevState, swapId: parseInt(swapIdHex, 16) }));
      } else {
        throw new Error('Swap ID not found in receipt');
      }
    } catch (error) {
      console.error('Error initiating Swap:', error);
      setFormState(prevState => ({ ...prevState, modalMessage: 'Error initiating Swap. Please try again.' }));
    }
  };

  const handleCompleteSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected or contract not found.' }));
      return;
    }

    try {
      const parsedData = parseSwapData(swapData);
      const ethPortion = parseFloat(swapData.acceptorETHPortion) || 0;

      await swapContract.call('completeSwap', [swapId, parsedData], {
        value: ethers.utils.parseEther(ethPortion.toString()),
      });

      setFormState(prevState => ({
        ...prevState,
        modalMessage: `Swap with ID ${swapId} has been completed.`,
      }));
      setInitiatedTransactions(prevTransactions =>
        prevTransactions.filter(tx => tx.data.swapId.toString() !== swapId.toString())
      );
    } catch (error) {
      console.error('Error completing swap:', error);
      setFormState(prevState => ({ ...prevState, modalMessage: 'Error completing swap. Please try again.' }));
    }
  };

  const handleRemoveSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected or contract not found.' }));
      return;
    }

    try {
      const parsedData = parseSwapData(swapData);
      await swapContract.call('removeSwap', [swapId, parsedData]);
      setFormState(prevState => ({
        ...prevState,
        modalMessage: `Swap with ID ${swapId} has been removed.`,
      }));
      setInitiatedTransactions(prevTransactions =>
        prevTransactions.filter(tx => tx.data.swapId.toString() !== swapId.toString())
      );
    } catch (error) {
      console.error('Error removing swap:', error);
      setFormState(prevState => ({ ...prevState, modalMessage: 'Error removing swap. Please try again.' }));
    }
  };

  const handleApprove = async () => {
    const { approveContractAddress, approveTokenId } = formState;
    if (!address || !approveContract) {
      setFormState(prevState => ({
        ...prevState,
        modalMessage: 'Wallet not connected or approval contract not found.',
      }));
      return;
    }

    if (!approveContractAddress || !approveTokenId) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Please fill in all required fields.' }));
      return;
    }

    try {
      const receipt = await approveContract.call('approve', [CONTRACT_ADDRESS, parseInt(approveTokenId)]);
      console.log('Token approval receipt:', receipt);
      setFormState(prevState => ({ ...prevState, modalMessage: 'Approval successful!' }));
    } catch (error) {
      console.error('Error approving token:', error);
      setFormState(prevState => ({ ...prevState, modalMessage: 'Error approving token. Please try again.' }));
    }
  };

  const autofillApproveInputs = (contractAddress: string, tokenId: string) => {
    setFormState(prevState => ({
      ...prevState,
      approveContractAddress: contractAddress,
      approveTokenId: tokenId,
    }));
  };

  const closeModal = () => setFormState(prevState => ({ ...prevState, modalMessage: null }));

  const renderSwapSection = () => (
    <section id="initSwap" className="guide-grid">
      <div className="guide-left">
        <h3>How To Initiate The Swap</h3>
        <p>Both the initiator and the acceptor need to approve the Token Swapper contract to access their tokens:</p>
        <ul>
          <li>Enter the Token ID in the Approve Token field.</li>
          <li>Approve the contract to access your token.</li>
        </ul>
        <p>As the initiator, provide the following information:</p>
        <ul>
          <li>Initiator's Token ID</li>
          <li>Acceptor's Token ID</li>
          <li>Acceptor's Wallet Address</li>
          <li>Initiator's Token Type (ERC20, ERC721, ERC1155)</li>
          <ul>
            <li>Initiator's Token Contract Address</li>
            <li>Initiator's Token Quantity</li>
            <li>Initiator's ETH Portion (optional)</li>
          </ul>
          <li>Acceptor's Token Type</li>
          <ul>
            <li>Acceptor's Token Contract Address</li>
            <li>Acceptor's Token Quantity</li>
            <li>Acceptor's ETH Portion (optional)</li>
          </ul>
        </ul>
      </div>
      <div className="guide-right">
        {!address && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Connect Your Wallet</h3>
            <ConnectWallet />
          </div>
        )}
        {address && (
          <div>
            <div>
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Approve Token</h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                <input
                  type="text"
                  name="approveContractAddress"
                  placeholder="Token Contract Address"
                  value={formState.approveContractAddress}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  name="approveTokenId"
                  placeholder="Token ID"
                  value={formState.approveTokenId}
                  onChange={handleChange}
                />
                <Web3Button
                  className="button"
                  contractAddress={formState.approveContractAddress}
                  action={handleApprove}
                  isDisabled={!address || !approveContract}
                >
                  Approve Token
                </Web3Button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Enter Swap Information</h3>
              <input
                type="text"
                name="initiatorTokenId"
                placeholder="Your Token ID"
                value={formState.initiatorTokenId}
                onChange={handleChange}
              />
              <input
                type="text"
                name="acceptorTokenId"
                placeholder="Acceptor's Token ID"
                value={formState.acceptorTokenId}
                onChange={handleChange}
              />
              <input
                type="text"
                name="acceptorAddress"
                placeholder="Acceptor's Wallet Address"
                value={formState.acceptorAddress}
                onChange={handleChange}
              />
              <select name="initiatorTokenType" value={formState.initiatorTokenType} onChange={handleChange}>
                <option value="NONE">None</option>
                <option value="ERC20">ERC20</option>
                <option value="ERC721">ERC721</option>
                <option value="ERC1155">ERC1155</option>
              </select>
              {formState.initiatorTokenType !== 'NONE' && (
                <>
                  <input
                    type="text"
                    name="initiatorERCContract"
                    placeholder="Initiator's Token Contract Address"
                    value={formState.initiatorERCContract}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    name="initiatorTokenQuantity"
                    placeholder="Initiator's Token Quantity"
                    value={formState.initiatorTokenQuantity}
                    onChange={handleChange}
                  />
                </>
              )}
              <input
                type="text"
                name="initiatorETHPortion"
                placeholder="Initiator's ETH Portion"
                value={formState.initiatorETHPortion}
                onChange={handleChange}
              />
              <select name="acceptorTokenType" value={formState.acceptorTokenType} onChange={handleChange}>
                <option value="NONE">None</option>
                <option value="ERC20">ERC20</option>
                <option value="ERC721">ERC721</option>
                <option value="ERC1155">ERC1155</option>
              </select>
              {formState.acceptorTokenType !== 'NONE' && (
                <>
                  <input
                    type="text"
                    name="acceptorERCContract"
                    placeholder="Acceptor's Token Contract Address"
                    value={formState.acceptorERCContract}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    name="acceptorTokenQuantity"
                    placeholder="Acceptor's Token Quantity"
                    value={formState.acceptorTokenQuantity}
                    onChange={handleChange}
                  />
                </>
              )}
              <input
                type="text"
                name="acceptorETHPortion"
                placeholder="Acceptor's ETH Portion"
                value={formState.acceptorETHPortion}
                onChange={handleChange}
              />
              <Web3Button
                className="button"
                contractAddress={CONTRACT_ADDRESS}
                action={handleSwap}
                isDisabled={!address}
              >
                Initiate Swap
              </Web3Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const renderSwapsList = () => (
    <section id="swapList">
      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Available Swaps</h3>
      {!address && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <ConnectWallet />
        </div>
      )}
      {address && (
        <div>
          <div className="toggleButtons">
            <button
              className={`toggle-button ${showInitiatedSwaps === 'initiated' ? 'active' : ''}`}
              onClick={() => setShowInitiatedSwaps('initiated')}
            >
              Initiated Swaps
            </button>
            <button
              className={`toggle-button ${showInitiatedSwaps === 'toAccept' ? 'active' : ''}`}
              onClick={() => setShowInitiatedSwaps('toAccept')}
            >
              To Accept Swaps
            </button>
            <button
              className={`toggle-button ${showInitiatedSwaps === 'completed' ? 'active' : ''}`}
              onClick={() => setShowInitiatedSwaps('completed')}
            >
              Completed Swaps
            </button>
            <button
              className={`toggle-button ${showInitiatedSwaps === 'removed' ? 'active' : ''}`}
              onClick={() => setShowInitiatedSwaps('removed')}
            >
              Removed Swaps
            </button>
          </div>
          {showInitiatedSwaps === 'initiated' && renderTransactions(initiatedTransactions)}
          {showInitiatedSwaps === 'toAccept' && renderTransactions(toAcceptTransactions)}
          {showInitiatedSwaps === 'completed' && renderTransactions(completedTransactions)}
          {showInitiatedSwaps === 'removed' && renderTransactions(removedTransactions)}
        </div>
      )}
    </section>
  );

  const renderTransactions = (transactions: any[]) => (
    <div className="swapContainer">
      {transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        transactions.map((tx, index) => (
          <div key={index} className="swapBox">
            <div className="swapContent">
              <p>
                <strong>{tx.initiatorContractName} ↔ {tx.acceptorContractName}</strong>
              </p>
              <p><strong>{tx.swapType}</strong></p>
              <p>
                <strong>Swap ID:</strong> {tx.data.swapId.toString()}
              </p>
              <p>
                {abbreviateAddress(tx.data.swap.initiator)} ↔ {abbreviateAddress(tx.data.swap.acceptor)}
              </p>
              <p>
                <span className={`status-dot ${tx.dotClass}`}></span>
                <em><strong> {tx.swapStatus || 'Loading...'}
                {tx.swapStatus === 'Partially Ready' && (
                  <em>, {tx.swapReason}</em>
                )}
                </strong></em>
              </p>
            </div>
            <div className="swapActions">
              {renderSwapActions(tx)}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSwapActions = (tx: any) => {
    const isInitiator = tx.data.swap.initiator === address;
    const isAcceptor = tx.data.swap.acceptor === address;
    const isPartiallyReady = tx.swapStatus === 'Partially Ready';
    const isNotPartiallyReady = !isPartiallyReady;

    return (
      <>
        {isInitiator && isPartiallyReady && renderApproveForm(tx.data.swap.initiatorERCContract, tx.data.swap.initiatorTokenId.toString())}
        {isInitiator && isNotPartiallyReady && (
          <Web3Button
            className="button"
            contractAddress={CONTRACT_ADDRESS}
            action={() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap)}
            isDisabled={!address}
          >
            Remove Swap
          </Web3Button>
        )}
        {isAcceptor && isPartiallyReady && renderApproveForm(tx.data.swap.acceptorERCContract, tx.data.swap.acceptorTokenId.toString())}
        {isAcceptor && isNotPartiallyReady && (
          <Web3Button
            className="button"
            contractAddress={CONTRACT_ADDRESS}
            action={() => handleCompleteSwap(parseInt(tx.data.swapId.toString()), tx.data.swap)}
            isDisabled={!address}
          >
            Complete Swap
          </Web3Button>
        )}
      </>
    );
  };

  const renderApproveForm = (contractAddress: string, tokenId: string) => (
    <div>
      <input
        type="text"
        name="approveContractAddress"
        placeholder="Token Contract Address"
        value={formState.approveContractAddress}
        onChange={handleChange}
        onFocus={() => autofillApproveInputs(contractAddress, tokenId)}
      />
      <input
        type="text"
        name="approveTokenId"
        placeholder="Token ID"
        value={formState.approveTokenId}
        onChange={handleChange}
        onFocus={() => autofillApproveInputs(contractAddress, tokenId)}
      />
      <Web3Button
        className="button"
        contractAddress={formState.approveContractAddress}
        action={handleApprove}
        isDisabled={!address || !approveContract}
      >
        Approve Token
      </Web3Button>
    </div>
  );

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <header className="header">
          <div className="title">
            <a href="#">
              <h1>Token Swapper</h1>
            </a>
          </div>
          <nav className="navbar">
            <ul className="navList">
              <li className="navItem">
                <a
                  className={`toggle-button ${currentPage === 'initSwap' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('initSwap')}
                >
                  Start New Swap
                </a>
              </li>
              <li className="navItem">
                <a
                  className={`toggle-button ${currentPage === 'swapList' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('swapList')}
                >
                  Swaps
                </a>
              </li>
            </ul>
          </nav>
        </header>
        <div className="main-content">
          {currentPage === 'initSwap' && renderSwapSection()}
          {currentPage === 'swapList' && renderSwapsList()}
        </div>
      </div>
      {formState.modalMessage && <Modal message={formState.modalMessage} onClose={closeModal} />}
    </div>
  );
};

export default Swapper;
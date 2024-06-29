import { NextPage } from 'next';
import { Web3Button, ConnectWallet, useAddress, useContract, useSigner } from '@thirdweb-dev/react';
import { useState, useEffect, useCallback } from 'react';
import { CONTRACT_ADDRESS } from '../const/addresses';
import styles from '../styles/Home.module.css';
import Modal from './components/Modal';
import { BigNumber, ethers } from 'ethers';

const tokenTypeMap: Record<string, number> = {
  NONE: 0,
  ERC20: 1,
  ERC777: 2,
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

const fetchSwapStatus = async (swapContract: any, swapId: number, swapData: any) => {
  try {
    const swapStatus = await swapContract.call('getSwapStatus', [swapId, swapData]);
    const { initiatorTokenRequiresApproval, acceptorTokenRequiresApproval, isReadyForSwapping, initiatorNeedsToOwnToken, acceptorNeedsToOwnToken } = swapStatus;

    if (initiatorNeedsToOwnToken && acceptorNeedsToOwnToken) {
      return { status: 'Not Ready', reason: 'The initiator and acceptor do not own the tokens specified in the swap details, please start a new swap with the correct details', dotClass: 'not-ready' };
    }

    if (initiatorNeedsToOwnToken) {
      return { status: 'Not Ready', reason: 'Initiator does not own the token specified in the swap, please start a new swap with the correct details', dotClass: 'not-ready' };
    }

    if (acceptorNeedsToOwnToken) {
      return { status: 'Not Ready', reason: 'Acceptor does not own the token specified in the swap, please start a new swap with the correct details', dotClass: 'not-ready' };
    }

    if (initiatorTokenRequiresApproval && acceptorTokenRequiresApproval) {
      return { status: 'Not Ready', reason: 'both parties must approve their tokens', dotClass: 'not-ready' };
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

const renderSwapBox = (
  tx: any,
  formState: any,
  address: string,
  handleApprove: (swapId: number) => void,
  handleCompleteSwap: (swapId: number, swapData: any) => void,
  handleRemoveSwap: (swapId: number, swapData: any) => void,
  isCompleted: boolean = false,
  isRemoved: boolean = false,
  handleViewDetails: (swapData: any) => void
) => {
  const swapStatus = isCompleted ? 'Complete' : isRemoved ? 'Removed' : tx.swapStatus;
  const dotClass = isCompleted ? 'complete' : isRemoved ? 'removed' : tx.dotClass;

  const renderWeb3Button = (action: () => void, buttonText: string, contractAddress: string, isDisabled: boolean = false) => (
    <Web3Button
      className="button"
      contractAddress={contractAddress}
      action={action}
      isDisabled={isDisabled}
    >
      {buttonText}
    </Web3Button>
  );

  const renderActionButton = () => {
    const { swapStatus, swapReason, data: { swap: { initiator, acceptor, initiatorNeedsToOwnToken, acceptorNeedsToOwnToken } } } = tx;
  
    if (swapReason.includes('The initiator and acceptor do not own the tokens specified in the swap details') ||
        swapReason.includes('Initiator does not own the token specified in the swap') ||
        swapReason.includes('Acceptor does not own the token specified in the swap')) {
      if (initiator === address) {
        return (
          <>
            {renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS)}
          </>
        ); 
      }
      if (acceptor === address) {
        return null;
      }
    }
  
    if (initiator === address) {
      if (initiatorNeedsToOwnToken) {
        return (
          <>
            {renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS)}
          </>
        );
      }
  
      if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'initiator must approve token')) {
        return (
          <>
            {renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', formState[tx.data.swapId.toString()]?.approveContractAddress || '')}
            {renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS)}
          </>
        );
      }
  
      if (swapStatus === 'Partially Ready' && swapReason === 'acceptor must approve token') {
        return (
          <>
            {renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS)}
          </>
        );
      }
  
      if (swapStatus === 'Ready') {
        return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS);
      }
    }
  
    if (acceptor === address) {
      if (acceptorNeedsToOwnToken) {
        return null;
      }
  
      if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'acceptor must approve token')) {
        return (
          <>
            {renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', formState[tx.data.swapId.toString()]?.approveContractAddress || '')}
          </>
        );
      }
  
      if (swapStatus === 'Ready') {
        return renderWeb3Button(() => handleCompleteSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Complete Swap', CONTRACT_ADDRESS);
      }
    }
  };
  

  const initiatorAddress = tx.data.swap.initiator === address ? 'You' : abbreviateAddress(tx.data.swap.initiator);
  const acceptorAddress = tx.data.swap.acceptor === address ? 'You' : abbreviateAddress(tx.data.swap.acceptor);

  return (
    <div key={tx.data.swapId} className="swapBox">
      <div className="swapContent">
        <p style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{tx.initiatorContractName} ↔ {tx.acceptorContractName}</strong>
          <span onClick={() => handleViewDetails(tx.data.swap)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Show Details</span>
        </p>
        <p><strong>{tx.swapType}</strong></p>
        <p><strong>Swap ID:</strong> {tx.data.swapId.toString()}</p>
        <p>{initiatorAddress} ↔ {acceptorAddress}</p>
        <p>
          <span className={`status-dot ${dotClass}`}></span>
          <em><strong> {swapStatus}
          {swapStatus === 'Partially Ready' && <em>, {tx.swapReason}</em>}
          {swapStatus === 'Not Ready' && <em>, {tx.swapReason}</em>}</strong></em>
        </p>
      </div>
      {!isCompleted && !isRemoved && (
        <div className="swapActions">
          {renderActionButton()}
        </div>
      )}
    </div>
  );
};

const Swapper: NextPage = () => {
  const address = useAddress();
  const { contract: swapContract } = useContract(CONTRACT_ADDRESS);
  const signer = useSigner();
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [initiatedTransactions, setInitiatedTransactions] = useState<any[]>([]);
  const [toAcceptTransactions, setToAcceptTransactions] = useState<any[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<any[]>([]);
  const [removedTransactions, setRemovedTransactions] = useState<any[]>([]);
  const [showInitiatedSwaps, setShowInitiatedSwaps] = useState<'initiated' | 'toAccept' | 'completed' | 'removed'>('initiated');
  const [currentPage, setCurrentPage] = useState<'initSwap' | 'swapList'>('swapList');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalData, setModalData] = useState<any>(null);

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

        for (const tx of initiatedTransactionsWithNames) {
          const status = await fetchSwapStatus(swapContract, tx.data.swapId, tx.data.swap);
          tx.swapStatus = status.status;
          tx.swapReason = status.reason;
          tx.dotClass = status.dotClass;
          setFormState(prevState => ({
            ...prevState,
            [tx.data.swapId.toString()]: {
              approveContractAddress: tx.data.swap.initiatorERCContract,
              approveTokenId: tx.data.swap.initiatorTokenId?.toString() || '',
            }
          }));
        }
        for (const tx of toAcceptTransactionsWithNames) {
          const status = await fetchSwapStatus(swapContract, tx.data.swapId, tx.data.swap);
          tx.swapStatus = status.status;
          tx.swapReason = status.reason;
          tx.dotClass = status.dotClass;
          setFormState(prevState => ({
            ...prevState,
            [tx.data.swapId.toString()]: {
              approveContractAddress: tx.data.swap.acceptorERCContract,
              approveTokenId: tx.data.swap.acceptorTokenId?.toString() || '',
            }
          }));
        }

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
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  const mapTokenTypeToEnum = (tokenType: string): number => tokenTypeMap[tokenType] || 0;

  const parseSwapData = (data: any[]): any[] =>
    data.map(value => {
      if (typeof value === 'string' && value.startsWith('0x')) return value;
      if (BigNumber.isBigNumber(value)) return value.toString();
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
        const swapId = parseInt(swapIdHex, 16).toString();
        setFormState(prevState => ({
          ...prevState,
          [swapId]: {
            approveContractAddress: initiatorERCContract,
            approveTokenId: initiatorTokenId?.toString() || '',
          }
        }));
        setFormState({
          initiatorTokenId: '',
          acceptorTokenId: '',
          acceptorAddress: '',
          initiatorTokenType: 'NONE',
          initiatorERCContract: '',
          initiatorTokenQuantity: '',
          initiatorETHPortion: '',
          acceptorTokenType: 'NONE',
          acceptorERCContract: '',
          acceptorTokenQuantity: '',
          acceptorETHPortion: '',
          modalMessage: `Swap successfully initiated! Your Swap ID is ${parseInt(swapIdHex, 16)}`,
        });
        setCurrentPage('swapList');
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

  const handleApprove = async (swapId: number) => {
    const form = formState[swapId.toString()];
    const { approveContractAddress, approveTokenId } = form || {};
    if (!address || !approveContractAddress) {
      setFormState(prevState => ({
        ...prevState,
        modalMessage: 'Wallet not connected or approval contract not found.',
      }));
      return;
    }

    try {
      const approveContract = new ethers.Contract(approveContractAddress, ['function approve(address, uint256)'], signer);
      const tx = await approveContract.approve(CONTRACT_ADDRESS, parseInt(approveTokenId));

      const provider = approveContract.provider;
      provider.once(tx.hash, () => {
        setFormState(prevState => ({ ...prevState, modalMessage: 'Approval successful!' }));
      });
    } catch (error) {
      console.error('Error approving token:', error);
      setFormState(prevState => ({ ...prevState, modalMessage: 'Error approving token. Please try again.' }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormState(prevState => ({ ...prevState, modalMessage: null }));
    setModalData(null);
  };

  const handleViewDetails = (swapData: any) => {
    const parsedData = {
      ...swapData,
      initiatorTokenId: BigNumber.isBigNumber(swapData.initiatorTokenId) ? swapData.initiatorTokenId.toString() : swapData.initiatorTokenId,
      acceptorTokenId: BigNumber.isBigNumber(swapData.acceptorTokenId) ? swapData.acceptorTokenId.toString() : swapData.acceptorTokenId,
      initiatorTokenQuantity: BigNumber.isBigNumber(swapData.initiatorTokenQuantity) ? swapData.initiatorTokenQuantity.toString() : swapData.initiatorTokenQuantity,
      acceptorTokenQuantity: BigNumber.isBigNumber(swapData.acceptorTokenQuantity) ? swapData.acceptorTokenQuantity.toString() : swapData.acceptorTokenQuantity,
      initiatorETHPortion: BigNumber.isBigNumber(swapData.initiatorETHPortion) ? ethers.utils.formatEther(swapData.initiatorETHPortion) : swapData.initiatorETHPortion,
      acceptorETHPortion: BigNumber.isBigNumber(swapData.acceptorETHPortion) ? ethers.utils.formatEther(swapData.acceptorETHPortion) : swapData.acceptorETHPortion,
    };
    setModalData(parsedData);
    setShowModal(true);
  };

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
                  className={`toggle-button ${currentPage === 'swapList' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('swapList')}
                >
                  Swaps
                </a>
              </li>
              <li className="navItem">
                <a
                  className={`button tw-web3button css-wkqovy ${currentPage === 'initSwap' ? 'active' : ''}`}
                  onClick={() => setCurrentPage('initSwap')}
                >
                  Start New Swap
                </a>
              </li>
            </ul>
          </nav>
        </header>
        <div className="main-content">
          {currentPage === 'initSwap' && (
            <section id="initSwap" className="guide-grid">
              <div>
                <h3>How To Initiate The Swap</h3>
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
              <div>
                {!address && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Connect Your Wallet</h3>
                    <ConnectWallet />
                  </div>
                )}
                {address && (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Enter Swap Information</h3>
                      <input
                        type="text"
                        name="initiatorTokenId"
                        placeholder="Your Token ID"
                        value={formState.initiatorTokenId || ''}
                        onChange={(e) => setFormState({ ...formState, initiatorTokenId: e.target.value })}
                      />
                      <input
                        type="text"
                        name="acceptorTokenId"
                        placeholder="Acceptor's Token ID"
                        value={formState.acceptorTokenId || ''}
                        onChange={(e) => setFormState({ ...formState, acceptorTokenId: e.target.value })}
                      />
                      <input
                        type="text"
                        name="acceptorAddress"
                        placeholder="Acceptor's Wallet Address"
                        value={formState.acceptorAddress || ''}
                        onChange={(e) => setFormState({ ...formState, acceptorAddress: e.target.value })}
                      />
                      <select name="initiatorTokenType" value={formState.initiatorTokenType || 'NONE'} onChange={(e) => setFormState({ ...formState, initiatorTokenType: e.target.value })}>
                        <option value="NONE">None</option>
                        <option value="ERC20">ERC20</option>
                        <option value="ERC777">ERC777</option>
                        <option value="ERC721">ERC721</option>
                        <option value="ERC1155">ERC1155</option>
                      </select>
                      {formState.initiatorTokenType !== 'NONE' && (
                        <>
                          <input
                            type="text"
                            name="initiatorERCContract"
                            placeholder="Initiator's Token Contract Address"
                            value={formState.initiatorERCContract || ''}
                            onChange={(e) => setFormState({ ...formState, initiatorERCContract: e.target.value })}
                          />
                          <input
                            type="text"
                            name="initiatorTokenQuantity"
                            placeholder="Initiator's Token Quantity"
                            value={formState.initiatorTokenQuantity || ''}
                            onChange={(e) => setFormState({ ...formState, initiatorTokenQuantity: e.target.value })}
                          />
                        </>
                      )}
                      <input
                        type="text"
                        name="initiatorETHPortion"
                        placeholder="Initiator's ETH Portion"
                        value={formState.initiatorETHPortion || ''}
                        onChange={(e) => setFormState({ ...formState, initiatorETHPortion: e.target.value })}
                      />
                      <select name="acceptorTokenType" value={formState.acceptorTokenType || 'NONE'} onChange={(e) => setFormState({ ...formState, acceptorTokenType: e.target.value })}>
                        <option value="NONE">None</option>
                        <option value="ERC20">ERC20</option>
                        <option value="ERC777">ERC777</option>
                        <option value="ERC721">ERC721</option>
                        <option value="ERC1155">ERC1155</option>
                      </select>
                      {formState.acceptorTokenType !== 'NONE' && (
                        <>
                          <input
                            type="text"
                            name="acceptorERCContract"
                            placeholder="Acceptor's Token Contract Address"
                            value={formState.acceptorERCContract || ''}
                            onChange={(e) => setFormState({ ...formState, acceptorERCContract: e.target.value })}
                          />
                          <input
                            type="text"
                            name="acceptorTokenQuantity"
                            placeholder="Acceptor's Token Quantity"
                            value={formState.acceptorTokenQuantity || ''}
                            onChange={(e) => setFormState({ ...formState, acceptorTokenQuantity: e.target.value })}
                          />
                        </>
                      )}
                      <input
                        type="text"
                        name="acceptorETHPortion"
                        placeholder="Acceptor's ETH Portion"
                        value={formState.acceptorETHPortion || ''}
                        onChange={(e) => setFormState({ ...formState, acceptorETHPortion: e.target.value })}
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
          )}
          {currentPage === 'swapList' && (
            <section id="swapList">
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Swaps List</h3>
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
                  <div className="swapContainer">
                    {showInitiatedSwaps === 'initiated' && (initiatedTransactions.length === 0 ? (
                      <div>
                        <p style={{textAlign: 'center', marginBottom:'1em'}}>No transactions found.</p>
                        <button className="button tw-web3button css-wkqovy" onClick={() => setCurrentPage('initSwap')}>Start a new swap here</button>
                      </div>
                    ) : (
                      initiatedTransactions.map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, false, false, handleViewDetails))
                    ))}
                    {showInitiatedSwaps === 'toAccept' && (toAcceptTransactions.length === 0 ? (
                      <p>No transactions found.</p>
                    ) : (
                      toAcceptTransactions.map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, false, false, handleViewDetails))
                    ))}
                    {showInitiatedSwaps === 'completed' && (completedTransactions.length === 0 ? (
                      <p>No transactions found.</p>
                    ) : (
                      completedTransactions.map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, true, false, handleViewDetails))
                    ))}
                    {showInitiatedSwaps === 'removed' && (removedTransactions.length === 0 ? (
                      <p>No transactions found.</p>
                    ) : (
                      removedTransactions.map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, false, true, handleViewDetails))
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      {formState.modalMessage && <Modal message={formState.modalMessage} onClose={closeModal} />}
      {showModal && modalData && (
        <Modal onClose={closeModal}>
          <h3>Swap Details</h3>
          <div style={{ textAlign: 'left' }}>
            <p><strong>Initiator Wallet Address:</strong> {modalData.initiator}</p>
            <p><strong>Acceptor Wallet Address:</strong> {modalData.acceptor}</p>
            <p><strong>Initiator ERC Contract Address:</strong> {modalData.initiatorERCContract}</p>
            <p><strong>Acceptor ERC Contract Address:</strong> {modalData.acceptorERCContract}</p>
            <p><strong>Initiator Token ID:</strong> {modalData.initiatorTokenId}</p>
            <p><strong>Acceptor Token ID:</strong> {modalData.acceptorTokenId}</p>
            <p><strong>Initiator Token Quantity:</strong> {modalData.initiatorTokenQuantity}</p>
            <p><strong>Acceptor Token Quantity:</strong> {modalData.acceptorTokenQuantity}</p>
            <p><strong>Initiator ETH Portion:</strong> {modalData.initiatorETHPortion}</p>
            <p><strong>Acceptor ETH Portion:</strong> {modalData.acceptorETHPortion}</p>
            <p><strong>Initiator Token Type:</strong> {tokenTypeEnumToName(modalData.initiatorTokenType)}</p>
            <p><strong>Acceptor Token Type:</strong> {tokenTypeEnumToName(modalData.acceptorTokenType)}</p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Swapper;
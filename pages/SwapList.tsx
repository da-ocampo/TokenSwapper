import React, { useState, Dispatch, SetStateAction, useCallback, useEffect } from 'react';
import { ConnectWallet } from '@thirdweb-dev/react';
import SwapBox from './components/SwapBox';
import { MAINNET_CONTRACT_ADDRESS, SEPOLIA_CONTRACT_ADDRESS, MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../const/constants';
import { tokenTypeEnumToName } from '../hooks/HelperFunctions';
import { fetchSwapStatus, fetchInitiatorStatusForOpenSwap, fetchContractName } from '../hooks/dataFetch';

const SwapList = ({
  address,
  setCurrentPage,
  contractAddress,
  swapContract,
  signer,
  setFormState,
  chainId,
  handleViewDetails
}: {
  address: string | undefined;
  setCurrentPage: Dispatch<SetStateAction<"initSwap" | "swapList" | "wallet">>;
  contractAddress: string;
  swapContract: any;
  signer: any;
  setFormState: (state: any) => void;
  chainId: number | undefined;
  handleViewDetails: (swapData: any) => void;
}) => {
  const [showInitiatedSwaps, setShowInitiatedSwaps] = useState<'initiated' | 'toAccept' | 'completed' | 'removed' | 'open'>('initiated');
  const [initiatedSwapFilter, setInitiatedSwapFilter] = useState<'regular' | 'open'>('regular');
  const [initiatedTransactions, setInitiatedTransactions] = useState<any[]>([]);
  const [toAcceptTransactions, setToAcceptTransactions] = useState<any[]>([]);
  const [openTransactions, setOpenTransactions] = useState<any[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<any[]>([]);
  const [removedTransactions, setRemovedTransactions] = useState<any[]>([]);
  const [formState, setLocalFormState] = useState<Record<string, any>>({});

  const handleInitiatedSwapClick = (filter: 'regular' | 'open') => {
    setInitiatedSwapFilter(filter);
  };

  const fetchTransactions = useCallback(async () => {
    if (swapContract && signer && address && 
        ((chainId === MAINNET_CHAIN_ID && contractAddress === MAINNET_CONTRACT_ADDRESS) ||
         (chainId === SEPOLIA_CHAIN_ID && contractAddress === SEPOLIA_CONTRACT_ADDRESS))) {
      try {
        const events = await swapContract.events.getAllEvents();
  
        const swapInitiatedEvents = events.filter((event: any) => event.eventName === 'SwapInitiated');
        const swapCompletedEvents = events.filter((event: any) => event.eventName === 'SwapComplete');
        const swapRemovedEvents = events.filter((event: any) => event.eventName === 'SwapRemoved');
  
        const removedSwapIds = new Set(swapRemovedEvents.map((event: any) => event.data.swapId.toString()));
        const completedSwapIds = new Set(swapCompletedEvents.map((event: any) => event.data.swapId.toString()));
  
        const currentTimestamp = Math.floor(Date.now() / 1000);
  
        const filteredInitiatedEvents = swapInitiatedEvents.filter(
          (event: any) => !removedSwapIds.has(event.data.swapId.toString()) && 
                   !completedSwapIds.has(event.data.swapId.toString()) &&
                   event.data.swap.expiryDate > currentTimestamp
        );
  
        const fetchNames = async (events: any[]) =>
          Promise.all(
            events.map(async (tx: any) => {
              const initiatorContractName = await fetchContractName(tx.data.swap.initiatorERCContract, signer);
              const acceptorContractName = await fetchContractName(tx.data.swap.acceptorERCContract, signer);
              return {
                ...tx,
                initiatorContractName,
                acceptorContractName,
                swapType: `${tokenTypeEnumToName(tx.data.swap.initiatorTokenType)} to ${tokenTypeEnumToName(tx.data.swap.acceptorTokenType)}`,
              };
            })
          );
  
        const initiatedTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter((event: any) => event.data.swap.initiator === address)
        );
        const toAcceptTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter((event: any) => event.data.swap.acceptor === address)
        );
        const openTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter((event: any) =>
            event.data.swap.acceptor === '0x0000000000000000000000000000000000000000' && event.data.swap.initiator !== address
          )
        );
        const completedTransactionsWithNames = await fetchNames(swapCompletedEvents.filter((event: any) => event.data.swap.initiator === address || event.data.swap.acceptor === address));
        
        const removedTransactionsWithNames = await fetchNames(
          swapInitiatedEvents.filter((event: any) => 
            removedSwapIds.has(event.data.swapId.toString()) && 
            (event.data.swap.initiator === address || event.data.swap.acceptor === address)
          )
        );
  
        const expiredTransactions = swapInitiatedEvents.filter(
          (event: any) => !removedSwapIds.has(event.data.swapId.toString()) && 
                   !completedSwapIds.has(event.data.swapId.toString()) &&
                   event.data.swap.expiryDate <= currentTimestamp &&
                   (event.data.swap.initiator === address || event.data.swap.acceptor === address)
        );
  
        const expiredTransactionsWithNames = await fetchNames(expiredTransactions);
  
        for (const tx of initiatedTransactionsWithNames) {
          const status = await fetchSwapStatus(swapContract, tx.data.swapId, tx.data.swap);
          tx.swapStatus = status.status;
          tx.swapReason = status.reason;
          tx.dotClass = status.dotClass;
          setLocalFormState((prevState: Record<string, any>) => ({
            ...prevState,
            [tx.data.swapId.toString()]: {
              approveContractAddress: tx.data.swap.initiatorERCContract,
              approveTokenId: tx.data.swap.initiatorTokenId?.toString() || '',
              approveTokenQuantity: tx.data.swap.initiatorTokenQuantity || 0,
            }
          }));
        }
        for (const tx of toAcceptTransactionsWithNames) {
          const status = await fetchSwapStatus(swapContract, tx.data.swapId, tx.data.swap);
          tx.swapStatus = status.status;
          tx.swapReason = status.reason;
          tx.dotClass = status.dotClass;
          setLocalFormState((prevState: Record<string, any>) => ({
            ...prevState,
            [tx.data.swapId.toString()]: {
              approveContractAddress: tx.data.swap.acceptorERCContract,
              approveTokenId: tx.data.swap.acceptorTokenId?.toString() || '',
              approveTokenQuantity: tx.data.swap.acceptorTokenQuantity || 0,
            }
          }));
        }
        for (const tx of openTransactionsWithNames) {
          const status = await fetchInitiatorStatusForOpenSwap(swapContract, tx.data.swapId, tx.data.swap);
          tx.swapStatus = status.status;
          tx.swapReason = status.reason;
          tx.dotClass = status.dotClass;
          setLocalFormState((prevState: Record<string, any>) => ({
            ...prevState,
            [tx.data.swapId.toString()]: {
              approveContractAddress: address === tx.data.swap.initiator ? tx.data.swap.initiatorERCContract : tx.data.swap.acceptorERCContract,
              approveTokenId: address === tx.data.swap.initiator ? tx.data.swap.initiatorTokenId?.toString() || '' : tx.data.swap.acceptorTokenId?.toString() || '',
              approveTokenQuantity: address === tx.data.swap.initiator ? tx.data.swap.initiatorTokenQuantity || 0 : tx.data.swap.acceptorTokenQuantity || 0,
            }
          }));
        }
  
        setInitiatedTransactions(initiatedTransactionsWithNames);
        setToAcceptTransactions(toAcceptTransactionsWithNames);
        setOpenTransactions(openTransactionsWithNames);
        setCompletedTransactions(completedTransactionsWithNames);
        setRemovedTransactions([...removedTransactionsWithNames, ...expiredTransactionsWithNames]);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setFormState((prevState: any) => ({ ...prevState, modalMessage: 'Error fetching transactions. Please try again.' }));
      }
    } else {
      setInitiatedTransactions([]);
      setToAcceptTransactions([]);
      setOpenTransactions([]);
      setCompletedTransactions([]);
      setRemovedTransactions([]);
    }
  }, [swapContract, signer, address, chainId, contractAddress, setFormState]);

  useEffect(() => {
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  useEffect(() => {
    if (address) {
      fetchTransactions();
    }
  }, [address, fetchTransactions]);

  return (
    <section id="swapList">
      {!address && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '1em' }}>Connect Your Wallet</h3>
          <ConnectWallet />
        </div>
      )}
      {address && (
        <div className="swapGrid">
          <div className="toggleButtons">
            <button
              className={`toggle-button ${showInitiatedSwaps === 'initiated' ? 'active' : ''}`}
              onClick={() => {
                setShowInitiatedSwaps('initiated');
                handleInitiatedSwapClick('regular');
              }}
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
              className={`toggle-button ${showInitiatedSwaps === 'open' ? 'active' : ''}`}
              onClick={() => setShowInitiatedSwaps('open')}
            >
              Open Swaps
              {showInitiatedSwaps === 'open' && (
                <>
                  <span className="info-icon">?</span>
                  <div className="info-tooltip">
                    A swap where the acceptor address is set to the zero address means that the swap can be accepted by anyone.
                  </div>
                </>
              )}
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
          {showInitiatedSwaps === 'initiated' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1em', width: "16em" }}>
                  <button
                    className={`toggle-button ${initiatedSwapFilter === 'regular' ? 'active' : ''}`}
                    onClick={() => handleInitiatedSwapClick('regular')}
                  >
                    Regular Swaps
                  </button>
                  <button
                    className={`toggle-button ${initiatedSwapFilter === 'open' ? 'active' : ''}`}
                    onClick={() => handleInitiatedSwapClick('open')}
                  >
                    Open Swaps
                    </button>
                </div>
                {initiatedSwapFilter === 'regular' ? (
                  initiatedTransactions.length === 0 ? (
                    <div>
                      <p style={{ textAlign: 'center', marginBottom: '1em' }}>No transactions found.</p>
                      <button className="button tw-web3button css-wkqovy" onClick={() => setCurrentPage('initSwap')}>Start a new swap here</button>
                    </div>
                  ) : (
                    initiatedTransactions
                      .filter(tx => tx.data.swap.acceptor !== '0x0000000000000000000000000000000000000000')
                      .map(tx => (
                        <SwapBox
                          key={tx.data.swapId}
                          tx={tx}
                          formState={formState}
                          address={address}
                          handleViewDetails={handleViewDetails}
                          contractAddress={contractAddress}
                          swapContract={swapContract}
                          signer={signer}
                          setFormState={setFormState}
                        />
                      ))
                  )
                ) : (
                  initiatedTransactions
                  .filter(tx => tx.data.swap.acceptor === '0x0000000000000000000000000000000000000000')
                  .map(tx => (
                    <SwapBox
                      key={tx.data.swapId}
                      tx={tx}
                      formState={formState}
                      address={address}
                      handleViewDetails={handleViewDetails}
                      contractAddress={contractAddress}
                      swapContract={swapContract}
                      signer={signer}
                      setFormState={setFormState}
                    />
                  ))
              )}
            </>
          )}
          {showInitiatedSwaps === 'toAccept' && (toAcceptTransactions.length === 0 ? (
            <p>No transactions found.</p>
          ) : (
            toAcceptTransactions.map(tx => (
              <SwapBox
                key={tx.data.swapId}
                tx={tx}
                formState={formState}
                address={address}
                handleViewDetails={handleViewDetails}
                contractAddress={contractAddress}
                swapContract={swapContract}
                signer={signer}
                setFormState={setFormState}
              />
            ))
          ))}
          {showInitiatedSwaps === 'open' && (openTransactions.length === 0 ? (
            <p>No transactions found.</p>
          ) : (
            openTransactions.map(tx => (
              <SwapBox
                key={tx.data.swapId}
                tx={tx}
                formState={formState}
                address={address}
                handleViewDetails={handleViewDetails}
                contractAddress={contractAddress}
                swapContract={swapContract}
                signer={signer}
                setFormState={setFormState}
              />
            ))
          ))}
          {showInitiatedSwaps === 'completed' && (completedTransactions.length === 0 ? (
            <p>No transactions found.</p>
          ) : (
            completedTransactions.map(tx => (
              <SwapBox
                key={tx.data.swapId}
                tx={tx}
                formState={formState}
                address={address}
                handleViewDetails={handleViewDetails}
                contractAddress={contractAddress}
                swapContract={swapContract}
                signer={signer}
                setFormState={setFormState}
                isCompleted={true}
              />
            ))
          ))}
          {showInitiatedSwaps === 'removed' && (removedTransactions.length === 0 ? (
            <p>No transactions found.</p>
          ) : (
            removedTransactions.map(tx => (
              <SwapBox
                key={tx.data.swapId}
                tx={tx}
                formState={formState}
                address={address}
                handleViewDetails={handleViewDetails}
                contractAddress={contractAddress}
                swapContract={swapContract}
                signer={signer}
                setFormState={setFormState}
                isRemoved={true}
              />
            ))
          ))}
        </div>
      </div>
    )}
  </section>
);
};

export default SwapList;
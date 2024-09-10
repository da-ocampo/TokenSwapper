import { NextPage } from 'next';
import { Web3Button, ConnectWallet, useAddress, useContract, useSigner, useChain, useChainId } from '@thirdweb-dev/react';
import { useState, useEffect, useCallback } from 'react';
import { MAINNET_CONTRACT_ADDRESS, SEPOLIA_CONTRACT_ADDRESS } from '../const/addresses';
import styles from '../styles/Home.module.css';
import Modal from './components/Modal';
import { BigNumber, ethers } from 'ethers';
import { useNetworkValidation } from "../hooks/useNetworkValidation";

// Maps token type names to corresponding enum values
const tokenTypeMap: Record<string, number> = {
  ETH: 0,
  ERC20: 1,
  ERC777: 2,
  ERC721: 3,
  ERC1155: 4,
};

// Converts token type enum value to its name
const tokenTypeEnumToName = (enumValue: number): string =>
  Object.keys(tokenTypeMap).find(key => tokenTypeMap[key] === enumValue) || 'Unknown';

// Abbreviates Ethereum address
const abbreviateAddress = (address: string) =>
  address ? `${address.substring(0, 8)}...${address.substring(address.length - 4)}` : '';

// Fetches the name of a contract using its address
const fetchContractName = async (contractAddress: string, signer: any) => {
  if (contractAddress === ethers.constants.AddressZero) {
    return "ETH";
  }
  try {
    const contract = new ethers.Contract(contractAddress, ['function name() view returns (string)'], signer);
    return await contract.name();
  } catch (error) {
    console.error('Error fetching contract name:', error);
    return 'Unknown';
  }
};

// Fetches the status of a swap
const fetchSwapStatus = async (swapContract: any, swapId: number, swapData: any) => {
  try {
    const swapStatus = await swapContract.call('getSwapStatus', [swapId, swapData]);
    const { initiatorTokenRequiresApproval, acceptorTokenRequiresApproval, isReadyForSwapping, initiatorNeedsToOwnToken, acceptorNeedsToOwnToken } = swapStatus;

    // Handles different scenarios based on the swap status
    if (swapData.acceptor === '0x0000000000000000000000000000000000000000') {
      if (initiatorNeedsToOwnToken) {
        return { status: 'Not Ready', reason: 'Initiator does not own the token specified in the swap', dotClass: 'not-ready' };
      }
      if (initiatorTokenRequiresApproval) {
        return { status: 'Not Ready', reason: 'Initiator must approve token', dotClass: 'not-ready' };
      }
      return { status: 'Ready', reason: 'Waiting for acceptor', dotClass: 'ready' };
    }

    if (initiatorNeedsToOwnToken && acceptorNeedsToOwnToken) {
      return { status: 'Not Ready', reason: 'The initiator and acceptor do not own the tokens specified in the swap', dotClass: 'not-ready' };
    }
    if (initiatorNeedsToOwnToken) {
      return { status: 'Not Ready', reason: 'Initiator does not own the token specified in the swap', dotClass: 'not-ready' };
    }
    if (acceptorNeedsToOwnToken) {
      return { status: 'Not Ready', reason: 'Acceptor does not own the token specified in the swap', dotClass: 'not-ready' };
    }
    if (initiatorTokenRequiresApproval && acceptorTokenRequiresApproval) {
      return { status: 'Not Ready', reason: 'Both parties must approve their tokens', dotClass: 'not-ready' };
    }
    if (initiatorTokenRequiresApproval) {
      return { status: 'Partially Ready', reason: 'Initiator must approve token', dotClass: 'partial' };
    }
    if (acceptorTokenRequiresApproval) {
      return { status: 'Partially Ready', reason: 'Acceptor must approve token', dotClass: 'partial' };
    }
    if (isReadyForSwapping) {
      return { status: 'Ready', reason: 'Waiting for acceptor', dotClass: 'ready' };
    }
    return { status: 'Unknown', reason: '', dotClass: 'unknown' };
  } catch (error) {
    console.error('Error fetching swap status:', error);
    return { status: 'Unknown', reason: '', dotClass: 'unknown' };
  }
};

// Fetches the status for open swaps (only for initiators)
const fetchInitiatorStatusForOpenSwap = async (swapContract: any, swapId: number, swapData: any) => {
  try {
    const swapStatus = await swapContract.call('getSwapStatus', [swapId, swapData]);
    const { initiatorNeedsToOwnToken, initiatorTokenRequiresApproval } = swapStatus;

    if (initiatorNeedsToOwnToken) {
      return { status: 'Not Ready', reason: 'Initiator does not own the token specified in the swap', dotClass: 'not-ready' };
    }
    if (initiatorTokenRequiresApproval) {
      return { status: 'Not Ready', reason: 'Initiator must approve token', dotClass: 'not-ready' };
    }
    return { status: 'Ready', reason: '', dotClass: 'ready' };
  } catch (error) {
    console.error('Error fetching initiator status for open swap:', error);
    return { status: 'Unknown', reason: '', dotClass: 'unknown' };
  }
};

// Renders a Web3Button with a given action and text
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

// Renders the required info for the swap (if applicable)
const renderRequiredInfo = (tx: any) => {
  if (tx.data.swap.acceptor === '0x0000000000000000000000000000000000000000') {
    const { acceptorTokenQuantity, acceptorETHPortion } = tx.data.swap;
    const acceptorContractName = tx.acceptorContractName || 'Token';
    const requiredInfo = acceptorTokenQuantity
      ? `Required: ${acceptorTokenQuantity} ${acceptorContractName}`
      : acceptorETHPortion
      ? `Required: ${ethers.utils.formatEther(acceptorETHPortion.toString())} ETH`
      : '';

    return <p><strong>{requiredInfo}</strong></p>;
  }
  return null;
};

// Enhanced error handling function that maps specific Solidity errors to human-readable messages
const parseErrorReason = (error: any) => {
  const reason = error?.data?.message || error?.message || '';

  // Maps specific error messages to human-readable reasons
  if (reason.includes('ZeroAddressDisallowed')) return 'ZeroAddressDisallowed: Accepting zero address is disallowed unless it is an ERC20 or ERC777 token.';
  if (reason.includes('InitiatorNotMatched')) return 'InitiatorNotMatched: The sender is not the initiator of the swap.';
  if (reason.includes('InitiatorEthPortionNotMatched')) return 'InitiatorEthPortionNotMatched: ETH portion does not match the required amount for the initiator.';
  if (reason.includes('TwoWayEthPortionsDisallowed')) return 'TwoWayEthPortionsDisallowed: Both parties cannot contribute ETH to the swap.';
  if (reason.includes('SwapCompleteOrDoesNotExist')) return 'SwapCompleteOrDoesNotExist: The swap is either complete or does not exist.';
  if (reason.includes('NotAcceptor')) return 'NotAcceptor: The sender is not the designated acceptor of the swap.';
  if (reason.includes('IncorrectOrMissingAcceptorETH')) return 'IncorrectOrMissingAcceptorETH: The ETH portion sent by the acceptor does not match the required amount.';
  if (reason.includes('NotInitiator')) return 'NotInitiator: The sender is not the initiator of the swap when trying to remove it.';
  if (reason.includes('EmptyWithdrawDisallowed')) return 'EmptyWithdrawDisallowed: No balance available to withdraw.';
  if (reason.includes('ZeroAddressSetForValidTokenType')) return 'ZeroAddressSetForValidTokenType: A zero address is used for an ERC20, ERC721, or ERC1155 token, which is invalid.';
  if (reason.includes('TokenQuantityMissing')) return 'TokenQuantityMissing: No token quantity specified for ERC20 or ERC1155 tokens.';
  if (reason.includes('TokenIdMissing')) return 'TokenIdMissing: No token ID specified for ERC721 or ERC1155 tokens.';
  if (reason.includes('ValueOrTokenMissing')) return 'ValueOrTokenMissing: Both ETH and token information are missing for the swap.';
  if (reason.includes('TokenTransferFailed')) return 'TokenTransferFailed: Token transfer failed.';
  if (reason.includes('NoReentry')) return 'NoReentry: Reentrancy detected.';
  if (reason.includes('ETHSendingFailed')) return 'ETHSendingFailed: Contract failed to send ETH.';

  // General Solidity Errors
  if (reason.includes('user rejected transaction')) return 'User rejected the transaction.';
  if (reason.includes('out of gas')) return 'Out of Gas: The transaction ran out of gas.';
  if (reason.includes('invalid opcode')) return 'Invalid Opcode: Invalid operation encountered during transaction.';
  if (reason.includes('stack too deep')) return 'Stack Too Deep: Too many variables in scope.';
  if (reason.includes('revert')) return 'Revert: Transaction reverted due to an error.';
  if (reason.includes('assert')) return 'Assert: Assertion failed. This typically indicates a bug in the contract.';

  // Insufficient Funds or Permissions
  if (reason.includes('insufficient funds for gas * price + value')) return 'Insufficient Funds: Not enough ETH to cover gas and transaction value.';
  if (reason.includes('ERC721: transfer caller is not owner nor approved')) return 'ERC721: Transfer caller is not the owner or approved.';
  if (reason.includes('ERC20: transfer amount exceeds balance')) return 'ERC20: Transfer amount exceeds the available balance.';
  if (reason.includes('ERC20: transfer amount exceeds allowance')) return 'ERC20: Transfer amount exceeds the allowed limit.';
  if (reason.includes('ERC1155: insufficient balance for transfer')) return 'ERC1155: Insufficient balance for the transfer.';

  // Contract Deployment and Interaction Errors
  if (reason.includes('constructor out of gas')) return 'Constructor Out of Gas: Contract constructor ran out of gas during deployment.';
  if (reason.includes('unknown contract')) return 'Unknown Contract: No contract found at the specified address.';
  if (reason.includes('execution reverted')) return 'Execution Reverted: Transaction was reverted due to an error.';

  // Default fallback
  return 'An unknown error occurred. Please try again.';
};

// Main component for the token swapper
const Swapper: NextPage = () => {
  const address = useAddress();
  const chain = useChain();
  const chainId = useChainId();
  const [contractAddress, setContractAddress] = useState<string>('');
  const { contract: swapContract } = useContract(contractAddress ? contractAddress : undefined);
  const signer = useSigner();
  const [formState, setFormState] = useState<Record<string, any>>({
    initiatorTokenType: 'NONE',
    initiatorERCContract: ethers.constants.AddressZero,
    acceptorTokenType: 'NONE',
    acceptorERCContract: ethers.constants.AddressZero,
  });
  const [initiatedTransactions, setInitiatedTransactions] = useState<any[]>([]);
  const [toAcceptTransactions, setToAcceptTransactions] = useState<any[]>([]);
  const [openTransactions, setOpenTransactions] = useState<any[]>([]);
  const [completedTransactions, setCompletedTransactions] = useState<any[]>([]);
  const [removedTransactions, setRemovedTransactions] = useState<any[]>([]);
  const [showInitiatedSwaps, setShowInitiatedSwaps] = useState<'initiated' | 'toAccept' | 'completed' | 'removed' | 'open'>('initiated');
  const [currentPage, setCurrentPage] = useState<'initSwap' | 'swapList'>('swapList');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalData, setModalData] = useState<any>(null);
  const [tokenDecimals, setTokenDecimals] = useState<{ [key: string]: number }>({});
  const [calculatedValue, setCalculatedValue] = useState<{ [key: string]: string }>({});
  const [initiatedSwapFilter, setInitiatedSwapFilter] = useState<'regular' | 'open'>('regular'); // New state for filter
  

  const MAINNET_CHAIN_ID = 1;
  const SEPOLIA_CHAIN_ID = 11155111;

  useEffect(() => {
    if (chainId) {
      if (chainId === MAINNET_CHAIN_ID) {
        console.log('Mainnet chain detected, using MAINNET_CONTRACT_ADDRESS');
        setContractAddress(MAINNET_CONTRACT_ADDRESS);
      } else if (chainId === SEPOLIA_CHAIN_ID) {
        console.log('Sepolia chain detected, using SEPOLIA_CONTRACT_ADDRESS');
        setContractAddress(SEPOLIA_CONTRACT_ADDRESS);
      } else {
        console.log('Unsupported chain detected, contract address is cleared');
        setContractAddress('');
      }
      // Clear all transaction data when switching networks
      setInitiatedTransactions([]);
      setToAcceptTransactions([]);
      setOpenTransactions([]);
      setCompletedTransactions([]);
      setRemovedTransactions([]);
    }
  }, [chainId]);

  // Separate useEffect to handle contract changes
  useEffect(() => {
    if (contractAddress) {
      console.log(`Contract address updated: ${contractAddress}`);
      // You might want to trigger a re-fetch of data here
      fetchTransactions();
    }
  }, [contractAddress]);

  // Render the swap box UI component
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

    const renderActionButton = () => {
      const { swapStatus, swapReason, data: { swap: { initiator, acceptor } } } = tx;

      if (tx.data.swap.acceptor === '0x0000000000000000000000000000000000000000') {
        if (initiator === address) {
          if (swapStatus === 'Not Ready' && swapReason === 'Initiator must approve token') {
            return renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', tx.data.swap.initiatorERCContract);
          }

          if (swapStatus === 'Not Ready' && swapReason === 'Initiator does not own the token specified in the swap') {
            return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', contractAddress);
          }

          if (swapStatus === 'Ready') {
            return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', contractAddress);
          }

          return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', contractAddress);
        }

        if (swapStatus === 'Not Ready' && swapReason === 'Initiator does not own the token specified in the swap') {
          return null;
        }

        if (acceptor === '0x0000000000000000000000000000000000000000') {
          return (
            <>
              {renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', tx.data.swap.acceptorERCContract)}
              {swapStatus === 'Ready' && renderWeb3Button(() => handleCompleteSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Complete Swap', contractAddress)}
            </>
          );
        }
      } else {
        if (swapReason.includes('not own')) {
          if (initiator === address) {
            return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', contractAddress);
          }
          return null;
        }

        if (initiator === address) {
          if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'Initiator must approve token')) {
            return (
              <>
                {renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', tx.data.swap.initiatorERCContract)}
                {renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', contractAddress)}
              </>
            );
          }

          if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'Acceptor must approve token')) {
            return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', contractAddress);
          }

          if (swapStatus === 'Ready') {
            return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', contractAddress);
          }
        }

        if (acceptor === address) {
          if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'Initiator must approve token')) {
            return (
              <>
                {renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', tx.data.swap.initiatorERCContract)}
              </>
            );
          }

          if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'Acceptor must approve token')) {
            return renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', tx.data.swap.acceptorERCContract);
          }

          if (swapStatus === 'Ready') {
            return renderWeb3Button(() => handleCompleteSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Complete Swap', contractAddress);
          }
        }
      }
    };

    const initiatorAddress = tx.data.swap.initiator === address ? 'You' : abbreviateAddress(tx.data.swap.initiator);
    const acceptorAddress = tx.data.swap.acceptor === '0x0000000000000000000000000000000000000000' ? 'Open Swap' : (tx.data.swap.acceptor === address ? 'You' : abbreviateAddress(tx.data.swap.acceptor));

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
          {renderRequiredInfo(tx)}
          <p>
            <span className={`status-dot ${dotClass}`}></span>
            <em><strong>{swapStatus}
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

  // Fetches token decimals and calculates value
  const fetchTokenDecimals = useCallback(async (contractAddress: string, side: 'initiator' | 'acceptor') => {
    const tokenType = formState[`${side}TokenType`];

    if (tokenType === 'ERC20' || tokenType === 'ERC777') {
      if (signer) {
        try {
          const contract = new ethers.Contract(contractAddress, ['function decimals() view returns (uint8)'], signer);
          const decimals = await contract.decimals();
          setTokenDecimals(prevDecimals => ({ ...prevDecimals, [side]: decimals }));

          const quantity = formState[`${side}TokenQuantity`];
          if (quantity) {
            const value = ethers.utils.formatUnits(quantity, decimals);
            setCalculatedValue(prevValues => ({ ...prevValues, [side]: value }));
          } else {
            setCalculatedValue(prevValues => ({ ...prevValues, [side]: '' }));
          }
        } catch (error) {
          console.error('Error fetching token decimals:', error);
        }
      }
    } else {
      setTokenDecimals(prevDecimals => ({ ...prevDecimals, [side]: 0 }));
      setCalculatedValue(prevValues => ({ ...prevValues, [side]: '' }));
    }
  }, [formState, signer]);

  // Handles ERC contract changes
  const handleERCContractChange = async (value: string, side: 'initiator' | 'acceptor') => {
    setFormState(prevState => ({ ...prevState, [`${side}ERCContract`]: value }));
    if (value) {
      await fetchTokenDecimals(value, side);
    } else {
      setTokenDecimals(prevDecimals => ({ ...prevDecimals, [side]: 0 }));
      setCalculatedValue(prevValues => ({ ...prevValues, [side]: '' }));
    }
  };

  // Handles token quantity changes
  const handleTokenQuantityChange = (value: string, side: 'initiator' | 'acceptor') => {
    setFormState(prevState => ({ ...prevState, [`${side}TokenQuantity`]: value }));
    const decimals = tokenDecimals[side];
    if (value && decimals > 0) {
      const calculated = ethers.utils.formatUnits(value, decimals);
      setCalculatedValue(prevValues => ({ ...prevValues, [side]: calculated }));
    } else {
      setCalculatedValue(prevValues => ({ ...prevValues, [side]: '' }));
    }
  };

  // Fetches all swap transactions
  const fetchTransactions = useCallback(async () => {
    if (swapContract && signer && address && 
        ((chainId === MAINNET_CHAIN_ID && contractAddress === MAINNET_CONTRACT_ADDRESS) ||
         (chainId === SEPOLIA_CHAIN_ID && contractAddress === SEPOLIA_CONTRACT_ADDRESS))) {
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
                swapType: `${tokenTypeEnumToName(tx.data.swap.initiatorTokenType)} to ${tokenTypeEnumToName(tx.data.swap.acceptorTokenType)}`,
              };
            })
          );

        const initiatedTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter(event => event.data.swap.initiator === address)
        );
        const toAcceptTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter(event => event.data.swap.acceptor === address)
        );
        const openTransactionsWithNames = await fetchNames(
          filteredInitiatedEvents.filter(event =>
            event.data.swap.acceptor === '0x0000000000000000000000000000000000000000' && event.data.swap.initiator !== address
          )
        );
        const completedTransactionsWithNames = await fetchNames(swapCompletedEvents.filter(event => event.data.swap.initiator === address || event.data.swap.acceptor === address));
        const removedTransactionsWithNames = await fetchNames(
          swapInitiatedEvents.filter(event => removedSwapIds.has(event.data.swapId.toString()) && (event.data.swap.initiator === address || event.data.swap.acceptor === address))
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
              approveTokenQuantity: tx.data.swap.initiatorTokenQuantity || 0,
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
              approveTokenQuantity: tx.data.swap.acceptorTokenQuantity || 0,
            }
          }));
        }
        for (const tx of openTransactionsWithNames) {
          const status = await fetchInitiatorStatusForOpenSwap(swapContract, tx.data.swapId, tx.data.swap);
          tx.swapStatus = status.status;
          tx.swapReason = status.reason;
          tx.dotClass = status.dotClass;
          setFormState(prevState => ({
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
        setRemovedTransactions(removedTransactionsWithNames);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setFormState(prevState => ({ ...prevState, modalMessage: 'Error fetching transactions. Please try again.' }));
      }
    } else {
      // Clear all transaction data if the conditions are not met
      setInitiatedTransactions([]);
      setToAcceptTransactions([]);
      setOpenTransactions([]);
      setCompletedTransactions([]);
      setRemovedTransactions([]);
    }
  }, [swapContract, signer, address, chainId, contractAddress]);

  // Periodically fetches transactions
  useEffect(() => {
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  // Fetches transactions when the user connects their wallet
  useEffect(() => {
    if (address) {
      fetchTransactions();
    }
  }, [address, fetchTransactions]);

  // Fetches token decimals when contract addresses change
  useEffect(() => {
    if (formState.initiatorERCContract) fetchTokenDecimals(formState.initiatorERCContract, 'initiator');
    if (formState.acceptorERCContract) fetchTokenDecimals(formState.acceptorERCContract, 'acceptor');
  }, [formState.initiatorERCContract, formState.acceptorERCContract, fetchTokenDecimals]);

  // Maps token type name to its enum value
  const mapTokenTypeToEnum = (tokenType: string): number => tokenTypeMap[tokenType] || 0;

  // Parses swap data to be passed to the contract
  const parseSwapData = (data: any[]): any[] =>
    data.map(value => {
      if (typeof value === 'string' && value.startsWith('0x')) return value;
      if (BigNumber.isBigNumber(value)) return value.toString();
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseInt(value, 10);
      return value;
    });

  // Handles initiating a new swap
  const handleSwap = async () => {
    const {
      acceptorAddress,
      initiatorTokenType,
      initiatorERCContract,
      initiatorTokenQuantity,
      initiatorETHPortion,
      acceptorTokenType,
      acceptorERCContract,
      acceptorTokenQuantity,
      acceptorETHPortion,
      initiatorTokenId,
      acceptorTokenId,
    } = formState;

    if (!address || !swapContract || !contractAddress) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected, contract not found, or unsupported network.' }));
      return;
    }
  
    if ((chainId === MAINNET_CHAIN_ID && contractAddress !== MAINNET_CONTRACT_ADDRESS) ||
        (chainId === SEPOLIA_CHAIN_ID && contractAddress !== SEPOLIA_CONTRACT_ADDRESS)) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Please switch to the correct network for this contract.' }));
      return;
    }

    const finalAcceptorAddress = acceptorAddress || '0x0000000000000000000000000000000000000000';

    try {
      const tx = await swapContract.call('initiateSwap', [
        {
          initiator: address,
          acceptor: finalAcceptorAddress,
          initiatorTokenType: mapTokenTypeToEnum(initiatorTokenType),
          initiatorERCContract: initiatorTokenType === 'NONE' ? ethers.constants.AddressZero : initiatorERCContract,
          initiatorTokenId: parseInt(initiatorTokenId) || 0,
          initiatorTokenQuantity: parseInt(initiatorTokenQuantity) || 0,
          initiatorETHPortion: ethers.utils.parseEther(initiatorETHPortion || '0'), // Parsing ETH correctly here
          acceptorTokenType: mapTokenTypeToEnum(acceptorTokenType),
          acceptorERCContract: acceptorTokenType === 'NONE' ? ethers.constants.AddressZero : acceptorERCContract,
          acceptorTokenId: parseInt(acceptorTokenId) || 0,
          acceptorTokenQuantity: parseInt(acceptorTokenQuantity) || 0,
          acceptorETHPortion: ethers.utils.parseEther(acceptorETHPortion || '0'), // Parsing ETH correctly here
        },
      ], {
        value: ethers.utils.parseEther(initiatorETHPortion || '0'), // Correctly setting the value in wei
      });

      const receipt = tx.receipt;
      const swapIdHex = receipt?.logs?.[0]?.topics?.[1];
      if (swapIdHex) {
        const swapId = parseInt(swapIdHex, 16).toString();
        setFormState(prevState => ({
          ...prevState,
          [swapId]: {
            approveContractAddress: initiatorERCContract,
            approveTokenId: initiatorTokenId?.toString() || '',
            approveTokenQuantity: initiatorTokenQuantity || 0,
          }
        }));
        setFormState({
          acceptorAddress: '',
          initiatorTokenType: 'NONE',
          initiatorERCContract: ethers.constants.AddressZero,
          initiatorTokenQuantity: '',
          initiatorETHPortion: '',
          acceptorTokenType: 'NONE',
          acceptorERCContract: ethers.constants.AddressZero,
          acceptorTokenQuantity: '',
          acceptorETHPortion: '',
          initiatorTokenId: '',
          acceptorTokenId: '',
          modalMessage: `Swap successfully initiated! Your Swap ID is ${parseInt(swapIdHex, 16)}`,
        });
        setCurrentPage('swapList');
      } else {
        throw new Error('Swap ID not found in receipt');
      }
    } catch (error) {
      console.error('Error initiating Swap:', error);
      const reason = parseErrorReason(error);
      setFormState(prevState => ({ ...prevState, modalMessage: `Error initiating Swap. ${reason}` }));
    }
  };

  const handleCompleteSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract || !contractAddress) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected, contract not found, or unsupported network.' }));
      return;
    }
  
    if ((chainId === MAINNET_CHAIN_ID && contractAddress !== MAINNET_CONTRACT_ADDRESS) ||
        (chainId === SEPOLIA_CHAIN_ID && contractAddress !== SEPOLIA_CONTRACT_ADDRESS)) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Please switch to the correct network for this contract.' }));
      return;
    }
  
    try {
      const parsedData = parseSwapData(swapData);
  
      let ethPortion;
      if (BigNumber.isBigNumber(swapData.acceptorETHPortion)) {
        ethPortion = swapData.acceptorETHPortion;
      } else if (typeof swapData.acceptorETHPortion === 'string') {
        ethPortion = ethers.utils.parseEther(swapData.acceptorETHPortion);
      } else {
        ethPortion = ethers.BigNumber.from(0);
      }
  
      await swapContract.call('completeSwap', [swapId, parsedData], {
        value: ethPortion,
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
      const reason = parseErrorReason(error);
      setFormState(prevState => ({ ...prevState, modalMessage: `Error completing swap. ${reason}` }));
    }
  };
  

  // Handles removing a swap
  const handleRemoveSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract || !contractAddress) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected, contract not found, or unsupported network.' }));
      return;
    }
  
    if ((chainId === MAINNET_CHAIN_ID && contractAddress !== MAINNET_CONTRACT_ADDRESS) ||
        (chainId === SEPOLIA_CHAIN_ID && contractAddress !== SEPOLIA_CONTRACT_ADDRESS)) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Please switch to the correct network for this contract.' }));
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
      const reason = parseErrorReason(error);
      setFormState(prevState => ({ ...prevState, modalMessage: `Error removing swap. ${reason}` }));
    }
  };

// Handles token approval
const handleApprove = async (swapId: number) => {
  const form = formState[swapId.toString()];
  const { approveContractAddress, approveTokenId, approveTokenQuantity } = form || {};

  if (!address || !approveContractAddress || !swapContract || !contractAddress) {
    setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected, contract not found, or unsupported network.' }));
    return;
  }

  if ((chainId === MAINNET_CHAIN_ID && contractAddress !== MAINNET_CONTRACT_ADDRESS) ||
      (chainId === SEPOLIA_CHAIN_ID && contractAddress !== SEPOLIA_CONTRACT_ADDRESS)) {
    setFormState(prevState => ({ ...prevState, modalMessage: 'Please switch to the correct network for this contract.' }));
    return;
  }

  try {
    const approveContract = new ethers.Contract(approveContractAddress, ['function approve(address, uint256)'], signer);
    
    let approvalAmount;

    if (approveTokenQuantity && parseInt(approveTokenQuantity) > 0) {
      approvalAmount = ethers.utils.parseUnits(approveTokenQuantity.toString(), 18);
    } else {
      approvalAmount = ethers.BigNumber.from(approveTokenId);
    }

    const tx = await approveContract.approve(contractAddress, approvalAmount);

    const provider = approveContract.provider;
    provider.once(tx.hash, () => {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Approval successful!' }));
    });
  } catch (error) {
    console.error('Error approving token:', error);
    setFormState(prevState => ({ ...prevState, modalMessage: 'Error approving token. Please try again.' }));
  }
};


  // Closes the modal
  const closeModal = () => {
    setShowModal(false);
    setFormState(prevState => ({ ...prevState, modalMessage: null }));
    setModalData(null);
  };

  // Shows details of a swap
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

  // Handles filter hover and click events
  const handleInitiatedSwapHover = () => {
    setShowInitiatedSwaps('initiated');
  };

  const handleInitiatedSwapClick = (filter: 'regular' | 'open') => {
    setInitiatedSwapFilter(filter);
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
              {address ? (
                <>
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
                  <li className="navItem">
                    <span className="wallet-address">
                      {abbreviateAddress(address)}
                    </span>
                  </li>
                  <li className="navItem">
                    <span className="network-info">
                      {chainId === MAINNET_CHAIN_ID ? 'Ethereum Mainnet' : 
                      chainId === SEPOLIA_CHAIN_ID ? 'Sepolia Testnet' : 
                      'Unsupported Network'}
                    </span>
                  </li>
                </>
              ) : (
                <li className="navItem">
                </li>
              )}
            </ul>
          </nav>
        </header>
        <div className="main-content">
          {currentPage === 'initSwap' && (
            <section id="initSwap" style={{ textAlign: 'center', marginBottom: '1em' }}>
              <div>
                {!address && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <h3 style={{ textAlign: 'center', marginBottom: '1em' }}>Connect Your Wallet</h3>
                    <ConnectWallet />
                  </div>
                )}
                {address && (
                  <div>
                    <h3>Enter Swap Information</h3>
                    <p>As the initiator, provide the following information:</p>
                    <div className="guide-grid">
                      <div>
                        <h4>Initiator Information:</h4>
                        <div className="form-group">
                          <label htmlFor="initiatorTokenType">Initiator&apos;s Token Type:</label>
                          <select
                            name="initiatorTokenType"
                            value={formState.initiatorTokenType || 'NONE'}
                            onChange={(e) => {
                              const tokenType = e.target.value;
                              const ercContract = tokenType === 'NONE' ? ethers.constants.AddressZero : '';
                              setFormState({ ...formState, initiatorTokenType: tokenType, initiatorERCContract: ercContract });
                            }}
                          >
                            <option value="NONE">None</option>
                            <option value="ERC20">ERC20</option>
                            <option value="ERC777">ERC777</option>
                            <option value="ERC721">ERC721</option>
                            <option value="ERC1155">ERC1155</option>
                          </select>
                        </div>
                        {formState.initiatorTokenType !== 'NONE' && (
                          <>
                            <div className="form-group">
                              <label htmlFor="initiatorERCContract">Initiator&apos;s Token Contract Address:</label>
                              <input
                                type="text"
                                name="initiatorERCContract"
                                placeholder="Initiator&apos;s Token Contract Address"
                                value={formState.initiatorERCContract || ''}
                                onChange={(e) => handleERCContractChange(e.target.value, 'initiator')}
                              />
                            </div>
                            {formState.initiatorTokenType === 'ERC20' || formState.initiatorTokenType === 'ERC777' ? (
                              <>
                                <div className="form-group">
                                  <label htmlFor="initiatorTokenQuantity">Initiator&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="initiatorTokenQuantity"
                                    placeholder="Initiator&apos;s Token Quantity"
                                    value={formState.initiatorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'initiator')}
                                  />
                                </div>
                                {formState.initiatorTokenQuantity && (
                                  <div className="token-info-box" style={{ border: '1px solid #ccc', padding: '8px', marginTop: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                                    <p><em>Token Decimals: {tokenDecimals['initiator']}</em></p>
                                    <p><em>Actual Token Value: {calculatedValue['initiator'] || 'N/A'}</em></p>
                                  </div>
                                )}
                              </>
                            ) : formState.initiatorTokenType === 'ERC721' ? (
                              <>
                                <div className="form-group">
                                  <label htmlFor="initiatorTokenId">Initiator&apos;s Token ID:</label>
                                  <input
                                    type="text"
                                    name="initiatorTokenId"
                                    placeholder="Initiator&apos;s Token ID"
                                    value={formState.initiatorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, initiatorTokenId: e.target.value })}
                                  />
                                </div>
                              </>
                            ) : formState.initiatorTokenType === 'ERC1155' && (
                              <>
                                <div className="form-group">
                                  <label htmlFor="initiatorTokenId">Initiator&apos;s Token ID:</label>
                                  <input
                                    type="text"
                                    name="initiatorTokenId"
                                    placeholder="Initiator&apos;s Token ID"
                                    value={formState.initiatorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, initiatorTokenId: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label htmlFor="initiatorTokenQuantity">Initiator&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="initiatorTokenQuantity"
                                    placeholder="Initiator&apos;s Token Quantity"
                                    value={formState.initiatorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'initiator')}
                                  />
                                </div>
                              </>
                            )}
                          </>
                        )}
                        <div className="form-group">
                          <label htmlFor="initiatorETHPortion">Initiator&apos;s ETH Portion:</label>
                          <input
                            type="text"
                            name="initiatorETHPortion"
                            placeholder="Initiator&apos;s ETH Portion"
                            value={formState.initiatorETHPortion || ''}
                            onChange={(e) => setFormState({ ...formState, initiatorETHPortion: e.target.value })}
                          />
                        </div>
                        {formState.initiatorETHPortion && (
                          <div className="token-info-box" style={{ border: '1px solid #ccc', padding: '8px', marginTop: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                            <p><em>Wei: {ethers.utils.parseEther(formState.initiatorETHPortion).toString()}</em></p>
                            <p><em>Gwei: {ethers.utils.parseUnits(formState.initiatorETHPortion, 'gwei').toString()}</em></p>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4>Acceptor Information:</h4>
                        <div className="form-group">
                          <label htmlFor="acceptorAddress">Acceptor&apos;s Wallet Address:</label>
                          <input
                            type="text"
                            name="acceptorAddress"
                            placeholder="Acceptor&apos;s Wallet Address"
                            value={formState.acceptorAddress || ''}
                            onChange={(e) => setFormState({ ...formState, acceptorAddress: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="acceptorTokenType">Acceptor&apos;s Token Type:</label>
                          <select
                            name="acceptorTokenType"
                            value={formState.acceptorTokenType || 'NONE'}
                            onChange={(e) => {
                              const tokenType = e.target.value;
                              const ercContract = tokenType === 'NONE' ? ethers.constants.AddressZero : '';
                              setFormState({ ...formState, acceptorTokenType: tokenType, acceptorERCContract: ercContract });
                            }}
                          >
                            <option value="NONE">None</option>
                            <option value="ERC20">ERC20</option>
                            <option value="ERC777">ERC777</option>
                            <option value="ERC721">ERC721</option>
                            <option value="ERC1155">ERC1155</option>
                          </select>
                        </div>
                        {formState.acceptorTokenType !== 'NONE' && (
                          <>
                            <div className="form-group">
                              <label htmlFor="acceptorERCContract">Acceptor&apos;s Token Contract Address:</label>
                              <input
                                type="text"
                                name="acceptorERCContract"
                                placeholder="Acceptor&apos;s Token Contract Address"
                                value={formState.acceptorERCContract || ''}
                                onChange={(e) => handleERCContractChange(e.target.value, 'acceptor')}
                              />
                            </div>
                            {formState.acceptorTokenType === 'ERC20' || formState.acceptorTokenType === 'ERC777' ? (
                              <>
                                <div className="form-group">
                                  <label htmlFor="acceptorTokenQuantity">Acceptor&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="acceptorTokenQuantity"
                                    placeholder="Acceptor&apos;s Token Quantity"
                                    value={formState.acceptorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'acceptor')}
                                  />
                                </div>
                                {formState.acceptorTokenQuantity && (
                                  <div className="token-info-box" style={{ border: '1px solid #ccc', padding: '8px', marginTop: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                                    <p><em>Token Decimals: {tokenDecimals['acceptor']}</em></p>
                                    <p><em>Actual Token Value: {calculatedValue['acceptor'] || 'N/A'}</em></p>
                                  </div>
                                )}
                              </>
                            ) : formState.acceptorTokenType === 'ERC721' ? (
                              <>
                                <div className="form-group">
                                  <label htmlFor="acceptorTokenId">Acceptor&apos;s Token ID:</label>
                                  <input
                                    type="text"
                                    name="acceptorTokenId"
                                    placeholder="Acceptor&apos;s Token ID"
                                    value={formState.acceptorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, acceptorTokenId: e.target.value })}
                                  />
                                </div>
                              </>
                            ) : formState.acceptorTokenType === 'ERC1155' && (
                              <>
                                <div className="form-group">
                                  <label htmlFor="acceptorTokenId">Acceptor&apos;s Token ID:</label>
                                  <input
                                    type="text"
                                    name="acceptorTokenId"
                                    placeholder="Acceptor&apos;s Token ID"
                                    value={formState.acceptorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, acceptorTokenId: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label htmlFor="acceptorTokenQuantity">Acceptor&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="acceptorTokenQuantity"
                                    placeholder="Acceptor&apos;s Token Quantity"
                                    value={formState.acceptorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'acceptor')}
                                  />
                                </div>
                              </>
                            )}
                          </>
                        )}
                        <div className="form-group">
                          <label htmlFor="acceptorETHPortion">Acceptor&apos;s ETH Portion:</label>
                          <input
                            type="text"
                            name="acceptorETHPortion"
                            placeholder="Acceptor&apos;s ETH Portion"
                            value={formState.acceptorETHPortion || ''}
                            onChange={(e) => setFormState({ ...formState, acceptorETHPortion: e.target.value })}
                          />
                        </div>
                        {formState.acceptorETHPortion && (
                          <div className="token-info-box" style={{ border: '1px solid #ccc', padding: '8px', marginTop: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                            <p><em>Wei: {ethers.utils.parseEther(formState.acceptorETHPortion).toString()}</em></p>
                            <p><em>Gwei: {ethers.utils.parseUnits(formState.acceptorETHPortion, 'gwei').toString()}</em></p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Web3Button
                      className="button"
                      contractAddress={contractAddress}
                      action={handleSwap}
                      isDisabled={!address}
                    >
                      Initiate Swap
                    </Web3Button>
                  </div>
                )}
              </div>
            </section>
          )}
          {currentPage === 'swapList' && (
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
                        handleInitiatedSwapClick('regular'); // Default to regular swaps on click
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
                              .map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, false, false, handleViewDetails))
                          )
                        ) : (
                          initiatedTransactions
                            .filter(tx => tx.data.swap.acceptor === '0x0000000000000000000000000000000000000000')
                            .map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, false, false, handleViewDetails))
                        )}
                      </>
                    )}
                    {showInitiatedSwaps === 'toAccept' && (toAcceptTransactions.length === 0 ? (
                      <p>No transactions found.</p>
                    ) : (
                      toAcceptTransactions.map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, false, false, handleViewDetails))
                    ))}
                    {showInitiatedSwaps === 'open' && (openTransactions.length === 0 ? (
                      <p>No transactions found.</p>
                    ) : (
                      openTransactions.map(tx => renderSwapBox(tx, formState, address, handleApprove, handleCompleteSwap, handleRemoveSwap, false, false, handleViewDetails))
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
            <p><strong>Initiator&apos;s Contract Address:</strong> {modalData.initiatorTokenType === 0 ? 'N/A (None)' : modalData.initiatorERCContract}</p>
            <p><strong>Acceptor&apos;s Contract Address:</strong> {modalData.acceptorTokenType === 0 ? 'N/A (None)' : modalData.acceptorERCContract}</p>
            <p><strong>Initiator Token ID:</strong> {modalData.initiatorTokenType === 0 ? 'N/A (None)' : modalData.initiatorTokenId}</p>
            <p><strong>Acceptor Token ID:</strong> {modalData.acceptorTokenType === 0 ? 'N/A (None)' : modalData.acceptorTokenId}</p>
            <p><strong>Initiator Token Quantity:</strong> {modalData.initiatorTokenType === 0 ? 'N/A (None)' : modalData.initiatorTokenQuantity}</p>
            <p><strong>Acceptor Token Quantity:</strong> {modalData.acceptorTokenType === 0 ? 'N/A (None)' : modalData.acceptorTokenQuantity}</p>
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
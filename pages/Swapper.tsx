import { NextPage } from 'next';
import { Web3Button, ConnectWallet, useAddress, useContract, useSigner } from '@thirdweb-dev/react';
import { useState, useEffect, useCallback } from 'react';
import { CONTRACT_ADDRESS } from '../const/addresses';
import styles from '../styles/Home.module.css';
import Modal from './components/Modal';
import { BigNumber, ethers } from 'ethers';

// Map token type names to corresponding enum values
const tokenTypeMap: Record<string, number> = {
  ETH: 0,
  ERC20: 1,
  ERC777: 2,
  ERC721: 3,
  ERC1155: 4,
};

// Convert token type enum value to its name
const tokenTypeEnumToName = (enumValue: number): string =>
  Object.keys(tokenTypeMap).find(key => tokenTypeMap[key] === enumValue) || 'Unknown';

// Abbreviate Ethereum address
const abbreviateAddress = (address: string) =>
  address ? `${address.substring(0, 8)}...${address.substring(address.length - 4)}` : '';

// Fetch the name of a contract using its address
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

// Fetch the status of a swap
const fetchSwapStatus = async (swapContract: any, swapId: number, swapData: any) => {
  try {
    const swapStatus = await swapContract.call('getSwapStatus', [swapId, swapData]);
    const { initiatorTokenRequiresApproval, acceptorTokenRequiresApproval, isReadyForSwapping, initiatorNeedsToOwnToken, acceptorNeedsToOwnToken } = swapStatus;

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

// Fetch the status for open swaps
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

// Render a Web3Button with given action and text
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

// Render balance required for a swap
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
          return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS);
        }

        if (swapStatus === 'Ready') {
          return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS);
        }

        return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS);
      }

      if (swapStatus === 'Not Ready' && swapReason === 'Initiator does not own the token specified in the swap') {
        return null;
      }

      if (acceptor === '0x0000000000000000000000000000000000000000') {
        return (
          <>
            {renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', tx.data.swap.acceptorERCContract)}
            {swapStatus === 'Ready' && renderWeb3Button(() => handleCompleteSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Complete Swap', CONTRACT_ADDRESS)}
          </>
        );
      }
    } else {
      if (swapReason.includes('not own')) {
        if (initiator === address) {
          return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS);
        }
        return null;
      }

      if (initiator === address) {
        if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'Initiator must approve token')) {
          return (
            <>
              {renderWeb3Button(() => handleApprove(tx.data.swapId), 'Approve Token', tx.data.swap.initiatorERCContract)}
              {renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS)}
            </>
          );
        }

        if (swapStatus === 'Not Ready' || (swapStatus === 'Partially Ready' && swapReason === 'Acceptor must approve token')) {
          return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS);
        }

        if (swapStatus === 'Ready') {
          return renderWeb3Button(() => handleRemoveSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Remove Swap', CONTRACT_ADDRESS);
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
          return renderWeb3Button(() => handleCompleteSwap(parseInt(tx.data.swapId.toString()), tx.data.swap), 'Complete Swap', CONTRACT_ADDRESS);
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

// Enhanced error handling function to map specific Solidity errors to readable messages
const parseErrorReason = (error: any) => {
  const reason = error?.data?.message || error?.message || '';

  // Map specific error messages to human-readable reasons
  if (reason.includes('ZeroAddressDisallowed')) return 'ZeroAddressDisallowed  Triggered if the acceptor address is the zero address (0x0000000000000000000000000000000000000000) and the acceptorTokenType is not ERC20 or ERC777.';
  if (reason.includes('InitiatorNotMatched')) return 'InitiatorNotMatched  Triggered if the msg.sender does not match the _swap.initiator during the initiation of a swap.';
  if (reason.includes('InitiatorEthPortionNotMatched')) return 'InitiatorEthPortionNotMatched  Triggered if the msg.value does not match _swap.initiatorETHPortion during the initiation of a swap.';
  if (reason.includes('TwoWayEthPortionsDisallowed')) return 'TwoWayEthPortionsDisallowed  Triggered if both the initiator and the acceptor attempt to include an ETH portion in the swap, which is not allowed.';
  if (reason.includes('SwapCompleteOrDoesNotExist')) return 'SwapCompleteOrDoesNotExist  Triggered if the swap with the given _swapId does not exist or has already been completed.';
  if (reason.includes('NotAcceptor')) return 'NotAcceptor  Triggered if msg.sender is not the acceptor address specified in the swap.';
  if (reason.includes('IncorrectOrMissingAcceptorETH')) return 'IncorrectOrMissingAcceptorETH  Triggered if the ETH portion sent by the acceptor (msg.value) does not match the expected _swap.acceptorETHPortion.';
  if (reason.includes('NotInitiator')) return 'NotInitiator  Triggered if msg.sender is not the initiator of the swap when trying to remove a swap.';
  if (reason.includes('EmptyWithdrawDisallowed')) return 'EmptyWithdrawDisallowed  Triggered if the withdraw function is called and the caller (msg.sender) has a zero balance.';
  if (reason.includes('ZeroAddressSetForValidTokenType')) return 'ZeroAddressSetForValidTokenType  Triggered during validation if an ERC20, ERC721, or ERC1155 contract address is set to the zero address (0x0000000000000000000000000000000000000000).';
  if (reason.includes('TokenQuantityMissing')) return 'TokenQuantityMissing  Triggered during validation if the token quantity for an ERC20 or ERC1155 swap is set to zero.';
  if (reason.includes('TokenIdMissing')) return 'TokenIdMissing  Triggered during validation if the token ID for an ERC721 or ERC1155 swap is set to zero.';
  if (reason.includes('ValueOrTokenMissing')) return 'ValueOrTokenMissing  Triggered during validation if both the ETH portion and the token information are missing for a swap.';
  if (reason.includes('TokenTransferFailed')) return 'TokenTransferFailed  Triggered if the transfer of an ERC20 token fails.';
  if (reason.includes('NoReentry')) return 'NoReentry  Triggered if a reentrant call is detected.';
  if (reason.includes('ETHSendingFailed')) return 'ETHSendingFailed  Triggered if the contract fails to send ETH to the msg.sender during withdrawal.';

  // General Solidity Errors
  if (reason.includes('user rejected transaction')) return 'User rejected the transaction';
  if (reason.includes('out of gas')) return 'Out of Gas  Occurs if a transaction runs out of gas before completion.';
  if (reason.includes('invalid opcode')) return 'Invalid Opcode  Occurs if the EVM encounters an invalid operation code.';
  if (reason.includes('stack too deep')) return 'Stack Too Deep  Occurs if there are too many local variables within a single function or in the contract scope.';
  if (reason.includes('revert')) return 'Revert  Occurs when the contract explicitly triggers a revert without a custom error message.';
  if (reason.includes('assert')) return 'Assert  Occurs when an assert statement fails; this typically indicates a bug.';

  // Insufficient Funds or Permissions
  if (reason.includes('insufficient funds for gas * price + value')) return 'Insufficient Funds  Triggered if the sender does not have enough ETH to cover the gas cost and the value being sent.';
  if (reason.includes('ERC721: transfer caller is not owner nor approved')) return 'ERC721: Transfer Caller is Not Owner Nor Approved  Triggered if a non-owner or non-approved party attempts to transfer an ERC721 token.';
  if (reason.includes('ERC20: transfer amount exceeds balance')) return 'ERC20: Transfer Amount Exceeds Balance  Triggered if the sender\'s balance is insufficient for the ERC20 token transfer.';
  if (reason.includes('ERC20: transfer amount exceeds allowance')) return 'ERC20: Transfer Amount Exceeds Allowance  Triggered if the sender\'s allowance is insufficient for the ERC20 token transfer.';
  if (reason.includes('ERC1155: insufficient balance for transfer')) return 'ERC1155: Insufficient Balance for Transfer  Triggered if the sender’s balance is insufficient for the ERC1155 token transfer.';

  // Contract Deployment and Interaction Errors
  if (reason.includes('constructor out of gas')) return 'Constructor Out of Gas  Occurs if the contract\'s constructor runs out of gas during deployment.';
  if (reason.includes('unknown contract')) return 'Unknown Contract  Triggered when interacting with a contract at an address that does not have any contract deployed.';
  if (reason.includes('execution reverted')) return 'Execution Reverted  A general error message indicating that the transaction was reverted due to any of the above reasons or other unforeseen issues.';

  // Default fallback
  return 'An unknown error occurred. Please try again.';
};

// Main component for the token swapper
const Swapper: NextPage = () => {
  const address = useAddress();
  const { contract: swapContract } = useContract(CONTRACT_ADDRESS);
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

  // Fetch token decimals and set calculated value
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

  // Handle changes in ERC contract
  const handleERCContractChange = async (value: string, side: 'initiator' | 'acceptor') => {
    setFormState(prevState => ({ ...prevState, [`${side}ERCContract`]: value }));
    if (value) {
      await fetchTokenDecimals(value, side);
    } else {
      setTokenDecimals(prevDecimals => ({ ...prevDecimals, [side]: 0 }));
      setCalculatedValue(prevValues => ({ ...prevValues, [side]: '' }));
    }
  };

  // Handle changes in token quantity
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

  // Fetch all swap transactions
  const fetchTransactions = useCallback(async () => {
    if (swapContract && signer && address) {
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
    }
  }, [swapContract, signer, address]);

  // Periodically fetch transactions
  useEffect(() => {
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  // Fetch transactions when the user connects their wallet
  useEffect(() => {
    if (address) {
      fetchTransactions();
    }
  }, [address, fetchTransactions]);

  // Fetch token decimals when contract addresses change
  useEffect(() => {
    if (formState.initiatorERCContract) fetchTokenDecimals(formState.initiatorERCContract, 'initiator');
    if (formState.acceptorERCContract) fetchTokenDecimals(formState.acceptorERCContract, 'acceptor');
  }, [formState.initiatorERCContract, formState.acceptorERCContract, fetchTokenDecimals]);

  // Map token type name to its enum value
  const mapTokenTypeToEnum = (tokenType: string): number => tokenTypeMap[tokenType] || 0;

  // Parse swap data to be passed to the contract
  const parseSwapData = (data: any[]): any[] =>
    data.map(value => {
      if (typeof value === 'string' && value.startsWith('0x')) return value;
      if (BigNumber.isBigNumber(value)) return value.toString();
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseInt(value, 10);
      return value;
    });

  // Handle initiating a new swap
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

    if (!address || !swapContract) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected or contract not found.' }));
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
    if (!address || !swapContract) {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Wallet not connected or contract not found.' }));
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
  

  // Handle removing a swap
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
      const reason = parseErrorReason(error);
      setFormState(prevState => ({ ...prevState, modalMessage: `Error removing swap. ${reason}` }));
    }
  };

// Handle token approval
const handleApprove = async (swapId: number) => {
  const form = formState[swapId.toString()];
  const { approveContractAddress, approveTokenId, approveTokenQuantity } = form || {};

  if (!address || !approveContractAddress) {
    setFormState(prevState => ({
      ...prevState,
      modalMessage: 'Wallet not connected or approval contract not found.',
    }));
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

    const tx = await approveContract.approve(CONTRACT_ADDRESS, approvalAmount);

    const provider = approveContract.provider;
    provider.once(tx.hash, () => {
      setFormState(prevState => ({ ...prevState, modalMessage: 'Approval successful!' }));
    });
  } catch (error) {
    console.error('Error approving token:', error);
    setFormState(prevState => ({ ...prevState, modalMessage: 'Error approving token. Please try again.' }));
  }
};


  // Close the modal
  const closeModal = () => {
    setShowModal(false);
    setFormState(prevState => ({ ...prevState, modalMessage: null }));
    setModalData(null);
  };

  // Show details of a swap
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

  // Handle filter hover and click events
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
                            <p><em>Token Decimals: 18</em></p>
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
                            <p><em>Token Decimals: 18</em></p>
                            <p><em>Wei: {ethers.utils.parseEther(formState.acceptorETHPortion).toString()}</em></p>
                            <p><em>Gwei: {ethers.utils.parseUnits(formState.acceptorETHPortion, 'gwei').toString()}</em></p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Web3Button
                      className="button"
                      contractAddress={CONTRACT_ADDRESS}
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
                  <div className="initiated-swap-wrapper" style={{ display: 'inline-block', position: 'relative' }}>
                      <button
                        className={`toggle-button ${showInitiatedSwaps === 'initiated' ? 'active' : ''}`}
                        onClick={() => {
                          setShowInitiatedSwaps('initiated');
                          handleInitiatedSwapClick('regular'); // Default to regular swaps on click
                        }}
                      >
                        Initiated Swaps
                      </button>
                      {showInitiatedSwaps === 'initiated' && (
                        <div className="initiated-swap-filters" style={{ display: 'flex', position: 'absolute', top: 0, left: '100%' }}>
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
                      )}
                    </div>
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
                      initiatedSwapFilter === 'regular' ? (
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
                      )
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
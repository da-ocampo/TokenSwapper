import { useRef, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Maps token type names to corresponding enum values
export const tokenTypeMap: Record<string, number> = {
  ETH: 0,
  ERC20: 1,
  ERC777: 2,
  ERC721: 3,
  ERC1155: 4,
};

// Converts token type enum value to its name
export const tokenTypeEnumToName = (enumValue: number): string =>
  Object.keys(tokenTypeMap).find(key => tokenTypeMap[key] === enumValue) || 'Unknown';

// Maps token type name to its enum value
export const mapTokenTypeToEnum = (tokenType: string): number => tokenTypeMap[tokenType] || 0;
  
// Abbreviates Ethereum address
export const abbreviateAddress = (address: string) =>
  address ? `${address.substring(0, 8)}...${address.substring(address.length - 4)}` : '';

// Enhanced error handling function that maps specific Solidity errors to human-readable messages
export const parseErrorReason = (error: any) => {
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

// Hook to handle date input blur effect
export const useDateInputBlur = () => {
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateInputRef.current && !dateInputRef.current.contains(event.target as Node)) {
        dateInputRef.current.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return dateInputRef;
};

export const verifyConversion = (weiValue: string, decimals: number): string => {
  try {
    return ethers.utils.formatUnits(weiValue, decimals);
  } catch (error) {
    return 'Invalid conversion';
  }
};

// Hook to fetch token decimals and calculate token value
export const useFetchTokenDecimals = (formState: any, signer: ethers.Signer | undefined, setTokenDecimals: React.Dispatch<React.SetStateAction<Record<string, number>>>, setCalculatedValue: React.Dispatch<React.SetStateAction<Record<string, string>>>) => {
  return useCallback(async (contractAddress: string, side: 'initiator' | 'acceptor') => {
    const tokenType = formState[`${side}TokenType`];

    if (tokenType === 'ERC20' || tokenType === 'ERC777' || tokenType === 'ERC1155') {
      if (signer) {
        try {
          const contract = new ethers.Contract(
            contractAddress, 
            ['function decimals() view returns (uint8)'], 
            signer
          );
          const decimals = await contract.decimals();
          setTokenDecimals((prevDecimals: Record<string, number>) => ({ ...prevDecimals, [side]: decimals }));

          const quantity = formState[`${side}TokenQuantity`];
          if (quantity) {
            const value = ethers.utils.formatUnits(quantity, decimals);
            setCalculatedValue((prevValues: Record<string, string>) => ({ ...prevValues, [side]: value }));
          } else {
            setCalculatedValue((prevValues: Record<string, string>) => ({ ...prevValues, [side]: '' }));
          }
        } catch (error) {
          console.log(`No decimals found for ${contractAddress}, using raw values`);
          // If decimals() fails, use raw values without decimal conversion
          setTokenDecimals((prevDecimals: Record<string, number>) => ({ ...prevDecimals, [side]: 0 }));
          setCalculatedValue((prevValues: Record<string, string>) => ({ 
            ...prevValues, 
            [side]: formState[`${side}TokenQuantity`] || '' 
          }));
        }
      }
    } else {
      // For other token types or if no signer
      setTokenDecimals((prevDecimals: Record<string, number>) => ({ ...prevDecimals, [side]: 0 }));
      setCalculatedValue((prevValues: Record<string, string>) => ({ ...prevValues, [side]: '' }));
    }
  }, [formState, signer, setTokenDecimals, setCalculatedValue]);
};

// Function to handle ERC contract changes
export const handleERCContractChange = async (
  value: string,
  side: 'initiator' | 'acceptor',
  setFormState: React.Dispatch<React.SetStateAction<any>>,
  fetchTokenDecimals: (contractAddress: string, side: 'initiator' | 'acceptor') => Promise<void>,
  setTokenDecimals: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  setCalculatedValue: React.Dispatch<React.SetStateAction<Record<string, string>>>
) => {
  setFormState((prevState: any) => ({ ...prevState, [`${side}ERCContract`]: value }));
  if (value) {
    await fetchTokenDecimals(value, side);
  } else {
    setTokenDecimals((prevDecimals: Record<string, number>) => ({ ...prevDecimals, [side]: 0 }));
    setCalculatedValue((prevValues: Record<string, string>) => ({ ...prevValues, [side]: '' }));
  }
};

// Function to validate if a string is a valid number
export const isValidNumber = (value: string) => {
  return /^\d*\.?\d*$/.test(value);
};

// Function to handle token quantity changes
export const handleTokenQuantityChange = (
  value: string,
  side: 'initiator' | 'acceptor',
  setFormState: React.Dispatch<React.SetStateAction<any>>,
  tokenDecimals: Record<string, number>,
  setCalculatedValue: React.Dispatch<React.SetStateAction<Record<string, string>>>
) => {
  if (isValidNumber(value)) {
    setFormState((prevState: any) => ({ ...prevState, [`${side}TokenQuantity`]: value }));
    
    const decimals = tokenDecimals[side];
    if (decimals > 0) {
      // Only apply decimal conversion if decimals exist and are greater than 0
      try {
        const parsedValue = ethers.utils.parseUnits(value, decimals);
        setCalculatedValue((prevValues: Record<string, string>) => ({ 
          ...prevValues, 
          [side]: parsedValue.toString()
        }));
      } catch (error) {
        console.error('Error parsing value with decimals:', error);
        setCalculatedValue((prevValues: Record<string, string>) => ({ 
          ...prevValues, 
          [side]: value 
        }));
      }
    } else {
      // Use raw value if no decimals or decimals is 0
      setCalculatedValue((prevValues: Record<string, string>) => ({ 
        ...prevValues, 
        [side]: value
      }));
    }
  }
};

// Function to handle ETH portion changes
export const handleETHPortionChange = (
  value: string,
  side: 'initiator' | 'acceptor',
  setFormState: React.Dispatch<React.SetStateAction<any>>
) => {
  if (isValidNumber(value)) {
    setFormState((prevState: any) => ({ ...prevState, [`${side}ETHPortion`]: value }));
  }
};

// Hook to fetch token decimals when contract addresses change
export const useFetchTokenDecimalsEffect = (
  formState: any,
  fetchTokenDecimals: any
) => {
  useEffect(() => {
    if (formState.initiatorERCContract) fetchTokenDecimals(formState.initiatorERCContract, 'initiator');
    if (formState.acceptorERCContract) fetchTokenDecimals(formState.acceptorERCContract, 'acceptor');
  }, [formState.initiatorERCContract, formState.acceptorERCContract, fetchTokenDecimals]);
};

export const handleSwapDetailsView = (
  swapData: any, 
  tokenDecimals: { [key: string]: number }, 
  setModalData: (data: any) => void,
  setShowModal: (show: boolean) => void
) => {
  const handleTokenQuantity = (quantity: any, tokenType: number, decimals: number) => {
    if (!quantity) return '0';
    
    // For ERC1155 (type 4), if no decimals, use raw value
    if (tokenType === 4 && decimals === 0) {
      return ethers.BigNumber.isBigNumber(quantity) ? quantity.toString() : quantity;
    }

    // For ERC20 (type 1) and ERC777 (type 2), always format with decimals
    if ((tokenType === 1 || tokenType === 2) && ethers.BigNumber.isBigNumber(quantity)) {
      const formatted = ethers.utils.formatUnits(quantity, decimals);
      // Remove trailing zeros after decimal point
      return formatted.replace(/\.?0+$/, '');
    }

    // For all other cases
    return ethers.BigNumber.isBigNumber(quantity) 
      ? quantity.toString() 
      : quantity;
  };

  const parsedData = {
    ...swapData,
    initiatorTokenId: ethers.BigNumber.isBigNumber(swapData.initiatorTokenId) 
      ? swapData.initiatorTokenId.toString() 
      : swapData.initiatorTokenId,
    acceptorTokenId: ethers.BigNumber.isBigNumber(swapData.acceptorTokenId) 
      ? swapData.acceptorTokenId.toString() 
      : swapData.acceptorTokenId,
    initiatorTokenQuantity: handleTokenQuantity(
      swapData.initiatorTokenQuantity,
      swapData.initiatorTokenType,
      tokenDecimals['initiator'] || 18
    ),
    acceptorTokenQuantity: handleTokenQuantity(
      swapData.acceptorTokenQuantity,
      swapData.acceptorTokenType,
      tokenDecimals['acceptor'] || 18
    ),
    initiatorETHPortion: ethers.BigNumber.isBigNumber(swapData.initiatorETHPortion) 
      ? ethers.utils.formatEther(swapData.initiatorETHPortion) 
      : swapData.initiatorETHPortion,
    acceptorETHPortion: ethers.BigNumber.isBigNumber(swapData.acceptorETHPortion) 
      ? ethers.utils.formatEther(swapData.acceptorETHPortion) 
      : swapData.acceptorETHPortion,
    expiryDate: new Date(swapData.expiryDate * 1000).toLocaleString(),
  };
  
  setModalData(parsedData);
  setShowModal(true);
};

export const handleOpenSwapChange = (
  isChecked: boolean, 
  formState: any,
  setFormState: (state: any) => void,
  showModalMessage?: (message: string) => void
) => {
  const newAddress = isChecked ? '0x0000000000000000000000000000000000000000' : '';
  const currentTokenType = formState.acceptorTokenType;
  
  // If switching to open swap and current token type is ERC721, show warning
  if (isChecked && currentTokenType === 'ERC721' && showModalMessage) {
    showModalMessage('Open swaps cannot accept ERC721 tokens. Token type will be reset.');
  }
  
  setFormState({
    ...formState,
    acceptorAddress: newAddress,
    acceptorTokenType: isChecked && currentTokenType === 'ERC721' ? 'NONE' : currentTokenType
  });
};
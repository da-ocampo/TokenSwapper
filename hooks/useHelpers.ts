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
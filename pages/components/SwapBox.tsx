import { Web3Button } from '@thirdweb-dev/react';
import { ethers } from 'ethers';
import { abbreviateAddress, parseErrorReason } from '../../hooks/useHelpers';

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
  if (tx?.data?.swap?.acceptor === '0x0000000000000000000000000000000000000000') {
    const { acceptorTokenQuantity, acceptorETHPortion } = tx.data.swap;
    const acceptorContractName = tx.acceptorContractName || 'Token';

    let requiredInfo = '';

    // Format token quantity without decimals if it's a whole number
    if (acceptorTokenQuantity) {
      const formattedTokenQuantity = ethers.utils.formatUnits(acceptorTokenQuantity.toString(), 18);
      requiredInfo += `Required: ${formattedTokenQuantity.includes('.') && !formattedTokenQuantity.endsWith('.0') ? formattedTokenQuantity : parseFloat(formattedTokenQuantity)} ${acceptorContractName}`;
    }

    // Format ETH portion if present
    if (acceptorETHPortion) {
      const formattedEthPortion = ethers.utils.formatEther(acceptorETHPortion.toString());
      requiredInfo += requiredInfo ? ` and ${formattedEthPortion} ETH` : `Required: ${formattedEthPortion} ETH`;
    }

    return <p><strong>{requiredInfo}</strong></p>;
  }
  return null;
};

const isSwapExpired = (expiryDate: number) => {
  return expiryDate < Math.floor(Date.now() / 1000);
};

// Render the swap box UI component
const SwapBox = ({
  tx,
  formState,
  address,
  swapContract,
  signer,
  isCompleted = false,
  isRemoved = false,
  handleViewDetails,
  contractAddress,
  setFormState
}: {
  tx: any;
  formState: any;
  address: string;
  swapContract: any;
  signer: any;
  isCompleted?: boolean;
  isRemoved?: boolean;
  handleViewDetails: (swapData: any) => void;
  contractAddress: string;
  setFormState: (state: any) => void;
}) => {
  // Check if tx is defined and has necessary properties
  if (!tx || !tx.data || !tx.data.swap) {
    return null; // or return a loading state, or some placeholder content
  }

  const swapStatus = isCompleted ? 'Complete' : isRemoved ? 'Removed' : tx.swapStatus || 'Unknown';
  const dotClass = isCompleted ? 'complete' : isRemoved ? 'removed' : tx.dotClass || 'unknown';
  const isExpired = isSwapExpired(tx.data.swap.expiryDate);

  const handleApprove = async (swapId: number) => {
    const form = formState[swapId.toString()];
    const { approveContractAddress, approveTokenId, approveTokenQuantity } = form || {};

    if (!address || !approveContractAddress || !swapContract || !contractAddress) {
      setFormState((prevState: any) => ({ ...prevState, modalMessage: 'Wallet not connected, contract not found, or unsupported network.' }));
      return;
    }

    try {
      const approveContract = new ethers.Contract(approveContractAddress, [
        'function approve(address, uint256)',
        'function decimals() view returns (uint8)'
      ], signer);
      
      let approvalAmount;

      if (approveTokenQuantity && parseInt(approveTokenQuantity) > 0) {
        try {
          const decimals = await approveContract.decimals();
          approvalAmount = ethers.BigNumber.from(approveTokenQuantity);
        } catch (error) {
          console.error('Error getting token decimals:', error);
          approvalAmount = ethers.BigNumber.from(approveTokenQuantity);
        }
      } else {
        approvalAmount = ethers.BigNumber.from(approveTokenId || '0');
      }

      console.log('Approval amount:', approvalAmount.toString());

      const tx = await approveContract.approve(contractAddress, approvalAmount);

      const provider = approveContract.provider;
      provider.once(tx.hash, () => {
        setFormState((prevState: any) => ({ ...prevState, modalMessage: 'Approval successful!' }));
      });
    } catch (error) {
      console.error('Error approving token:', error);
      const reason = parseErrorReason(error);
      setFormState((prevState: any) => ({ ...prevState, modalMessage: `Error approving token. ${reason}` }));
    }
  };

  const handleCompleteSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract || !contractAddress) {
      setFormState((prevState: any) => ({ ...prevState, modalMessage: 'Wallet not connected, contract not found, or unsupported network.' }));
      return;
    }
  
    try {
      const parsedData = parseSwapData(swapData);
  
      let ethPortion;
      if (ethers.BigNumber.isBigNumber(swapData.acceptorETHPortion)) {
        ethPortion = swapData.acceptorETHPortion;
      } else if (typeof swapData.acceptorETHPortion === 'string') {
        ethPortion = ethers.utils.parseEther(swapData.acceptorETHPortion);
      } else {
        ethPortion = ethers.BigNumber.from(0);
      }
  
      await swapContract.call('completeSwap', [swapId, parsedData], {
        value: ethPortion,
      });
  
      setFormState((prevState: any) => ({
        ...prevState,
        modalMessage: `Swap with ID ${swapId} has been completed.`,
      }));
    } catch (error) {
      console.error('Error completing swap:', error);
      const reason = parseErrorReason(error);
      setFormState((prevState: any) => ({ ...prevState, modalMessage: `Error completing swap. ${reason}` }));
    }
  };

  const handleRemoveSwap = async (swapId: number, swapData: any) => {
    if (!address || !swapContract || !contractAddress) {
      setFormState((prevState: any) => ({ ...prevState, modalMessage: 'Wallet not connected, contract not found, or unsupported network.' }));
      return;
    }

    try {
      const parsedData = parseSwapData(swapData);
      await swapContract.call('removeSwap', [swapId, parsedData]);
      setFormState((prevState: any) => ({
        ...prevState,
        modalMessage: `Swap with ID ${swapId} has been removed.`,
      }));
    } catch (error) {
      console.error('Error removing swap:', error);
      const reason = parseErrorReason(error);
      setFormState((prevState: any) => ({ ...prevState, modalMessage: `Error removing swap. ${reason}` }));
    }
  };

  const parseSwapData = (data: any[]): any[] =>
    data.map(value => {
      if (typeof value === 'string' && value.startsWith('0x')) return value;
      if (ethers.BigNumber.isBigNumber(value)) return value.toString();
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseInt(value, 10);
      return value;
    });

  const renderActionButton = () => {
    const { swapStatus, swapReason, data: { swap: { initiator, acceptor } } } = tx;

    if (isExpired) {
      return null;
    }

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
      if (swapReason?.includes('not own')) {
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
      <div key={tx.data.swapId} className={`swapBox ${isExpired ? 'expired' : ''}`}>
        <div className="swapContent">
          <p style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{tx.initiatorContractName || 'Unknown'} ↔ {tx.acceptorContractName || 'Unknown'}</strong>
            <span onClick={() => handleViewDetails(tx.data.swap)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Show Details</span>
          </p>
          <p><strong>{tx.swapType || 'Unknown'}</strong></p>
          <p><strong>Swap ID:</strong> {tx.data.swapId.toString()}</p>
          <p>
            {tx.data.swap.acceptor === '0x0000000000000000000000000000000000000000' 
              ? `Initiated by ${initiatorAddress}` 
              : `${initiatorAddress} ↔ ${acceptorAddress}`
            }
          </p>
          <p>
            <span className={`status-dot ${dotClass}`}></span>
            <em><strong>{swapStatus}
            {swapStatus === 'Partially Ready' && <em>, {tx.swapReason}</em>}
            {swapStatus === 'Not Ready' && <em>, {tx.swapReason}</em>}</strong></em>
          </p>
          {renderRequiredInfo(tx)}
        </div>
  
        <p><strong>{isExpired ? "Expired:" : "Expires:"}</strong> {new Date(tx.data.swap.expiryDate * 1000).toLocaleString()}</p>
  
        {!isCompleted && !isRemoved && !isExpired && (
          <div className="swapActions">
            {renderActionButton()}
          </div>
        )}
      </div>
    );
  };
  
  export default SwapBox;
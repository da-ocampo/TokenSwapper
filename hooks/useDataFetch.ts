import { ethers } from 'ethers';

const contractNameCache: { [address: string]: string } = {};

// Fetches the status of a swap
export const fetchSwapStatus = async (swapContract: any, swapId: number, swapData: any) => {
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
export const fetchInitiatorStatusForOpenSwap = async (swapContract: any, swapId: number, swapData: any) => {
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

// Fetches the name of a contract using its address
export const fetchContractName = async (contractAddress: string, signer: any) => {
    // If address is zero address, return ETH
    if (contractAddress === ethers.constants.AddressZero) {
        return "ETH";
    }

    // Check cache first
    if (contractNameCache[contractAddress]) {
        return contractNameCache[contractAddress];
    }

    // If we have no signer, return unknown
    if (!signer) {
        return "Name Unknown";
    }

    try {
        const contract = new ethers.Contract(
            contractAddress, 
            ['function name() view returns (string)'], 
            signer
        );
        
        // Try to fetch the name with a timeout
        const name = await Promise.race([
            contract.name(),
            new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
            )
        ]);

        // Cache the result
        contractNameCache[contractAddress] = name;
        return name;
    } catch (error) {
        // Cache the failure to prevent repeated attempts
        contractNameCache[contractAddress] = 'Name Unknown';
        return 'Name Unknown';
    }
};

// Export the cache in case we need to clear it
export const clearContractNameCache = () => {
    Object.keys(contractNameCache).forEach(key => delete contractNameCache[key]);
};
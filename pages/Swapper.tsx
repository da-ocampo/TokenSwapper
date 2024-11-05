import { NextPage } from 'next';
import { Web3Button, ConnectWallet, useAddress, useContract, useSigner, useChainId } from '@thirdweb-dev/react';
import { useState, useEffect } from 'react';
import { 
  MAINNET_CONTRACT_ADDRESS, 
  SEPOLIA_CONTRACT_ADDRESS, 
  MAINNET_CHAIN_ID, 
  SEPOLIA_CHAIN_ID,
  LINEA_MAINNET_ADDRESS,
  LINEA_TESTNET_ADDRESS,
  LINEA_MAINNET_CHAIN_ID,
  LINEA_TESTNET_CHAIN_ID
} from '../const/constants';
import styles from '../styles/Home.module.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Modal from './components/Modal';
import Disclaimer from './components/Disclaimer';
import Privacy from './components/Privacy';
import SwapList from './SwapList';
import Wallet from './Wallet';
import { ethers } from 'ethers';
import { 
  mapTokenTypeToEnum, 
  parseErrorReason, 
  tokenTypeEnumToName,
  useDateInputBlur,
  useFetchTokenDecimals,
  handleERCContractChange,
  handleTokenQuantityChange,
  handleETHPortionChange,
  useFetchTokenDecimalsEffect,
  verifyConversion
} from '../hooks/useHelpers';
import { fetchContractName } from '../hooks/useDataFetch';

// Main component for the token swapper
const Swapper: NextPage = () => {
  const address = useAddress();
  const chainId = useChainId();
  const [contractAddress, setContractAddress] = useState<string>('');
  const { contract: swapContract } = useContract(contractAddress ? contractAddress : undefined);
  const signer = useSigner();
  const [formState, setFormState] = useState<Record<string, any>>({
    acceptorAddress: '',
    initiatorTokenType: 'NONE',
    initiatorERCContract: ethers.constants.AddressZero,
    acceptorTokenType: 'NONE',
    acceptorERCContract: ethers.constants.AddressZero,
    expiryDate: '',
    initiatorTokenQuantity: '',
    acceptorTokenQuantity: '',
    initiatorETHPortion: '',
    acceptorETHPortion: '',
    initiatorTokenId: '',
    acceptorTokenId: ''
  });
  const [currentPage, setCurrentPage] = useState<'initSwap' | 'swapList' | 'wallet' | 'disclaimer' | 'privacy'>('swapList');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalData, setModalData] = useState<any>(null);
  const [tokenDecimals, setTokenDecimals] = useState<{ [key: string]: number }>({});
  const [calculatedValue, setCalculatedValue] = useState<{ [key: string]: string }>({});
  const [contractNames, setContractNames] = useState<{ [key: string]: string }>({});
  const dateInputRef = useDateInputBlur();
  const fetchTokenDecimals = useFetchTokenDecimals(formState, signer, setTokenDecimals, setCalculatedValue);
  useFetchTokenDecimalsEffect(formState, fetchTokenDecimals);

  useEffect(() => {
    if (chainId) {
      if (chainId === MAINNET_CHAIN_ID) {
        console.log('Mainnet chain detected, using MAINNET_CONTRACT_ADDRESS');
        setContractAddress(MAINNET_CONTRACT_ADDRESS);
      } else if (chainId === SEPOLIA_CHAIN_ID) {
        console.log('Sepolia chain detected, using SEPOLIA_CONTRACT_ADDRESS');
        setContractAddress(SEPOLIA_CONTRACT_ADDRESS);
      } else if (chainId === LINEA_MAINNET_CHAIN_ID) {
        console.log('Linea Mainnet chain detected, using LINEA_MAINNET_ADDRESS');
        setContractAddress(LINEA_MAINNET_ADDRESS);
      } else if (chainId === LINEA_TESTNET_CHAIN_ID) {
        console.log('Linea Sepolia chain detected, using LINEA_TESTNET_ADDRESS');
        setContractAddress(LINEA_TESTNET_ADDRESS);
      } else {
        console.log('Unsupported chain detected, contract address is cleared');
        setContractAddress('');
      }
    }
  }, [chainId]);

  useEffect(() => {
    if (contractAddress) {
      console.log(`Contract address updated: ${contractAddress}`);
    }
  }, [contractAddress]);

  useEffect(() => {
    const fetchNames = async () => {
      if (formState.initiatorERCContract) {
        const name = await fetchContractName(formState.initiatorERCContract, signer);
        setContractNames(prev => ({ ...prev, initiator: name }));
      }
      if (formState.acceptorERCContract) {
        const name = await fetchContractName(formState.acceptorERCContract, signer);
        setContractNames(prev => ({ ...prev, acceptor: name }));
      }
    };

    if (signer) {
      fetchNames();
    }
  }, [formState.initiatorERCContract, formState.acceptorERCContract, signer]);

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
      expiryDate,
    } = formState;

    if (!address || !swapContract || !contractAddress) {
      setFormState(prevState => ({ 
        ...prevState, 
        modalMessage: 'Wallet not connected, contract not found, or unsupported network.' 
      }));
      return;
    }
  
    if ((chainId === MAINNET_CHAIN_ID && contractAddress !== MAINNET_CONTRACT_ADDRESS) ||
        (chainId === SEPOLIA_CHAIN_ID && contractAddress !== SEPOLIA_CONTRACT_ADDRESS) ||
        (chainId === LINEA_MAINNET_CHAIN_ID && contractAddress !== LINEA_MAINNET_ADDRESS) ||
        (chainId === LINEA_TESTNET_CHAIN_ID && contractAddress !== LINEA_TESTNET_ADDRESS)) {
      setFormState(prevState => ({ 
        ...prevState, 
        modalMessage: 'Please switch to the correct network for this contract.' 
      }));
      return;
    }

    const finalAcceptorAddress = acceptorAddress || '0x0000000000000000000000000000000000000000';

    try {
      // Get token decimals for both parties
      const initiatorTokenDecimals = tokenDecimals['initiator'] || 18;
      const acceptorTokenDecimals = tokenDecimals['acceptor'] || 18;

      let parsedInitiatorQuantity = '0';
      let parsedAcceptorQuantity = '0';

      // Parse quantities based on token type
      if (initiatorTokenQuantity && initiatorTokenQuantity !== '0') {
        if (initiatorTokenType === 'ERC1155') {
          parsedInitiatorQuantity = initiatorTokenQuantity; // Use raw value for ERC1155
        } else if (initiatorTokenType === 'ERC20' || initiatorTokenType === 'ERC777') {
          parsedInitiatorQuantity = ethers.utils
            .parseUnits(initiatorTokenQuantity, initiatorTokenDecimals)
            .toString();
        }
      }

      if (acceptorTokenQuantity && acceptorTokenQuantity !== '0') {
        if (acceptorTokenType === 'ERC1155') {
          parsedAcceptorQuantity = acceptorTokenQuantity; // Use raw value for ERC1155
        } else if (acceptorTokenType === 'ERC20' || acceptorTokenType === 'ERC777') {
          parsedAcceptorQuantity = ethers.utils
            .parseUnits(acceptorTokenQuantity, acceptorTokenDecimals)
            .toString();
        }
      }

      const tx = await swapContract.call('initiateSwap', [
        {
          initiator: address,
          acceptor: finalAcceptorAddress,
          initiatorTokenType: mapTokenTypeToEnum(initiatorTokenType),
          initiatorERCContract: initiatorTokenType === 'NONE' ? ethers.constants.AddressZero : initiatorERCContract,
          initiatorTokenId: parseInt(initiatorTokenId) || 0,
          initiatorTokenQuantity: parsedInitiatorQuantity,
          initiatorETHPortion: ethers.utils.parseEther(initiatorETHPortion || '0'),
          acceptorTokenType: mapTokenTypeToEnum(acceptorTokenType),
          acceptorERCContract: acceptorTokenType === 'NONE' ? ethers.constants.AddressZero : acceptorERCContract,
          acceptorTokenId: parseInt(acceptorTokenId) || 0,
          acceptorTokenQuantity: parsedAcceptorQuantity,
          acceptorETHPortion: ethers.utils.parseEther(acceptorETHPortion || '0'),
          expiryDate: Math.floor(new Date(expiryDate).getTime() / 1000),
        },
      ], {
        value: ethers.utils.parseEther(initiatorETHPortion || '0'),
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
          expiryDate: '',
          modalMessage: `Swap successfully initiated! Your Swap ID is ${parseInt(swapIdHex, 16)}`,
        });
        setCurrentPage('swapList');
      } else {
        throw new Error('Swap ID not found in receipt');
      }
    } catch (error) {
      console.error('Error initiating Swap:', error);
      const reason = parseErrorReason(error);
      setFormState(prevState => ({ 
        ...prevState, 
        modalMessage: `Error initiating Swap. ${reason}` 
      }));
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormState(prevState => ({ ...prevState, modalMessage: null }));
    setModalData(null);
  };

  const handleViewDetails = (swapData: any) => {
    const initiatorTokenDecimals = tokenDecimals['initiator'] || 18;
    const acceptorTokenDecimals = tokenDecimals['acceptor'] || 18;

    const parsedData = {
      ...swapData,
      initiatorTokenId: ethers.BigNumber.isBigNumber(swapData.initiatorTokenId) 
        ? swapData.initiatorTokenId.toString() 
        : swapData.initiatorTokenId,
      acceptorTokenId: ethers.BigNumber.isBigNumber(swapData.acceptorTokenId) 
        ? swapData.acceptorTokenId.toString() 
        : swapData.acceptorTokenId,
      initiatorTokenQuantity: ethers.BigNumber.isBigNumber(swapData.initiatorTokenQuantity) 
        ? ethers.utils.formatUnits(swapData.initiatorTokenQuantity, initiatorTokenDecimals)
        : swapData.initiatorTokenQuantity,
      acceptorTokenQuantity: ethers.BigNumber.isBigNumber(swapData.acceptorTokenQuantity) 
        ? ethers.utils.formatUnits(swapData.acceptorTokenQuantity, acceptorTokenDecimals)
        : swapData.acceptorTokenQuantity,
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

  return (
    <div className={styles.main}>
      <div className="app-box">
        <Header 
          address={address}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          chainId={chainId}
        />
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
                    <p style={{ fontSize: '0.85em', fontStyle: 'italic', color: 'rgba(0, 0, 0, 0.7)', marginBottom: '1em' }}>
                      By using this site you acknowledge you have read and understand the{' '}
                      <a
                        onClick={() => setCurrentPage('disclaimer')}
                        style={{ 
                          display: 'inline', 
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          color: 'inherit'
                        }}
                      >
                        disclaimer/terms of use
                      </a>.
                    </p>
                    <p>As the initiator, provide the following information:</p>
                    <div className="form-grid">
                      <div className='form-box'>
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
                                placeholder="Initiator's Token Contract Address"
                                value={formState.initiatorERCContract || ''}
                                onChange={(e) => handleERCContractChange(e.target.value, 'initiator', setFormState, fetchTokenDecimals, setTokenDecimals, setCalculatedValue)}
                              />
                            </div>
                            {formState.initiatorTokenType === 'ERC20' || formState.initiatorTokenType === 'ERC777' ? (
                              <>
                                <div className="form-group">
                                  <label htmlFor="initiatorTokenQuantity">Initiator&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="initiatorTokenQuantity"
                                    placeholder="Initiator's Token Quantity"
                                    value={formState.initiatorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'initiator', setFormState, tokenDecimals, setCalculatedValue)}
                                  />
                                </div>
                                {formState.initiatorTokenQuantity && (
                                  <div className="token-info-box" style={{ 
                                    border: '1px solid #ccc', 
                                    padding: '12px', 
                                    marginTop: '8px', 
                                    borderRadius: '4px', 
                                    backgroundColor: '#f9f9f9', 
                                    textAlign: 'left' 
                                  }}>
                                    <p><strong>Contract:</strong> <em>{contractNames['initiator'] || 'Loading...'}</em></p>
                                    <p><strong>Token Decimals:</strong> <em>{tokenDecimals['initiator'] || 18}</em></p>
                                    <p><strong>Entered Amount:</strong> <em>{formState.initiatorTokenQuantity}</em></p>
                                    <p><strong>Contract Value (Wei):</strong> <em>
                                      {ethers.utils.parseUnits(
                                        formState.initiatorTokenQuantity || '0',
                                        tokenDecimals['initiator'] || 18
                                      ).toString()}
                                    </em></p>
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
                                    placeholder="Initiator's Token ID"
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
                                    placeholder="Initiator's Token ID"
                                    value={formState.initiatorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, initiatorTokenId: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label htmlFor="initiatorTokenQuantity">Initiator&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="initiatorTokenQuantity"
                                    placeholder="Initiator's Token Quantity"
                                    value={formState.initiatorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'initiator', setFormState, tokenDecimals, setCalculatedValue)}
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
                            placeholder="Initiator's ETH Portion"
                            value={formState.initiatorETHPortion || ''}
                            onChange={(e) => handleETHPortionChange(e.target.value, 'initiator', setFormState)}
                          />
                        </div>
                        {formState.initiatorETHPortion && (
                          <div className="token-info-box" style={{ border: '1px solid #ccc', padding: '8px', marginTop: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9', textAlign: 'left' }}>
                            <p><strong>Entered Amount:</strong> <em>{formState.initiatorETHPortion}</em></p>
                            <p><em><strong>Wei Value:</strong> {ethers.utils.parseEther(formState.initiatorETHPortion).toString()}</em></p>
                            <p><em><strong>Gwei Value:</strong> {ethers.utils.parseUnits(formState.initiatorETHPortion, 'gwei').toString()}</em></p>
                          </div>
                        )}
                        <div className="form-group">
                          <label htmlFor="expiryDate">Expiry Date:</label>
                          <input
                            type="datetime-local"
                            name="expiryDate"
                            value={formState.expiryDate}
                            onChange={(e) => setFormState({ ...formState, expiryDate: e.target.value })}
                            min={new Date().toISOString().slice(0, 16)}
                            ref={dateInputRef}
                          />
                        </div>
                      </div>
                      <div className='form-box'>
                        <h4>Acceptor Information:</h4>
                        <div className="form-group">
                          <label htmlFor="acceptorAddress">Acceptor&apos;s Wallet Address:</label>
                          <input
                            type="text"
                            name="acceptorAddress"
                            placeholder="Acceptor's Wallet Address"
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
                                placeholder="Acceptor's Token Contract Address"
                                value={formState.acceptorERCContract || ''}
                                onChange={(e) => handleERCContractChange(e.target.value, 'acceptor', setFormState, fetchTokenDecimals, setTokenDecimals, setCalculatedValue)}
                              />
                            </div>
                            {formState.acceptorTokenType === 'ERC20' || formState.acceptorTokenType === 'ERC777' ? (
                              <>
                                <div className="form-group">
                                  <label htmlFor="acceptorTokenQuantity">Acceptor&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="acceptorTokenQuantity"
                                    placeholder="Acceptor's Token Quantity"
                                    value={formState.acceptorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'acceptor', setFormState, tokenDecimals, setCalculatedValue)}
                                  />
                                </div>
                                {formState.acceptorTokenQuantity && (
                                  <div className="token-info-box" style={{ 
                                    border: '1px solid #ccc', 
                                    padding: '12px', 
                                    marginTop: '8px', 
                                    borderRadius: '4px', 
                                    backgroundColor: '#f9f9f9', 
                                    textAlign: 'left' 
                                  }}>
                                    <p><strong>Contract:</strong> <em>{contractNames['acceptor'] || 'Loading...'}</em></p>
                                    <p><strong>Token Decimals:</strong> <em>{tokenDecimals['acceptor'] || 18}</em></p>
                                    <p><strong>Entered Amount:</strong> <em>{formState.acceptorTokenQuantity}</em></p>
                                    <p><strong>Contract Value (Wei):</strong> <em>
                                      {ethers.utils.parseUnits(
                                        formState.acceptorTokenQuantity || '0',
                                        tokenDecimals['acceptor'] || 18
                                      ).toString()}
                                    </em></p>
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
                                    placeholder="Acceptor's Token ID"
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
                                    placeholder="Acceptor's Token ID"
                                    value={formState.acceptorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, acceptorTokenId: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label htmlFor="acceptorTokenQuantity">Acceptor&apos;s Token Quantity:</label>
                                  <input
                                    type="text"
                                    name="acceptorTokenQuantity"
                                    placeholder="Acceptor's Token Quantity"
                                    value={formState.acceptorTokenQuantity || ''}
                                    onChange={(e) => handleTokenQuantityChange(e.target.value, 'acceptor', setFormState, tokenDecimals, setCalculatedValue)}
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
                            placeholder="Acceptor's ETH Portion"
                            value={formState.acceptorETHPortion || ''}
                            onChange={(e) => handleETHPortionChange(e.target.value, 'acceptor', setFormState)}
                          />
                        </div>
                        {formState.acceptorETHPortion && (
                          <div className="token-info-box" style={{ border: '1px solid #ccc', padding: '8px', marginTop: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9', textAlign: 'left' }}>
                            <p><strong>Entered Amount:</strong> <em>{formState.acceptorETHPortion}</em></p>
                            <p><em><strong>Wei Value:</strong> {ethers.utils.parseEther(formState.acceptorETHPortion).toString()}</em></p>
                            <p><em><strong>Gwei Value:</strong> {ethers.utils.parseUnits(formState.acceptorETHPortion, 'gwei').toString()}</em></p>
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
          {currentPage === 'wallet' && (
            <Wallet 
              contractAddress={contractAddress} 
              swapContract={swapContract}
              setFormState={setFormState}
            />
          )}
          {currentPage === 'swapList' && (
            <SwapList
              address={address}
              setCurrentPage={setCurrentPage}
              contractAddress={contractAddress}
              swapContract={swapContract}
              signer={signer}
              setFormState={setFormState}
              chainId={chainId}
              handleViewDetails={handleViewDetails}
            />
          )}
          {currentPage === 'disclaimer' && (
            <Disclaimer />
          )}
          {currentPage === 'privacy' && (
            <Privacy />
          )}
        </div>
        <Footer setCurrentPage={setCurrentPage} />
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
            <p><strong>Expiration Date:</strong> {modalData.expiryDate}</p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Swapper;
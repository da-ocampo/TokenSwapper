import { NextPage } from 'next';
import { Web3Button, ConnectWallet, useAddress, useContract, useSigner, useChainId } from '@thirdweb-dev/react';
import { useState, useEffect } from 'react';
import {
  CONTRACT_ADDRESS,
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
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
import SwapInfo from './components/SwapInfo';
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
  handleSwapDetailsView,
  handleOpenSwapChange
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
  const [currentPage, setCurrentPage] = useState<'initSwap' | 'swapList' | 'wallet' | 'disclaimer' | 'privacy' | 'swapInfo'>('initSwap');
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
      if ([MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID, LINEA_MAINNET_CHAIN_ID, LINEA_TESTNET_CHAIN_ID].includes(chainId)) {
        console.log(`Supported chain detected (${chainId}), using CONTRACT_ADDRESS`);
        setContractAddress(CONTRACT_ADDRESS);
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

    if (Math.floor(new Date(expiryDate).getTime() / 1000) < Math.floor(Date.now() / 1000)) {
      setFormState(prevState => ({
        ...prevState,
        modalMessage: 'Swap expiry date cannot be in the past'
      }));
      return;
    }

    if (initiatorTokenType === 'NONE' && acceptorTokenType === 'NONE') {
      setFormState(prevState => ({
        ...prevState,
        modalMessage: 'Cannot initiate a swap where both parties are only exchanging ETH'
      }));
      return;
    }

    if ((chainId && ![MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID, LINEA_MAINNET_CHAIN_ID, LINEA_TESTNET_CHAIN_ID].includes(chainId)) ||
      contractAddress !== CONTRACT_ADDRESS) {
      setFormState(prevState => ({
        ...prevState,
        modalMessage: 'Please switch to a supported network for this contract.'
      }));
      return;
    }

    const finalAcceptorAddress = acceptorAddress || '0x0000000000000000000000000000000000000000';

    try {
      // Get token decimals for both parties
      const initiatorTokenDecimals = tokenDecimals['initiator'] || 0;
      const acceptorTokenDecimals = tokenDecimals['acceptor'] || 0;

      let parsedInitiatorQuantity = '0';
      let parsedAcceptorQuantity = '0';

      // Parse quantities based on token type and decimals
      if (initiatorTokenQuantity && initiatorTokenQuantity !== '0') {
        if (initiatorTokenType === 'ERC1155') {
          // For ERC1155, check if we have decimals first
          if (initiatorTokenDecimals > 0) {
            parsedInitiatorQuantity = ethers.utils
              .parseUnits(initiatorTokenQuantity, initiatorTokenDecimals)
              .toString();
          } else {
            // Use raw value if no decimals
            parsedInitiatorQuantity = initiatorTokenQuantity;
          }
        } else if (initiatorTokenType === 'ERC20' || initiatorTokenType === 'ERC777') {
          parsedInitiatorQuantity = ethers.utils
            .parseUnits(initiatorTokenQuantity, initiatorTokenDecimals)
            .toString();
        }
      }

      if (acceptorTokenQuantity && acceptorTokenQuantity !== '0') {
        if (acceptorTokenType === 'ERC1155') {
          // For ERC1155, check if we have decimals first
          if (acceptorTokenDecimals > 0) {
            parsedAcceptorQuantity = ethers.utils
              .parseUnits(acceptorTokenQuantity, acceptorTokenDecimals)
              .toString();
          } else {
            // Use raw value if no decimals
            parsedAcceptorQuantity = acceptorTokenQuantity;
          }
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
    handleSwapDetailsView(swapData, tokenDecimals, setModalData, setShowModal);
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
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minHeight: '60vh',
                    justifyContent: 'center',
                    padding: '2em'
                  }}>
                    <h1
                      style={{
                        fontSize: '3.5rem',
                        fontWeight: 'bold',
                        background: 'linear-gradient(-45deg, #0066FF, #0052CC, #003D99, #0066FF)',
                        backgroundSize: '300% 300%',
                        animation: 'gradient 10s ease infinite',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: '0.5em'
                      }}
                    >
                      Welcome to P2PSwap
                    </h1>
                    <p style={{
                      color: '#2B3C5C',
                      fontSize: '1.1rem',
                      lineHeight: '1.6',
                      maxWidth: '800px',
                      textAlign: 'center',
                      marginBottom: '2em',
                      opacity: 0.9
                    }}>
                      P2PSwap enables peer-to-peer token exchanges with the security of an <i>impartial escrow contract</i>.<br></br><br></br>
                      If you would like to know more before connecting your wallet, Please see
                      <a
                        onClick={() => setCurrentPage('swapInfo')}
                        className="toggle-button"
                        style={{ padding: ".5em" }}
                      >more info on swapping.
                      </a><br></br><br></br>
                      Connect your wallet to access the swapping functionality where you can execute peer-to-peer token exchanges,
                      view your initiated swaps, manage swaps offered to you, and discover open swaps available for anyone to accept.<br></br>
                      
                    </p>
                    <div style={{ transform: 'scale(1.1)', transition: 'transform 0.3s ease' }}>
                      <ConnectWallet />
                    </div>
                  </div>
                )}
                {address && (
                  <div>
                    <h3>Enter Swap Information</h3>
                    <p>As the initiator, provide the following information:</p>
                    <p style={{ fontSize: '0.85em', fontStyle: 'italic', color: 'rgba(0, 0, 0, 0.7)' }}>
                      For more info on swapping{' '}
                      <a onClick={() => setCurrentPage('swapInfo')}
                        style={{
                          display: 'inline',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          color: 'inherit',
                        }}
                      >
                        see here
                      </a>.
                    </p>
                    <div className="form-grid">
                      <div className='form-box'>
                        <h4>Initiator Information:</h4>
                        <div className="form-group">
                          <label htmlFor="initiatorTokenType">Token Type:</label>
                          <select
                            name="initiatorTokenType"
                            value={formState.initiatorTokenType || 'NONE'}
                            onChange={(e) => {
                              const tokenType = e.target.value;
                              const ercContract = tokenType === 'NONE' ? ethers.constants.AddressZero : '';
                              setFormState({ ...formState, initiatorTokenType: tokenType, initiatorERCContract: ercContract });
                            }}
                          >
                            <option value="NONE">ETH Only</option>
                            <option value="ERC20">ERC20</option>
                            <option value="ERC777">ERC777</option>
                            <option value="ERC721">ERC721</option>
                            <option value="ERC1155">ERC1155</option>
                          </select>
                        </div>
                        {formState.initiatorTokenType !== 'NONE' && (
                          <>
                            <div className="form-group">
                              <label htmlFor="initiatorERCContract">Token Contract Address:</label>
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
                                  <label htmlFor="initiatorTokenQuantity">Token Quantity:</label>
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
                                  <label htmlFor="initiatorTokenId">Token ID:</label>
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
                                  <label htmlFor="initiatorTokenId">Token ID:</label>
                                  <input
                                    type="text"
                                    name="initiatorTokenId"
                                    placeholder="Initiator's Token ID"
                                    value={formState.initiatorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, initiatorTokenId: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label htmlFor="initiatorTokenQuantity">Token Quantity:</label>
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
                          {formState.acceptorETHPortion && formState.acceptorETHPortion !== '0' ? (
                            <div className="error-message" style={{ color: '#2B3C5C' }}>
                              ETH contribution not allowed when acceptor is contributing ETH
                            </div>
                          ) : (
                            <>
                              <label htmlFor="initiatorETHPortion">ETH Portion:</label>
                              <input
                                type="text"
                                name="initiatorETHPortion"
                                placeholder="Initiator's ETH Portion"
                                value={formState.initiatorETHPortion || ''}
                                onChange={(e) => handleETHPortionChange(e.target.value, 'initiator', setFormState)}
                              />
                            </>
                          )}
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
                        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <label>
                            Open Swap
                            <>
                              <span className="info-icon">?</span>
                              <div className="info-tooltip">
                                A swap where the acceptor address is set to the zero address means that the swap can be accepted by anyone.
                              </div>
                            </>
                          </label>
                          <input
                            type="checkbox"
                            checked={formState.acceptorAddress === '0x0000000000000000000000000000000000000000'}
                            onChange={(e) => {
                              handleOpenSwapChange(
                                e.target.checked,
                                formState,
                                setFormState,
                                (message) => setFormState(prev => ({ ...prev, modalMessage: message }))
                              );
                            }}
                          />
                        </div>
                        {formState.acceptorAddress !== '0x0000000000000000000000000000000000000000' && (
                          <div className="form-group">
                            <label htmlFor="acceptorAddress">Wallet Address:</label>
                            <input
                              type="text"
                              name="acceptorAddress"
                              placeholder="Acceptor's Wallet Address"
                              value={formState.acceptorAddress || ''}
                              onChange={(e) => setFormState({ ...formState, acceptorAddress: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="form-group">
                          <label htmlFor="acceptorTokenType">Token Type:</label>
                          <select
                            name="acceptorTokenType"
                            value={formState.acceptorTokenType || 'NONE'}
                            onChange={(e) => {
                              const tokenType = e.target.value;
                              const ercContract = tokenType === 'NONE' ? ethers.constants.AddressZero : '';

                              if (formState.acceptorAddress === '0x0000000000000000000000000000000000000000' &&
                                tokenType === 'ERC721') {
                                setFormState(prevState => ({
                                  ...prevState,
                                  modalMessage: 'Open swaps cannot accept ERC721 tokens. Please select a different token type or specify an acceptor address.'
                                }));
                                return;
                              }

                              setFormState({
                                ...formState,
                                acceptorTokenType: tokenType,
                                acceptorERCContract: tokenType === 'NONE' ? ethers.constants.AddressZero : formState.acceptorERCContract
                              });
                            }}
                          >
                            {formState.acceptorAddress === '0x0000000000000000000000000000000000000000' ? (
                              <>
                                <option value="NONE">ETH Only</option>
                                <option value="ERC20">ERC20</option>
                                <option value="ERC777">ERC777</option>
                                <option value="ERC1155">ERC1155</option>
                              </>
                            ) : (
                              <>
                                <option value="NONE">ETH Only</option>
                                <option value="ERC20">ERC20</option>
                                <option value="ERC777">ERC777</option>
                                <option value="ERC721">ERC721</option>
                                <option value="ERC1155">ERC1155</option>
                              </>
                            )}
                          </select>
                        </div>
                        {formState.acceptorTokenType !== 'NONE' && (
                          <>
                            <div className="form-group">
                              <label htmlFor="acceptorERCContract">Token Contract Address:</label>
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
                                  <label htmlFor="acceptorTokenQuantity">Token Quantity:</label>
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
                                  <label htmlFor="acceptorTokenId">Token ID:</label>
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
                                  <label htmlFor="acceptorTokenId">Token ID:</label>
                                  <input
                                    type="text"
                                    name="acceptorTokenId"
                                    placeholder="Acceptor's Token ID"
                                    value={formState.acceptorTokenId || ''}
                                    onChange={(e) => setFormState({ ...formState, acceptorTokenId: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label htmlFor="acceptorTokenQuantity">Token Quantity:</label>
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
                          {formState.initiatorETHPortion && formState.initiatorETHPortion !== '0' ? (
                            <div className="error-message" style={{ color: '#2B3C5C' }}>
                              ETH contribution not allowed when initiator is contributing ETH
                            </div>
                          ) : (
                            <>
                              <label htmlFor="acceptorETHPortion">ETH Portion:</label>
                              <input
                                type="text"
                                name="acceptorETHPortion"
                                placeholder="Acceptor's ETH Portion"
                                value={formState.acceptorETHPortion || ''}
                                onChange={(e) => handleETHPortionChange(e.target.value, 'acceptor', setFormState)}
                              />
                            </>
                          )}
                        </div>
                        {formState.acceptorETHPortion && formState.acceptorETHPortion !== '0' && (
                          <div className="token-info-box" style={{ border: '1px solid #ccc', padding: '8px', marginTop: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9', textAlign: 'left' }}>
                            <p><strong>Entered Amount:</strong> <em>{formState.acceptorETHPortion}</em></p>
                            <p><em><strong>Wei Value:</strong> {ethers.utils.parseEther(formState.acceptorETHPortion).toString()}</em></p>
                            <p><em><strong>Gwei Value:</strong> {ethers.utils.parseUnits(formState.acceptorETHPortion, 'gwei').toString()}</em></p>
                          </div>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '0.85em', fontStyle: 'italic', color: 'rgba(0, 0, 0, 0.7)', margin: '2em' }}>
                      By using this site you acknowledge you have read and understand the{' '}
                      <a
                        onClick={() => setCurrentPage('disclaimer')}
                        style={{
                          display: 'inline',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          color: 'inherit',
                        }}
                      >
                        disclaimer/terms of use
                      </a>.
                    </p>
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
          {currentPage === 'swapInfo' && (
            <SwapInfo />
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
            <p><strong>Contract Address:</strong> {modalData.initiatorTokenType === 0 ? 'N/A (None)' : modalData.initiatorERCContract}</p>
            <p><strong>Contract Address:</strong> {modalData.acceptorTokenType === 0 ? 'N/A (None)' : modalData.acceptorERCContract}</p>
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
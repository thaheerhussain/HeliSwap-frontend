import React, { useState, useEffect, useContext } from 'react';
import { hethers } from '@hashgraph/hethers';
import { ITokenData, ISwapTokenData, IPairData } from '../interfaces/tokens';
import { IStringToString } from '../interfaces/comon';
import { GlobalContext } from '../providers/Global';

import { useQuery } from '@apollo/client';
import { GET_TOKENS, GET_POOLS } from '../GraphQL/Queries';

import Button from '../components/Button';
import Loader from '../components/Loader';
import TokenInputSelector from '../components/TokenInputSelector';

import errorMessages from '../content/errors';
import { idToAddress } from '../utils/tokenUtils';
import { getConnectedWallet } from './Helpers';

const Swap = () => {
  const connectedWallet = getConnectedWallet();
  const contextValue = useContext(GlobalContext);
  const { connection, sdk } = contextValue;
  const { userId, hashconnectConnectorInstance } = connection;

  const initialSwapData: ISwapTokenData = {
    tokenIdIn: '',
    tokenIdOut: '',
    amountIn: '',
    amountOut: '',
  };

  const { loading: loadingPools, data: dataPool } = useQuery(GET_POOLS);
  const { error: errorGT, loading: loadingTokens, data: dataTokens } = useQuery(GET_TOKENS);

  const [poolsData, setPoolsData] = useState<IPairData[]>([]);
  const [tokenDataList, setTokenDataList] = useState<ITokenData[]>([]);
  const [selectedPoolData, setSelectedPoolData] = useState<IPairData>({} as IPairData);

  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [poolReserves, setPoolReserves] = useState({ tokenIn: '0', tokenOut: '0' });

  const [swapData, setSwapData] = useState(initialSwapData);

  //to be removed
  const [pairDataContracts, setPairDataContracts] = useState({
    balance: '0.0',
    totalSupply: '0.0',
    token0: '0.0',
    token1: '0.0',
  });

  //To be removed
  const getPairDataContracts = async () => {
    if (connectedWallet) {
      const userAddress = idToAddress(userId);
      const balanceBN = await sdk.checkBalance(
        selectedPoolData.pairAddress,
        userAddress,
        connectedWallet,
      );
      const totalSupplyBN = await sdk.getTotalSupply(selectedPoolData.pairAddress, connectedWallet);
      const [token0BN, token1BN] = await sdk.getReserves(
        selectedPoolData.pairAddress,
        connectedWallet,
      );

      const balanceStr = hethers.utils.formatUnits(balanceBN, 18);
      const totalSupplyStr = hethers.utils.formatUnits(totalSupplyBN, 18);
      const token0Str = hethers.utils.formatUnits(token0BN, 18);
      const token1Str = hethers.utils.formatUnits(token1BN, 18);

      const balanceNum = Number(balanceStr);

      if (balanceNum > 0) {
        setPairDataContracts({
          balance: balanceStr,
          totalSupply: totalSupplyStr,
          token0: token0Str,
          token1: token1Str,
        });
      }

      setPoolReserves({ tokenIn: token0BN.toString(), tokenOut: token1BN.toString() });
    }
  };

  // currently using the data comming from the contract itself until BE is ready
  async function onInputChange(tokenData: IStringToString) {
    const { tokenIdIn, amountIn, tokenIdOut, amountOut } = tokenData;
    //Use these amounts instead of poolReserves after BE is ready
    // const { token0Amount, token1Amount } = selectedPoolData;
    if (Object.keys(selectedPoolData).length === 0) return;

    if (tokenIdIn) {
      const swapAmountOut = sdk.getSwapAmountOut(
        amountIn,
        poolReserves.tokenIn,
        poolReserves.tokenOut,
      );

      setSwapData(prev => ({ ...prev, ...tokenData, amountOut: swapAmountOut.toString() }));
    } else if (tokenIdOut) {
      const swapAmountIn = sdk.getSwapAmountIn(
        amountOut,
        poolReserves.tokenIn,
        poolReserves.tokenOut,
      );

      setSwapData(prev => ({ ...prev, ...tokenData, amountIn: swapAmountIn.toString() }));
    }
  }

  function onSelectChange(tokenData: IStringToString) {
    setSwapData(prev => ({ ...prev, ...tokenData }));
  }

  async function handleSwapClick() {
    const { tokenIdIn, tokenIdOut, amountIn, amountOut } = swapData;

    try {
      const receipt = await sdk.swapTokens(
        hashconnectConnectorInstance,
        userId,
        tokenIdIn,
        tokenIdOut,
        amountIn,
        amountOut,
      );

      const {
        response: { success, error },
      } = receipt;

      if (!success) {
        setError(true);
        setErrorMessage(error);
      } else {
        setSwapData(initialSwapData);
      }
    } catch (err) {
      console.error(`[Error on swap]: ${err}`);
      setError(true);
    } finally {
    }
  }

  useEffect(() => {
    if (dataPool) {
      const { pools } = dataPool;
      pools.length > 0 && setPoolsData(pools);
    }
  }, [dataPool]);

  useEffect(() => {
    if (dataTokens) {
      const { getTokensData } = dataTokens;
      getTokensData.length > 0 && setTokenDataList(getTokensData);
    }
  }, [dataTokens]);

  useEffect(() => {
    if (swapData.tokenIdIn && swapData.tokenIdOut && poolsData.length > 0) {
      const tokenInAddress = idToAddress(swapData.tokenIdIn);
      const tokenOutAddress = idToAddress(swapData.tokenIdOut);

      const selectedPoolData = poolsData.filter((pool: any) => {
        return (
          //Both tokens are in the same pool
          (pool.token0 === tokenInAddress || pool.token1 === tokenInAddress) &&
          (pool.token0 === tokenOutAddress || pool.token1 === tokenOutAddress)
        );
      });

      setSelectedPoolData(selectedPoolData[0]);
    } else {
      setSelectedPoolData({} as IPairData);
    }
  }, [poolsData, swapData]);

  useEffect(() => {
    if (tokenDataList.length > 0 && !swapData.tokenIdIn && !swapData.tokenIdOut) {
      setSwapData({
        ...swapData,
        //Set the first token to the first one in the token list. This will be probably set to WHBAR in future
        tokenIdIn: tokenDataList[0].hederaId,
      });
    }
  }, [tokenDataList, swapData]);

  return (
    <div className="d-flex justify-content-center">
      <div className="container-swap">
        {errorGT ? (
          <div className="alert alert-danger mb-5" role="alert">
            <strong>Something went wrong!</strong> Cannot get pairs...
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-danger my-5" role="alert">
            <strong>Something went wrong!</strong>
            <p>{errorMessages[errorMessage]}</p>
          </div>
        ) : null}

        <div className="d-flex justify-content-between">
          <span className="badge bg-primary text-uppercase">From</span>
          <span></span>
        </div>

        <TokenInputSelector
          inputValue={swapData.amountIn}
          selectValue={swapData.tokenIdIn}
          inputName="amountIn"
          selectName="tokenIdIn"
          tokenDataList={tokenDataList}
          onInputChange={onInputChange}
          onSelectChange={onSelectChange}
        />

        <div className="d-flex justify-content-between mt-5">
          <span className="badge bg-info text-uppercase">To</span>
          <span></span>
        </div>

        <TokenInputSelector
          inputValue={swapData.amountOut}
          selectValue={swapData.tokenIdOut}
          inputName="amountOut"
          selectName="tokenIdOut"
          tokenDataList={tokenDataList}
          onInputChange={onInputChange}
          onSelectChange={onSelectChange}
        />

        <div className="mt-5 d-flex justify-content-center">
          {loadingTokens || loadingPools ? (
            <Loader />
          ) : (
            <Button onClick={() => handleSwapClick()}>Swap</Button>
          )}
        </div>
        {/* TO BE removed */}
        {connectedWallet ? (
          <div className="p-4 rounded border border-primary mt-5">
            <Button onClick={getPairDataContracts}>Show contract data</Button>
            <p className="mt-4">User LP tokens:</p>
            <p className="text-title">{pairDataContracts.balance}</p>
            <p className="mt-3">LP total supply:</p>
            <p className="text-title">{pairDataContracts.totalSupply}</p>
            <div className="row mt-3">
              <div className="col-6">
                <p>Token0:</p>
                <p className="text-title">{pairDataContracts.token0}</p>
              </div>
              <div className="col-6">
                <p>Token1:</p>
                <p className="text-title">{pairDataContracts.token1}</p>
              </div>
            </div>
          </div>
        ) : (
          <Button onClick={getPairDataContracts}>Show contract data</Button>
        )}
      </div>
    </div>
  );
};

export default Swap;

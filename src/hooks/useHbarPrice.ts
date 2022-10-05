import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { BALLANCE_FETCH_INTERVAL } from '../constants';

const useHbarPrice = () => {
  const [hbarPrice, setHbarPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const getHBARPrice = useCallback(async () => {
    setLoading(true);
    const coingeckoURL = process.env.REACT_APP_COINGECKO_URL + `/simple/price`;
    try {
      const response = await axios.get(coingeckoURL, {
        params: {
          ids: 'hedera-hashgraph',
          vs_currencies: 'usd',
        },
      });

      setHbarPrice(response.status === 200 ? response.data['hedera-hashgraph']['usd'] : hbarPrice);
    } catch (e) {
      console.error(e);
      setHbarPrice(hbarPrice);
    } finally {
      setLoading(false);
    }
  }, [hbarPrice]);

  useEffect(() => {
    getHBARPrice();

    const fetchInterval = setInterval(() => {
      getHBARPrice();
    }, BALLANCE_FETCH_INTERVAL);
    return () => {
      clearInterval(fetchInterval);
    };
  }, [getHBARPrice]);

  return { hbarPrice, loading };
};

export default useHbarPrice;

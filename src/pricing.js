const CG_BASE = 'https://api.coingecko.com/api/v3';

async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/** Native ETH + SOL price in USD. Returns null for a coin if lookup fails
 *  (caller must treat as "unknown", never silently substitute 0). */
export async function getNativePrices() {
  const data = await safeFetchJson(
    `${CG_BASE}/simple/price?ids=ethereum,solana&vs_currencies=usd`
  );
  return {
    ethereum: data?.ethereum?.usd ?? null,
    solana: data?.solana?.usd ?? null,
  };
}

/** contractAddresses: string[] (lowercase). Returns { [address]: priceUsd | null } */
export async function getEthTokenPrices(contractAddresses) {
  const result = {};
  for (const addr of contractAddresses) result[addr] = null;
  if (contractAddresses.length === 0) return result;

  const data = await safeFetchJson(
    `${CG_BASE}/simple/token_price/ethereum?contract_addresses=${contractAddresses.join(',')}&vs_currencies=usd`
  );
  if (!data) return result;
  for (const addr of contractAddresses) {
    result[addr] = data[addr]?.usd ?? null;
  }
  return result;
}

/** mintAddresses: string[]. Returns { [mint]: priceUsd | null } */
export async function getSolTokenPrices(mintAddresses) {
  const result = {};
  for (const mint of mintAddresses) result[mint] = null;
  if (mintAddresses.length === 0) return result;

  const data = await safeFetchJson(
    `${CG_BASE}/simple/token_price/solana?contract_addresses=${mintAddresses.join(',')}&vs_currencies=usd`
  );
  if (!data) return result;
  for (const mint of mintAddresses) {
    result[mint] = data[mint]?.usd ?? null;
  }
  return result;
}

/**
 * Fallback for tokens CoinGecko doesn't list (common for Meteora DLMM
 * meme/new-token pairs): derive price from an on-chain pool ratio against
 * a known-price base token (e.g. SOL/USDC). Stub for Tahap 2 — spot-only
 * MVP doesn't need this yet since it has no LP pools to price.
 */
export async function derivePriceFromPoolRatio(/* poolReserves, baseTokenPriceUsd */) {
  throw new Error('derivePriceFromPoolRatio belum diimplementasi — bagian Tahap 2 (LP).');
}

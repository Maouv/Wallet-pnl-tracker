import { ethers } from 'ethers';

// Wallet ini pegang ETH di Robinhood Chain (Arbitrum-based L2, Chain ID 4663,
// mainnet sejak 1 Jul 2026) — BUKAN Ethereum L1. Endpoint ini beda dari
// eth-mainnet.g.alchemy.com. Gas token tetap ETH (bridged asli), jadi
// pricing.js (CoinGecko id "ethereum") tidak perlu berubah.
function getProvider(alchemyApiKey) {
  return new ethers.JsonRpcProvider(`https://robinhood-mainnet.g.alchemy.com/v2/${alchemyApiKey}`);
}

/** Returns { balanceEth: number } or { balanceEth: null, error } on RPC failure. */
export async function getEthNativeBalance(address, alchemyApiKey) {
  try {
    const provider = getProvider(alchemyApiKey);
    const wei = await provider.getBalance(address);
    return { balanceEth: Number(ethers.formatEther(wei)), error: null };
  } catch (err) {
    return { balanceEth: null, error: err.message };
  }
}

/**
 * Returns list of ERC-20 balances with nonzero amount:
 * [{ contractAddress, symbol, decimals, balance }]
 * On RPC failure returns { tokens: [], error } — caller must NOT treat
 * this the same as "wallet genuinely has zero tokens".
 */
export async function getEthTokenBalances(address, alchemyApiKey) {
  const provider = getProvider(alchemyApiKey);
  try {
    const raw = await provider.send('alchemy_getTokenBalances', [address, 'erc20']);
    const nonZero = (raw.tokenBalances || []).filter(
      (t) => t.tokenBalance && BigInt(t.tokenBalance) > 0n
    );

    const tokens = [];
    for (const t of nonZero) {
      try {
        const meta = await provider.send('alchemy_getTokenMetadata', [t.contractAddress]);
        if (meta.decimals == null) continue; // can't compute human balance without decimals
        const balance = Number(BigInt(t.tokenBalance)) / 10 ** meta.decimals;
        tokens.push({
          contractAddress: t.contractAddress.toLowerCase(),
          symbol: meta.symbol || '???',
          decimals: meta.decimals,
          balance,
        });
      } catch {
        // metadata lookup failed for this one token — skip it individually,
        // don't fail the whole wallet fetch
        continue;
      }
    }
    return { tokens, error: null };
  } catch (err) {
    return { tokens: [], error: err.message };
  }
}

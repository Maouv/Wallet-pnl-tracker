import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

function getConnection(rpcUrl) {
  return new Connection(rpcUrl, 'confirmed');
}

/** Returns { balanceSol: number } or { balanceSol: null, error } on RPC failure. */
export async function getSolNativeBalance(address, rpcUrl) {
  try {
    const connection = getConnection(rpcUrl);
    const lamports = await connection.getBalance(new PublicKey(address));
    return { balanceSol: lamports / LAMPORTS_PER_SOL, error: null };
  } catch (err) {
    return { balanceSol: null, error: err.message };
  }
}

/**
 * Returns list of SPL token balances with nonzero amount:
 * [{ mint, symbol: null (SPL has no on-chain symbol standard), balance }]
 * On RPC failure returns { tokens: [], error }.
 */
export async function getSolTokenBalances(address, rpcUrl) {
  try {
    const connection = getConnection(rpcUrl);
    const owner = new PublicKey(address);
    const resp = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    const tokens = resp.value
      .map((acc) => {
        const info = acc.account.data.parsed.info;
        const amount = info.tokenAmount;
        return {
          mint: info.mint,
          balance: amount.uiAmount || 0,
        };
      })
      .filter((t) => t.balance > 0);

    return { tokens, error: null };
  } catch (err) {
    return { tokens: [], error: err.message };
  }
}

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { usePrivySolana } from '@/lib/privy';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

export default function HomePage() {
  // Privy × Solana の統合フック（あなたの lib/privy.tsx 実装を利用）
  const { ready, authenticated, login, logout, address, shortAddress, balance, loading, source, connection } =
    usePrivySolana({ preferredSource: 'embedded', mode: 'hybrid' });
  const { wallets: solanaWallets } = useSolanaWallets();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState<number>(1); // USDC 単位
  const [sending, setSending] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const activeWallet = useMemo(() => {
    if (!address) return null;
    return solanaWallets.find((w) => w?.address === address) ?? null;
  }, [solanaWallets, address]);

  const rpc = useMemo(() => {
    const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet') as
      | 'devnet'
      | 'mainnet-beta'
      | 'testnet';
    const url = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(CLUSTER);
    // usePrivySolana の connection をそのまま使ってもOK。ここでは冗長だが安全に再構築。
    return new Connection(url, 'confirmed');
  }, []);

  /** Phantom or Privy embedded のいずれでもサイン＆送信できるヘルパー */
  const signAndSend = useCallback(
    async (tx: Transaction) => {
      if (!activeWallet && typeof window !== 'undefined' && window.solana?.signAndSendTransaction) {
        // 直接 Phantom (window.solana) が使える場合
        const { signature } = await window.solana.signAndSendTransaction(tx);
        return signature as string;
      }

      // Privy の Solana ウォレットオブジェクト
      const w = activeWallet as any;
      if (w?.signAndSendTransaction) {
        // 一発で送るメソッドがある場合
        const sig = await w.signAndSendTransaction(tx);
        return sig as string;
      }
      if (w?.signTransaction) {
        // 署名だけ → 自前で送信
        const signed = await w.signTransaction(tx);
        const raw = signed.serialize();
        const sig = await rpc.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: 'confirmed' });
        return sig as string;
      }

      throw new Error('No compatible signer found (Privy/Phantom).');
    },
    [activeWallet, rpc]
  );

  /** 受取人の ATA を必要に応じて作成する Instruction を返す */
  const ensureAtaIx = useCallback(
    async (owner: PublicKey, mint: PublicKey, payer: PublicKey) => {
      const ata = await getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const info = await rpc.getAccountInfo(ata);
      if (!info) {
        const ix = createAssociatedTokenAccountInstruction(
          payer,     // 手数料支払い者
          ata,       // 新しく作る ATA
          owner,     // ATA の所有者
          mint,      // 対象 Mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        return { ata, createIx: ix };
      }
      return { ata, createIx: null as any };
    },
    [rpc]
  );

  const sendUSDC = useCallback(async () => {
    setSending(true);
    setLastTx(null);
    setErr(null);
    try {
      if (!ready) throw new Error('Wallet not ready.');
      if (!authenticated) {
        await login();
        throw new Error('Please press Send again after login.');
      }
      if (!address) throw new Error('No wallet address resolved.');
      if (!activeWallet) throw new Error('No active Privy wallet object.');
      const from = new PublicKey(address);

      // 入力検証
      const to = new PublicKey(recipient.trim());
      if (!recipient) throw new Error('Recipient is empty.');
      if (!(amount > 0)) throw new Error('Amount must be > 0.');

      // USDC の decimals を取得（DevnetのUSDCは 6）
      const mintInfo = await getMint(rpc, USDC_DEVNET);
      const decimals = mintInfo.decimals || 6;
      const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

      // 送金トランザクションを組む
      const tx = new Transaction();
      tx.feePayer = from;

      // 送信者／受取人の ATA を（なければ）作成
      const { ata: fromAta, createIx: ixFrom } = await ensureAtaIx(from, USDC_DEVNET, from);
      const { ata: toAta, createIx: ixTo } = await ensureAtaIx(to, USDC_DEVNET, from);
      if (ixFrom) tx.add(ixFrom);
      if (ixTo) tx.add(ixTo);

      // USDC Transfer
      tx.add(createTransferInstruction(fromAta, toAta, from, rawAmount, [], TOKEN_PROGRAM_ID));

      // ブロックハッシュを付与
      const { blockhash, lastValidBlockHeight } = await rpc.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;

      // サイン＆送信（Privy/Phantom どちらでも通る）
      const sig = await signAndSend(tx);

      setLastTx(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setSending(false);
    }
  }, [ready, authenticated, login, address, activeWallet, ensureAtaIx, recipient, amount, rpc, signAndSend]);

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Send USDC (Devnet)</h1>
        <p className="text-sm text-neutral-400">
          Wallet: {shortAddress || '—'} {source !== 'unknown' && <span className="ml-2">({source})</span>}
        </p>
        <p className="text-sm text-neutral-400">SOL balance: {loading ? 'loading…' : balance ?? '—'}</p>

        {!authenticated ? (
          <button onClick={() => login()} className="rounded-2xl px-4 py-2 bg-indigo-600 hover:bg-indigo-500">
            Login with Privy
          </button>
        ) : (
          <button onClick={() => logout()} className="rounded-2xl px-4 py-2 bg-neutral-700 hover:bg-neutral-600">
            Logout
          </button>
        )}
      </section>

      <section className="space-y-3">
        <label className="block text-sm">
          Recipient (Solana address)
          <input
            className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2"
            placeholder="Eg. 9x... (Phantom address)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </label>

        <label className="block text-sm">
          Amount (USDC)
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>

        <button
          disabled={!authenticated || !address || sending}
          onClick={sendUSDC}
          className="rounded-2xl px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send USDC'}
        </button>

        {lastTx && (
          <p className="text-sm">
            ✅ Sent!{' '}
            <a href={lastTx} target="_blank" className="text-emerald-400 underline">
              View on Explorer
            </a>
          </p>
        )}
        {err && <p className="text-sm text-red-400">Error: {err}</p>}
      </section>

      <section className="text-sm text-neutral-400">
        <h2 className="text-base font-semibold text-neutral-200 mb-2">Notes</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Devnet USDC mint: <code>4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU</code></li>
          <li>最初に <code>solana airdrop 2</code> 等で SOL を入れておいてください（手数料 & WSOL へのスワップに使用）。</li>
        </ul>
      </section>
    </main>
  );
}

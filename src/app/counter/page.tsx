'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';

import {
  getReadWorkspace,
  getSignerWorkspace,
  PROGRAM_ID,
  type WalletLike,
} from '@/lib/anchor/client';

export default function CounterPage() {
  const { ready: readyAuth, authenticated, login, logout } = usePrivy();
  const { ready: readySol, wallets } = useSolanaWallets();

  // Privy の最初の Solana Wallet 情報（署名できない場合あり）
  const privyWallet = wallets?.[0] as unknown as WalletLike | undefined;

  // 読み取り用は常に作っておく（Keypairダミー）
  const readWs = useMemo(() => getReadWorkspace(), []);

  // owner 公開鍵（Privy の address から）
  const [ownerPk, setOwnerPk] = useState<PublicKey | null>(null);
  useEffect(() => {
    const pk =
      privyWallet?.address
        ? new PublicKey(privyWallet.address)
        : (privyWallet as any)?.publicKey?.toBase58
        ? new PublicKey((privyWallet as any).publicKey.toBase58())
        : null;
    setOwnerPk(pk);
  }, [privyWallet]);

  // PDA（seeds = ["counter", owner]）
  const [pda, setPda] = useState<PublicKey | null>(null);
  useEffect(() => {
    if (!ownerPk) return setPda(null);
    const [derived] = PublicKey.findProgramAddressSync(
      [Buffer.from('counter'), ownerPk.toBuffer()],
      PROGRAM_ID
    );
    setPda(derived);
  }, [ownerPk]);

  // UI state
  const [count, setCount] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 読み取り（常に readWs でOK）
  const read = async () => {
    if (!pda) return;
    setLoading(true);
    setErr(null);
    try {
      const acc = await (readWs.program.account as any)['counter'].fetch(pda);
      setCount(acc.count.toString());
    } catch (e: any) {
      setCount(null);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (readyAuth && readySol && pda) read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyAuth, readySol, pda]);

  // 署名用 workspace をその場で確保（Privy→Phantomの順）
  const withSigner = async (fn: (ws: Awaited<ReturnType<typeof getSignerWorkspace>>) => Promise<void>) => {
    setLoading(true);
    setErr(null);
    setTxSig(null);
    try {
      const ws = await getSignerWorkspace(privyWallet ?? null);
      if (!ws) {
        throw new Error('署名可能な Solana ウォレットが見つかりません（Privy で signTransaction が無いか、Phantom 未接続）。');
      }
      await fn(ws);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const initialize = async () => {
    if (!ownerPk || !pda) return;
    await withSigner(async (ws) => {
      const tx = await (ws!.program.methods as any)
        .initialize()
        .accounts({
          counter: pda,
          signer: ownerPk,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      setTxSig(tx);
      await read();
    });
  };

  const increment = async () => {
    if (!ownerPk || !pda) return;
    await withSigner(async (ws) => {
      const tx = await (ws!.program.methods as any)
        .increment()
        .accounts({ counter: pda, signer: ownerPk })
        .rpc();
      setTxSig(tx);
      await read();
    });
  };

  const network = 'devnet';

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Counter (Privy/Phantom hybrid)</h1>

      <div className="text-sm opacity-80 space-y-1">
        <div>Auth ready: {String(readyAuth)} / Sol ready: {String(readySol)}</div>
        <div>Authenticated: {String(authenticated)}</div>
        <div>Program ID: <span className="font-mono break-all">{PROGRAM_ID.toBase58()}</span></div>
        <div>Owner: {ownerPk ? ownerPk.toBase58() : '(no wallet)'}</div>
        <div>PDA: {pda ? pda.toBase58() : '-'}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!authenticated ? (
          <button className="px-3 py-2 rounded-2xl shadow border" onClick={() => login()}>
            Login
          </button>
        ) : (
          <button className="px-3 py-2 rounded-2xl shadow border" onClick={() => logout()}>
            Logout
          </button>
        )}

        <button className="px-3 py-2 rounded-2xl shadow border" onClick={read} disabled={!pda || loading}>
          Read
        </button>

        <button
          className="px-3 py-2 rounded-2xl shadow border"
          onClick={initialize}
          disabled={!pda || loading}
          title="Privy で署名不可なら Phantom にフォールバックします"
        >
          Initialize
        </button>

        <button
          className="px-3 py-2 rounded-2xl shadow border"
          onClick={increment}
          disabled={!pda || loading}
          title="Privy で署名不可なら Phantom にフォールバックします"
        >
          Increment
        </button>
      </div>

      <div className="text-sm space-y-2">
        {loading && <div>Loading...</div>}
        {typeof count === 'string' && (
          <div>count: <span className="font-mono">{count}</span></div>
        )}
        {txSig && (
          <div className="break-all">
            tx:{' '}
            <a
              className="underline"
              target="_blank"
              href={`https://explorer.solana.com/tx/${txSig}?cluster=${network}`}
            >
              {txSig}
            </a>
          </div>
        )}
        {err && <div className="text-red-500 break-words">Error: {err}</div>}
      </div>
    </main>
  );
}






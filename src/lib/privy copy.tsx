// src/lib/privy.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// ✅ Auth のコア（EVM/共通）
import { PrivyProvider, usePrivy, useLogin, useLogout } from '@privy-io/react-auth';

// ✅ Solana 専用のフック/コネクタ（ここが重要）
import { useWallets as useSolanaWallets, toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

declare global { interface Window { solana?: any } }

type AppProviderProps = { children: React.ReactNode };

/** アプリ全体を Privy でラップ（Solana embedded 生成 & Email/Wallet ログインを有効化） */
export function PrivyAppProvider({ children }: AppProviderProps) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // メール＋ウォレットを表示（他のソーシャルは必要に応じて）
        loginMethods: ['wallet', 'email', 'github'],

        // ✅ v3 ではグローバルに埋め込み作成を指定すると簡単（外部のみなら省略可）
        embeddedWallets: {
         solana: {
        createOnLogin: 'all-users',
         },
        },

        // ✅ Solana 外部ウォレットの検出/接続（Phantomなど）を有効化
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },

        // 見た目のチェーン種別：まずは Solana のみに集中
        appearance: {
          theme: 'dark',
          accentColor: '#676FFF',
          walletChainType: 'solana-only',
          // Phantom を先頭に。検出された他の Solana ウォレットも続けて表示
          walletList: ['phantom', 'detected_wallets'],
          // ↑ 'detected_wallets' はチェーン種別に従って Solana 側が出ます
        },

        // 外部ウォレットだけなら RPC 設定は不要。
        // もし埋め込みウォレットの送金UIまで使うなら solana.rpcs を追加してください。
        // solana: {
        //   rpcs: {
        //     'solana:devnet': {
        //       rpc: createSolanaRpc('https://api.devnet.solana.com'),
        //       rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.devnet.solana.com'),
        //     },
        //   },
        // },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

/** Privy 由来の Solana アドレスを抽出（Solana 専用の wallets から優先取得） */
function extractSolanaAddress({
  privyUser,
  solanaWallets,
}: {
  privyUser: any;
  solanaWallets: any[];
}): string | null {
  // 1) Solana 専用 hook からのウォレット（最優先）
  const w = solanaWallets?.[0];
  if (w?.address && typeof w.address === 'string') return w.address;

  // 2) user オブジェクト内からのフォールバック
  const u = privyUser;
  if (u) {
    if (Array.isArray(u.wallets)) {
      const hit = u.wallets.find(
        (x: any) =>
          x?.address &&
          (x.chain === 'solana' ||
            x.chainType === 'solana' ||
            (typeof x.chainId === 'string' && x.chainId.startsWith('solana:')))
      );
      if (hit?.address) return hit.address as string;
    }
    const accounts = (u.linkedAccounts || u.accounts || []) as any[];
    const hit2 = accounts.find(
      (a: any) =>
        a?.address &&
        (a.chain === 'solana' ||
          a.chainType === 'solana' ||
          (typeof a.chainId === 'string' && a.chainId.startsWith('solana:')))
    );
    if (hit2?.address) return hit2.address as string;
  }
  return null;
}

type UsePrivySolanaOptions = {
  /** 'privy-only' = Privy に紐づくウォレットだけ使用
   *  'hybrid'     = Privy 優先。無ければ Phantom(window.solana) にフォールバック */
  mode?: 'privy-only' | 'hybrid';
  /** ログイン直後のウォレット生成待ちの最大リトライ回数（秒単位・1秒間隔） */
  retries?: number; // 既定 10 (= 最大10秒待つ)
};

/** これ1本で：ready待ち・Privy検出・（任意）Phantomフォールバック・ポーリング・残高取得 */
export function usePrivySolana(opts: UsePrivySolanaOptions = {}) {
  const mode = opts.mode ?? 'privy-only';
  const maxRetries = Math.max(0, opts.retries ?? 10);

  const { ready: readyAuth, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();

  // ✅ Solana 専用フック
  const { ready: readySolana, wallets: solanaWallets } = useSolanaWallets();

  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const tries = useRef(0);

  // RPC 統一
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
  const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet') as
    | 'devnet' | 'mainnet-beta' | 'testnet';

  const connection = useMemo(
    () => new Connection(RPC_URL || clusterApiUrl(CLUSTER), 'confirmed'),
    [RPC_URL, CLUSTER]
  );

  useEffect(() => {
    let stop = false;

    async function resolveAddressOnce(): Promise<string | null> {
      // Privy (Solana) から最優先で取得
      const fromPrivy = extractSolanaAddress({ privyUser: user, solanaWallets });
      if (typeof fromPrivy === 'string') return fromPrivy;

      // 必要なときだけ Phantom へフォールバック
      if (mode === 'hybrid' && typeof window !== 'undefined' && window.solana?.publicKey) {
        try {
          return window.solana.publicKey.toBase58();
        } catch {
          /* noop */
        }
      }
      return null;
    }

    async function run() {
      // 両方 ready に（Privy 初期化 & Solana ウォレット検出）
      if (!readyAuth || !readySolana) return;
      setLoading(true);
      try {
        while (!stop) {
          const addr = await resolveAddressOnce();
          if (addr) {
            setAddress(addr);
            try {
              const lamports = await connection.getBalance(new PublicKey(addr));
              setBalance(lamports / LAMPORTS_PER_SOL);
            } catch {
              setBalance(null);
            }
            return;
          }
          if (tries.current >= maxRetries) {
            setAddress(null);
            setBalance(null);
            return;
          }
          tries.current += 1;
          await new Promise((r) => setTimeout(r, 1000));
        }
      } finally {
        if (!stop) setLoading(false);
      }
    }

    run();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyAuth, readySolana, user, solanaWallets, connection, mode]);

  const shortAddress = !address ? '' : `${address.slice(0, 4)}…${address.slice(-4)}`;

  // ready は Auth と Solana の両方
  const ready = readyAuth && readySolana;

  return { ready, authenticated, login, logout, address, shortAddress, balance, loading };
}




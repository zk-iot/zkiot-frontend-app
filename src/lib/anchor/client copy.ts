// src/lib/anchor/client.ts
'use client';

import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';

// ============================================================
// 設定（必要に応じて書き換え）
// ============================================================

// ★ あなたの Program ID を“直書き”（base58）
export const PROGRAM_ID = new PublicKey('DMStNBL5mqqdzscVnFXnZKia1Bd1sE8mB1sjvRkKipBD');

// devnet でOKならこのまま
export const CLUSTER_URL = 'https://api.devnet.solana.com';

// IDL を静的 import（tsconfig.json に "resolveJsonModule": true が必要）
import RAW_IDL from '@/lib/anchor/idl/counter_pg.json';
// address/metadata が無い古いIDLでも通るように unknown → Idl
export const IDL = RAW_IDL as unknown as Idl;

// ============================================================
// ウォレット薄ラッパー（Privy/Phantom → Anchor.Wallet）
// ============================================================

export type WalletLike = {
  address?: string;                               // Privy v3 は address を持つ
  publicKey?: PublicKey | { toBase58(): string }; // Phantom など
  signTransaction?: (tx: any) => Promise<any>;
  signAllTransactions?: (txs: any[]) => Promise<any[]>;
};

export function walletLikeToAnchorWallet(w: WalletLike): anchor.Wallet {
  let pk: PublicKey | null = null;
  if (w.publicKey instanceof PublicKey) pk = w.publicKey;
  else if (w.publicKey && 'toBase58' in w.publicKey) pk = new PublicKey(w.publicKey.toBase58());
  else if (w.address) pk = new PublicKey(w.address);

  if (!pk || !w.signTransaction || !w.signAllTransactions) {
    throw new Error('Wallet is not sign-capable (publicKey/address or signTransaction/signAllTransactions missing).');
  }

  return {
    publicKey: pk,
    signTransaction: w.signTransaction.bind(w),
    signAllTransactions: w.signAllTransactions.bind(w),
  } as unknown as anchor.Wallet;
}

// ============================================================
// Program 生成（旧/新シグネチャ両対応）
// ============================================================
function makeProgram(idl: any, programId: PublicKey, provider: anchor.AnchorProvider): anchor.Program {
  const ProgramCtor: any = (anchor as any).Program;
  try {
    // 新シグネチャ（v0.30+）: (idl, programId, provider)
    return new ProgramCtor(idl, programId, provider) as anchor.Program;
  } catch {
    // 旧シグネチャ（v0.29系）: (idl, provider, programId)
    return new ProgramCtor(idl, provider as any, programId) as anchor.Program;
  }
}

// ============================================================
// 以前使っていた “getWorkspace” 互換：これだけで十分動く
// ============================================================
export const getWorkspace = (walletLike: WalletLike) => {
  const wallet = walletLikeToAnchorWallet(walletLike);
  const connection = new Connection(CLUSTER_URL, 'confirmed');

  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  const program = makeProgram(IDL, PROGRAM_ID, provider);

  return { connection, provider, program, PROGRAM_ID };
};




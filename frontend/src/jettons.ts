import {
  Address,
  beginCell,
  toNano,
} from "@ton/core";
import { TonClient } from "@ton/ton";
import type { TonConnectUI } from "@tonconnect/ui-react";

/**
 * =========================
 * CONFIG
 * =========================
 */

// Jetton Master (example)
export const JETTON_MASTER =
  "EQAWi6W4EYjxAuVCv6xifxIlH4nIVud9gEdNYigThlsHsDPe";

// Testnet RPC (read-only)
const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

/**
 * =========================
 * READ HELPERS (RPC)
 * =========================
 */

// Fetch jetton metadata (TEP-74)
export async function getJettonData() {
  const res = await client.runMethod(
    Address.parse(JETTON_MASTER),
    "get_jetton_data"
  );

  return {
    totalSupply: res.stack.readBigNumber(), // bigint
    mintable: res.stack.readNumber() === -1,
    admin: res.stack.readAddress()?.toString(),
    content: res.stack.readCell(),
    walletCode: res.stack.readCell(),
  };
}

// Resolve user's Jetton Wallet address
export async function getUserJettonWallet(
  userAddress: string
): Promise<string> {
  const res = await client.runMethod(
    Address.parse(JETTON_MASTER),
    "get_wallet_address",
    [
      {
        type: "slice",
        cell: beginCell()
          .storeAddress(Address.parse(userAddress))
          .endCell(),
      },
    ]
  );

  return res.stack.readAddress().toString();
}

// Read jetton wallet data
export async function getJettonWalletData(jettonWallet: string) {
  const res = await client.runMethod(
    Address.parse(jettonWallet),
    "get_wallet_data"
  );

  return {
    balance: res.stack.readBigNumber(), // bigint
    owner: res.stack.readAddress()?.toString(),
    master: res.stack.readAddress()?.toString(),
  };
}

// Convenience: balance by owner address
export async function getJettonBalance(
  userAddress: string
): Promise<bigint> {
  const jw = await getUserJettonWallet(userAddress);
  const data = await getJettonWalletData(jw);
  return data.balance;
}

/**
 * =========================
 * WRITE: TRANSFER (TonConnect)
 * =========================
 *
 * Implements the SAME low-level flow as docs:
 * opcode 0x0f8a7ea5
 * forward_payload comment
 * forward_ton_amount > 0
 */

export async function sendJettonTransfer(
  tonConnectUI: TonConnectUI,
  senderAddress: string,
  destinationAddress: string,
  jettonAmount: string, // decimal string from UI
  decimals = 9 // MUST be fetched from metadata in real apps
) {
  // Convert human amount → on-chain amount
  const amount = BigInt(
    Math.floor(
      Number(jettonAmount) * 10 ** decimals
    )
  );

  const senderJettonWallet =
    await getUserJettonWallet(senderAddress);

  // Forward payload (comment)
  const forwardPayload = beginCell()
    .storeUint(0, 32) // comment opcode
    .storeStringTail("Jetton transfer")
    .endCell();

  // Jetton transfer body (TEP-74)
  const body = beginCell()
    .storeUint(0x0f8a7ea5, 32) // transfer opcode
    .storeUint(0, 64) // query_id
    .storeCoins(amount) // jetton amount
    .storeAddress(Address.parse(destinationAddress)) // new owner
    .storeAddress(Address.parse(senderAddress)) // response destination
    .storeBit(0) // no custom payload
    .storeCoins(toNano("0.02")) // forward TON
    .storeBit(1)
    .storeRef(forwardPayload)
    .endCell();

  // Send via connected wallet
  await tonConnectUI.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 300,
    messages: [
      {
        address: senderJettonWallet,
        amount: toNano("0.1").toString(), // gas
        payload: body.toBoc().toString("base64"),
      },
    ],
  });
}

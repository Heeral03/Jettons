# Jetton Wallet & Master

A simple implementation of a Jetton (token) system on the TON blockchain with wallet management and basic UI integration.

---

## Jetton Wallet

The Jetton Wallet is responsible for managing an individual user's jettons.  

**Features:**

- Holds jettons for a single owner and a single Jetton Master  
- Receives jettons via internal transfers (from the master or other wallets)  
- Sends jettons upon owner requests  
- Burns jettons upon owner request and notifies the Jetton Master  
- Enforces safety rules, including ownership checks, balance checks, and same-master validation  

---

## Jetton Master

The Jetton Master defines and controls the jetton ecosystem.  

**Features:**

- Defines the jetton by storing admin, total supply, metadata, and wallet code  
- Controls minting logic via admin mini-requests (deploy wallets, credit supply)  
- Tracks total supply and updates it on mint and burn events  
- Deploys deterministic Jetton Wallets for users when needed  
- Responds to wallet address queries for clients  
- Processes burn notifications from valid Jetton Wallets  
- Enforces core rules: admin-only actions, valid wallet verification, deterministic address derivation, and non-negative total supply  

---

## UI Integration

A simple user interface is included to:

- Connect the wallet  
- Send jettons to a given destination address  

---

## Tech Stack

- **Smart Contracts:** Tolk 
- **Frontend:** React 
- **Blockchain:** TON  

---

## Usage

1. Connect your wallet via the UI  
2. Send or receive jettons  
3. Monitor balances and transactions  


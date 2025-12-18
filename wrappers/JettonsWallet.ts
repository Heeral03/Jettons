// wrappers/JettonsWallet.ts
import { 
    Address, 
    beginCell, 
    Cell, 
    Contract, 
    contractAddress, 
    ContractProvider, 
    Sender, 
    SendMode 
} from '@ton/core';

// Opcodes from your contract
export const Opcodes = {
    TRANSFER: 0x0f8a7ea5,
    INTERNAL_TRANSFER: 0x178d4519,
    TRANSFER_NOTIFY: 0x7362d09c,
    BURN: 0x595f07bc,
    EXCESS: 0xd53276db,
    BURN_NOTIFICATION: 0x7bdd97de,
};

export type JettonsWalletConfig = {
    owner: Address;
    jettonMaster: Address;
    walletCode: Cell;
    walletBalance?: bigint;
};

export function jettonsWalletConfigToCell(config: JettonsWalletConfig): Cell {
    return beginCell()
        .storeUint(0x11111111, 32)          // Add the prefix!
        .storeAddress(config.owner)
        .storeAddress(config.jettonMaster)
        .storeRef(config.walletCode)
        .storeCoins(config.walletBalance ?? 0n)
        .endCell();
}
export class JettonsWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new JettonsWallet(address);
    }

    static createFromConfig(config: JettonsWalletConfig, code: Cell, workchain = 0) {
        const data = jettonsWalletConfigToCell(config);
        const init = { code, data };
        return new JettonsWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(), // empty body for deployment
        });
    }

async sendInternalTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
        value: bigint;
        queryId?: number;
        amount: bigint;
        sender: Address;
        operation: number;
        forwardTonAmount: bigint;
        responseDestination?: Address;
        customPayload?: Cell;
        forwardPayload?: Cell;
    }
) {
    await provider.internal(via, {
        value: opts.value,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        body: beginCell()
            .storeUint(0x178d4519, 32)           // opcode
            .storeAddress(opts.sender)           // sender
            .storeCoins(opts.amount)             // amount
            .storeUint(opts.operation, 8)        // operation (uint8)
            .storeCoins(opts.forwardTonAmount)   // forwardTonAmount
            .storeAddress(opts.responseDestination ?? null) // responseDestination?
            .storeUint(opts.queryId ?? 0, 64)    // queryId
            .storeMaybeRef(opts.customPayload ?? null)  // customPayload?
            .storeMaybeRef(opts.forwardPayload ?? null) // forwardPayload?
            .endCell(),
    });
}

    // Get methods (if your contract has them)
    async getWalletData(provider: ContractProvider) {
        const result = await provider.get('get_wallet_data', []);
        return {
            balance: result.stack.readBigNumber(),
            owner: result.stack.readAddress(),
            jettonMaster: result.stack.readAddress(),
            walletCode: result.stack.readCell(),
        };
    }
}
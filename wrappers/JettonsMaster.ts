
// wrappers/JettonsMaster.ts
import { 
    Address, 
    beginCell, 
    Cell, 
    Contract, 
    contractAddress, 
    ContractProvider, 
    Sender, 
    SendMode,
    TupleItemSlice
} from '@ton/core';

export const Opcodes = {
    MINI_REQUEST: 0x22222222,
    BURN_NOTIFICATION: 0x7bdd97de,
};

export type JettonsMasterConfig = {
    totalSupply: bigint;
    admin: Address;
    walletCode: Cell;
    metadata: {
        name: number;      // bits32
        symbol: number;    // bits32
        decimals: number;  // uint8
    };
};

export function jettonsMasterConfigToCell(config: JettonsMasterConfig): Cell {
    return beginCell()
        .storeUint(0x11111111, 32)  // Storage prefix
        .storeCoins(config.totalSupply)
        .storeAddress(config.admin)
        .storeRef(config.walletCode)
        .storeUint(config.metadata.name, 32)
        .storeUint(config.metadata.symbol, 32)
        .storeUint(config.metadata.decimals, 8)
        .endCell();
}

export class JettonsMaster implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new JettonsMaster(address);
    }

    static createFromConfig(config: JettonsMasterConfig, code: Cell, workchain = 0) {
        const data = jettonsMasterConfigToCell(config);
        const init = { code, data };
        return new JettonsMaster(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendMiniRequest(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            operation: number;  // 0=deploy wallet, 1=mint, 2=credit
            target: Address;
            amount: bigint;
            admin: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.MINI_REQUEST, 32)
                .storeInt(opts.operation, 32)
                .storeAddress(opts.target)
                .storeUint(opts.amount, 64)
                .storeAddress(opts.admin)
                .endCell(),
        });
    }

    async sendBurnNotification(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            amount: bigint;
            wallet: Address;
            owner: Address;
            jettonMaster: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.BURN_NOTIFICATION, 32)
                .storeUint(opts.amount, 64)
                .storeAddress(opts.wallet)
                .storeAddress(opts.owner)
                .storeAddress(opts.jettonMaster)
                .endCell(),
        });
    }

async getJettonData(provider: ContractProvider) {
    const result = await provider.get('get_jetton_data', []);
    const tuple = result.stack.readTuple();
    return {
        totalSupply: tuple.readBigNumber(),
        admin: tuple.readAddress(),
        walletCode: tuple.readCell(),
        // bits32 are slices, not numbers - read as cells/slices
        name: tuple.readCell(),      // or skip if not needed
        symbol: tuple.readCell(),    // or skip if not needed  
        decimals: tuple.readBigNumber(),
    };
}

    async getWalletAddress(provider: ContractProvider, owner: Address) {
        const ownerCell = beginCell().storeAddress(owner).endCell();
        const result = await provider.get('get_wallet_address', [
            { type: 'slice', cell: ownerCell } as TupleItemSlice
        ]);
        return result.stack.readAddress();
    }
}
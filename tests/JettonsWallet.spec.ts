// tests/JettonsWallet.spec.ts
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { JettonsWallet } from '../wrappers/JettonsWallet';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('JettonsWallet', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonMaster: SandboxContract<TreasuryContract>;
    let jettonsWallet: SandboxContract<JettonsWallet>;

    beforeAll(async () => {
        code = await compile('JettonsWallet');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        jettonMaster = await blockchain.treasury('jettonMaster');

        jettonsWallet = blockchain.openContract(
            JettonsWallet.createFromConfig(
                {
                    owner: deployer.address,
                    jettonMaster: jettonMaster.address,
                    walletCode: code,
                    walletBalance: 0n,
                },
                code
            )
        );

        const deployResult = await jettonsWallet.sendDeploy(
            deployer.getSender(),
            toNano('0.05')
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonsWallet.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy successfully', async () => {
        // Deployment verified in beforeEach
    });

    it('should mint jettons from master', async () => {
        const mintAmount = 1000n;

        const mintResult = await jettonsWallet.sendInternalTransfer(
            jettonMaster.getSender(),
            {
                value: toNano('0.1'),
                sender: jettonMaster.address,
                amount: mintAmount,
                operation: 0, // Mint
                forwardTonAmount: 0n,
                queryId: 1,
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: jettonsWallet.address,
            success: true,
        });

        // Check balance via get method (if implemented)
        // const balance = await jettonsWallet.getWalletBalance();
        // expect(balance).toBe(mintAmount);
    });

    it('should reject mint from non-master', async () => {
        const hacker = await blockchain.treasury('hacker');
        const mintAmount = 1000n;

        const result = await jettonsWallet.sendInternalTransfer(
            hacker.getSender(),
            {
                value: toNano('0.1'),
                sender: hacker.address,
                amount: mintAmount,
                operation: 0, // Mint
                forwardTonAmount: 0n,
                queryId: 1,
            }
        );
        
        // Should fail with ERROR_UNAUTHORIZED (exit code 1)
        expect(result.transactions).toHaveTransaction({
            from: hacker.address,
            to: jettonsWallet.address,
            success: false,
            exitCode: 101, // ERROR_UNAUTHORIZED
        });
    });

    it('should burn jettons', async () => {
        const mintAmount = 1000n;
        const burnAmount = 400n;

        // First mint
        await jettonsWallet.sendInternalTransfer(jettonMaster.getSender(), {
            value: toNano('0.1'),
            sender: jettonMaster.address,
            amount: mintAmount,
            operation: 0,
            forwardTonAmount: 0n,
            queryId: 1,
        });

        // Then burn
        const burnResult = await jettonsWallet.sendInternalTransfer(
            deployer.getSender(),
            {
                value: toNano('0.1'),
                sender: deployer.address,
                amount: burnAmount,
                operation: 2, // Burn
                forwardTonAmount: 0n,
                queryId: 2,
            }
        );

        expect(burnResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonsWallet.address,
            success: true,
        });
    });

    it('should reject burn with insufficient balance', async () => {
        const burnResult = await jettonsWallet.sendInternalTransfer(
            deployer.getSender(),
            {
                value: toNano('0.1'),
                sender: deployer.address,
                amount: 500n, // Balance is 0
                operation: 2, // Burn
                forwardTonAmount: 0n,
                queryId: 1,
            }
        );

        expect(burnResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonsWallet.address,
            success: false,
            exitCode: 2, // ERROR_INSUFFICIENT_BALANCE
        });
    });
});
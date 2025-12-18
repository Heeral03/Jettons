import { toNano, Address } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { JettonsWallet } from '../wrappers/JettonsWallet';

export async function run(provider: NetworkProvider) {
    const sender = provider.sender();

    if (!sender.address) {
        throw new Error('Sender address is not available');
    }

    // ⚠️ Replace with your actual Jetton Master address
    const JETTON_MASTER = Address.parse('EQAWi6W4EYjxAuVCv6xifxIlH4nIVud9gEdNYigThlsHsDPe');

    const walletCode = await compile('JettonsWallet');

    const jettonsWallet = provider.open(
        JettonsWallet.createFromConfig(
            {
                owner: sender.address,
                jettonMaster: JETTON_MASTER,
                walletCode: walletCode,
                walletBalance: 0n
            },
            walletCode
        )
    );

    console.log('Deploying JettonsWallet at:', jettonsWallet.address.toString());

    await jettonsWallet.sendDeploy(
        provider.sender(),
        toNano('0.05')
    );

    await provider.waitForDeploy(jettonsWallet.address);

    console.log('✅ JettonsWallet deployed successfully');
}

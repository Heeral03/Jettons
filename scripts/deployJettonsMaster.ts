import { toNano, Address, Cell, beginCell } from '@ton/core';
import { JettonsMaster, JettonsMasterConfig } from '../wrappers/JettonsMaster';
import { compile, NetworkProvider } from '@ton/blueprint';
import fs from 'fs';

// Convert string to bits32 number
function stringToBits32(s: string): number {
    const buf = Buffer.alloc(4); // bits32 = 4 bytes
    buf.write(s.slice(0, 4), 0, 'ascii'); // truncate/pad to 4 chars
    return buf.readUInt32BE(0); // big-endian
}

export async function run(provider: NetworkProvider) {
    const walletCompiled = JSON.parse(fs.readFileSync('build/JettonsWallet.compiled.json', 'utf8'));
const walletCode = Cell.fromBoc(Buffer.from(walletCompiled.hex, 'hex'))[0];



    const config: JettonsMasterConfig = {
        totalSupply: 0n,

        admin: Address.parse('0QDRl_r0pqWSObJfOBrVYY-uf4R3_MWRw8kMZJbwEuJNywCY'),

        walletCode,
        metadata: {
            name: stringToBits32('MJTN'),  // only first 4 chars
            symbol: stringToBits32('MJET'), 
            decimals: 9
        }
    };

    const masterCode: Cell = await compile('JettonsMaster');
    const jettonsMaster = provider.open(JettonsMaster.createFromConfig(config, masterCode));

    console.log('Deploying JettonsMaster to:', jettonsMaster.address.toString());

    await jettonsMaster.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(jettonsMaster.address);

    console.log('✅ JettonsMaster deployed successfully at:', jettonsMaster.address.toString());
}

/*What data does Jetton Master store?
    - admin address
    - total jettons
    - jetton wallet code which was used to deploy the other wallets by jetton Master
    - jetton metadata


What messages does it accept?
    - address query
    - mini request ( sent by admin to tell master to deploy wallets if needed, increase supply or credit the wallet)
    - Burn notification ( sent by jetton wallet to tell master that some coins have been burnt)
What messages does it send?
    - wallet deployment message
    - Internal Transfer
    - Reply with wallet address

What validations are mandatory?
    - mini request sender should be a true admin
    - valid jetton wallet
    - wallet address derivation must be deterministic
    - total supply never negative
*/




const SEND_REGULAR_MODE=0;

const ERROR_UNAUTHORIZED_ADMIN = 101






struct JettonMetadata {
    name: bits32        // e.g., "MyJetton"
    symbol: bits32      // e.g., "MJET"
    decimals: uint8     // number of decimals, usually 9 for TON
}


struct( 0x11111111 )Storage{
    totalSupply: coins
    admin: address
    walletCode: cell
    metadata:JettonMetadata
    
}

fun Storage.load(): Storage {
   return Storage.fromCell(contract.getData());
}


fun Storage.save(self){
    contract.setData(self.toCell());
}

struct(0x22222222) MiniRequest {
    operation: int32  // 0=deploy wallet, 1=mint, 2=credit
    target: address
    amount: uint64
    admin: address
    
}

struct(0x7bdd97de) BurnNotification{
    amount: uint64
    wallet: address
    owner: address
    jettonMaster: address
}



// send wallet deploymnent message
fun sendDeployWalletMessage(walletAddress: address){
    val deployMsg = createMessage({
        bounce: BounceMode.NoBounce,
        value:ton("0.005"),
        dest:walletAddress,
        //body:createEmptyCell()
    });
    deployMsg.send(SEND_REGULAR_MODE);
}



// Send internal transfer
fun sendInternalTransfer(target: address, amount: uint64) {
    // Use provided msg or create an empty cell
    val transferMsg = createMessage({
        bounce: BounceMode.NoBounce,
        value:ton("0.005"),
        dest:target,
        //body:createEmptyCell()
    });
    transferMsg.send(SEND_REGULAR_MODE);
}




fun handleMiniRequest(msg : MiniRequest,senderAddress: address){
    var storage= Storage.load();
    if(senderAddress != storage.admin){
        throw(ERROR_UNAUTHORIZED_ADMIN)

    }

    match(msg.operation){
        0 => {
            //deploy the wallet
            val deployMsg=createEmptyCell();
            sendInternalTransfer(msg.target,0);
        }
        1 => {
            //mint jettons
            storage.totalSupply+=msg.amount;
            storage.save();
            sendInternalTransfer(msg.target, msg.amount);
        }

        2 => {
            //credit internal exisiting wallet
            sendInternalTransfer(msg.target,msg.amount);
        }
    }
    storage.save();

}
struct WalletStorage{
    balance: coins
    owner: address
    jettonMaster: address
    walletCode: cell
 }

fun calcDeployedWallet(owner: address, walletCode: cell): AutoDeployAddress {
    val emptyWalletStorage: WalletStorage = {
        balance: 0,
        owner: owner,
        jettonMaster: contract.getAddress(),
        walletCode: walletCode
    };

    return {
        stateInit: {
            code: walletCode,
            data: emptyWalletStorage.toCell()
        }
    }
}


fun deployWallet(owner: address, walletCode: cell) {
    val deployAddr = calcDeployedWallet(owner, walletCode);

    val deployMsg = createMessage({
        bounce: BounceMode.NoBounce,
        value: ton("0.05"), // MUST fund deployment
        dest: deployAddr
    });
    deployMsg.send(SEND_REGULAR_MODE);

    
}


fun handleBurnNotification(msg: BurnNotification,senderAddress: address) {
    var storage = Storage.load();

    val expectedWalletAddr: address = calcDeployedWallet(msg.owner, storage.walletCode)
                                        .buildAddress()
                                        .endCell()
                                        .beginParse() as address;

    if(senderAddress != expectedWalletAddr){
        throw ERROR_UNAUTHORIZED_ADMIN;
    }

    if(storage.totalSupply < msg.amount){
        throw ERROR_UNAUTHORIZED_ADMIN;
    }

    storage.totalSupply -= msg.amount;
    storage.save();
}

get fun get_jetton_data(): tuple {
    val storage = lazy Storage.load();

    // Return as a tuple (positional, no field names)
    return (
        storage.totalSupply,
        storage.admin,
        storage.walletCode,
        storage.metadata.name,
        storage.metadata.symbol,
        storage.metadata.decimals
    ).toTuple();
}

get fun get_wallet_address(owner: address): address {
    val storage = lazy Storage.load();

    val walletAddr: address = calcDeployedWallet(owner, storage.walletCode)
                                .buildAddress()
                                .endCell()
                                .beginParse() as address;

    return walletAddr;
}

type AllowedMessage = MiniRequest | BurnNotification;

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match(msg){
        MiniRequest => {
            handleMiniRequest(msg,in.senderAddress);
        }
        BurnNotification =>{
            handleBurnNotification(msg,in.senderAddress);
        }
        else => {
            // Accept empty messages for deployment/top-up
            assert(in.body.isEmpty()) throw 63;
        }
    }
}





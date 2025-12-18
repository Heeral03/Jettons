/* What data does Jetton Wallet store?
    - owner address (who owns this wallet)
    - jetton master address (which token this wallet belongs to)
    - wallet balance (jetton amount)
    - wallet code hash / reference (implicitly via deployment)
    

What messages does it accept?
    - internal transfer (receiving jettons from another wallet or master)
    - external transfer request (owner asks to send jettons)
    - burn request (owner asks to burn jettons)
    

What messages does it send?
    - internal transfer message (to another jetton wallet)
    - burn notification (to jetton master)
    - excess gas return / response messages (optional but recommended)
    

What validations are mandatory?
    - external transfer sender must be the wallet owner
    - sufficient balance before transfer or burn
    - destination wallet must belong to the same jetton master
    - burn amount must be valid and non-negative
    - internal transfers must originate from:
        - jetton master (mint)
        - another valid jetton wallet
*/

// Constants
const SEND_REGULAR_MODE = 0;
 const SEND_MODE_CARRY_REMAINING = 64;
const OPC_TRANSFER          = 0x0f8a7ea5
const OPC_INTERNAL_TRANSFER = 0x178d4519
const OPC_TRANSFER_NOTIFY   = 0x7362d09c
const OPC_BURN              = 0x595f07bc
const OPC_EXCESS            = 0xd53276db
const OPC_BURN_NOTIFICATION = 0x7bdd97de
const ERROR_UNAUTHORIZED           = 101
const ERROR_INSUFFICIENT_BALANCE   = 2
const ERROR_INVALID_DESTINATION    = 3
struct( 0x11111111 )Storage{
    owner: address
    jettonMaster: address
    walletCode: cell
    walletBalance:coins
}

struct(0x178d4519)InternalTransfer{
    sender: address
    amount: coins
    operation: uint8
    forwardTonAmount: coins
    responseDestination: address?
    queryId: uint64
    customPayload: cell?      // optional data
    forwardPayload: cell?     // optional forward payload
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

fun sendTransferNotification(queryId: uint64, responseDest: address, amount: coins, senderAddress: address, forwardPayload: cell) {
    val notifyMsg = createMessage({
        bounce: BounceMode.NoBounce,
        value: ton("0"),
        dest: responseDest,
        body: beginCell()
            .storeUint(OPC_TRANSFER_NOTIFY, 32)
            .storeUint(queryId, 64)
            .storeCoins(amount)
            .storeAddress(senderAddress)
            .storeRef(forwardPayload)
            .endCell()
    });
    notifyMsg.send(SEND_REGULAR_MODE);
}



// Send excess gas back to the response destination
fun sendExcess(queryId: uint64, responseDest: address) {
    val excessMsg = createMessage({
        bounce: BounceMode.NoBounce,   // do not bounce if recipient fails
        value: ton("0"),               // usually 0 TON is sent; you can adjust if returning actual excess
        dest: responseDest,            // address to return excess to
        body: beginCell()
            .storeUint(OPC_EXCESS, 32)  // opcode for excess
            .storeUint(queryId, 64)     // original query ID
            .endCell()
    });

    excessMsg.send(SEND_REGULAR_MODE);
}


fun handleInternalTransfer(msg: InternalTransfer) {
    var storage = Storage.load();

    match(msg.operation) {
        0 => { // Mint from jetton master
            // Only the master can mint
            if(msg.sender != storage.jettonMaster) {
                throw(ERROR_UNAUTHORIZED);
            }

            // Increase wallet balance
            storage.walletBalance += msg.amount;

            // Save updated storage
            storage.save();
        }

        1 => { // Transfer from another wallet
            val expectedWallet = calcDeployedWallet(msg.sender, storage.walletCode)
                                .buildAddress()
                                .endCell()
                                .beginParse() as address;

            // Ensure sender is master or expected wallet
            if(msg.sender != storage.jettonMaster && msg.sender != expectedWallet) {
                throw(ERROR_UNAUTHORIZED);
            }

           
            // Now safe to update balance
            storage.walletBalance += msg.amount;
            storage.save();
            
            // Transfer notification
            var forwardPayloadCell: cell;
            if(msg.forwardPayload != null) {
                forwardPayloadCell = msg.forwardPayload!;
            } else {
                forwardPayloadCell = createEmptyCell();
            }



            // Only send notification if forward_ton_amount > 0
            if(msg.forwardTonAmount > 0) {
                sendTransferNotification(
                    msg.queryId,
                    storage.owner,  // send to the wallet owner, not responseDestination
                    msg.amount,
                    msg.sender,
                    forwardPayloadCell
                );
            }

// Return excess gas to responseDestination
if(msg.responseDestination != null) {
    sendExcess(msg.queryId, msg.responseDestination!);
}
    }

         // Add this at the top

// In the burn case (operation 2):
2 => {  // Burn
    if(msg.sender != storage.owner){
        throw ERROR_UNAUTHORIZED;
    }

    if(storage.walletBalance < msg.amount){
        throw ERROR_INSUFFICIENT_BALANCE;
    }

    storage.walletBalance -= msg.amount;
    storage.save();

    val forwardPayloadCell: cell = createEmptyCell();
    val burnNotify: cell = beginCell()
        .storeUint(OPC_BURN_NOTIFICATION, 32)
        .storeUint(msg.queryId, 64)
        .storeCoins(msg.amount)
        .storeAddress(contract.getAddress())
        .storeAddress(storage.owner)
        .storeRef(forwardPayloadCell)
        .endCell();

    val burnMsg = createMessage({
        bounce: BounceMode.NoBounce,
        value: ton("0"),
        dest: storage.jettonMaster,
        body: burnNotify
    });
    burnMsg.send(SEND_MODE_CARRY_REMAINING);  // Use mode 64!
}

    }
}



fun Storage.load(): Storage {
   return Storage.fromCell(contract.getData());
}


fun Storage.save(self){
    contract.setData(self.toCell());
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


// Create the union type
type AllowedMessage = InternalTransfer

// Then use it in your handler
fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessage.fromSlice(in.body);
    match (msg) {
        InternalTransfer => {
            // handle transfer
            handleInternalTransfer(msg);
        }
        else => {
            // Accept empty messages (deployment/top-up)
            assert(in.body.isEmpty()) throw 0xFFFF
        }
    }
}
import { useEffect, useState } from "react";
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";

import {
  getJettonBalance,
  sendJettonTransfer,
  JETTON_MASTER,
} from "./jettons";

function App() {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet) return;

    (async () => {
      const bal = await getJettonBalance(
        wallet.account.address
      );

      // assuming 9 decimals for demo
      setBalance((Number(bal) / 1e9).toString());
    })();
  }, [wallet]);

  const handleSend = async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      await sendJettonTransfer(
        tonConnectUI,
        wallet.account.address,
        destination,
        amount
      );
      alert("Transfer sent");
    } catch (e) {
      console.error(e);
      alert("Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto" }}>
      <TonConnectButton />

      {wallet && (
        <>
          <p><b>Wallet:</b> {wallet.account.address}</p>
          <p><b>Jetton Master:</b> {JETTON_MASTER}</p>
          <p><b>Balance:</b> {balance}</p>

          <input
            placeholder="Destination address"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={{ width: "100%", marginTop: 10 }}
          />

          <input
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: "100%", marginTop: 10 }}
          />

          <button
            onClick={handleSend}
            disabled={loading}
            style={{ width: "100%", marginTop: 10 }}
          >
            {loading ? "Sending..." : "Send Jettons"}
          </button>
        </>
      )}
    </div>
  );
}

export default App;

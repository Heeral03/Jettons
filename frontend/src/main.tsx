import { Buffer } from "buffer";
window.Buffer = Buffer;
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
<TonConnectUIProvider manifestUrl="https://jettons-hlux.vercel.app/tonconnect-manifest.json">
  <App />
</TonConnectUIProvider>

);

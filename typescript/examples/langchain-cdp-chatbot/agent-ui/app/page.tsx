/* eslint-disable jsdoc/require-jsdoc */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { Terminal } from "lucide-react";

export default function App() {
  const [messages, setMessages] = useState<Array<{ message: string; timestamp: number }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource("/api/messages");

    eventSource.onmessage = event => {
      const newMessages = JSON.parse(event.data);
      setMessages(newMessages);
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col min-h-screen font-sans dark:bg-background dark:text-white bg-white text-black">
      <header className="py-2 px-4">
        <div className="flex justify-end">
          <div className="wallet-container">
            <Wallet>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownLink
                  icon="wallet"
                  href="https://keys.coinbase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Wallet
                </WalletDropdownLink>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-[95%] h-full">
          {/* Agent Console Section */}
          <div className="h-[calc(100vh-6rem)]">
            <div className="bg-gray-900 rounded-lg p-4 shadow-lg h-full">
              <div className="flex items-center gap-2 mb-4 text-white">
                <Terminal className="h-6 w-6" />
                <h2 className="text-xl font-bold"> Bidding Agent 47</h2>
              </div>
              <div className="bg-black rounded-lg p-4 h-[calc(100%-4rem)] overflow-y-auto font-mono text-sm">
                {messages.map((msg, i) => (
                  <div key={i} className="text-green-400 mb-2">
                    <span className="text-gray-500">
                      [{new Date(msg.timestamp).toLocaleTimeString()}]
                    </span>{" "}
                    {msg.message}
                  </div>
                ))}
                <div ref={messagesEndRef} />
                {messages.length === 0 && (
                  <div className="text-gray-500 text-center mt-4">
                    Waiting for agent messages...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

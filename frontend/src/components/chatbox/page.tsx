"use client";

import { useState } from "react";
import { Send, MessageCircle, X } from "lucide-react";

export default function ChatBox() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! How can I help you with trading today?" },
  ]);

  const sendMessage = () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { from: "user", text: input }]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "I'm processing your request..." },
      ]);
    }, 600);

    setInput("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">

      {/* Floating toggle button */}
      {!open && (
        <button
          title="chat-toggle"
          className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 transition text-white shadow-xl"
          onClick={() => setOpen(true)}
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* Chatbox */}
      {open && (
        <div className="w-80 h-96 bg-[#1a1a1a] text-white rounded-xl shadow-2xl flex flex-col border border-gray-700 fixed bottom-6 right-6 z-[9999]">

          {/* Header */}
          <div className="flex justify-between items-center px-3 py-2 border-b border-gray-700">
            <p className="font-semibold">Chat with AI Assistant</p>
            <button title="chat-close" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`w-fit max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  msg.from === "user"
                    ? "ml-auto bg-blue-600"
                    : "bg-gray-700 text-gray-200"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-700 flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-lg bg-[#2a2a2a] text-sm text-white outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              title="chat-send"
              onClick={sendMessage}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <Send size={18} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

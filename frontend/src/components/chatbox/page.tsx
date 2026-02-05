/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { Send, MessageCircle, X } from "lucide-react";
import { AdviceService } from "../../services/Advice.service";
import { ChatMessage } from "../../types/ChatMessage";

export default function ChatBox() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      from: "bot",
      text: "Hello! How can I help you with trading today?",
    },
  ]);

  /* ----------------------------------
     Receive message from backend
  ----------------------------------- */
  const receiveMessage = async (message: string) => {
    // typing indicator
    setMessages((prev) => [
      ...prev,
      { from: "bot", text: "Typing…" },
    ]);

    try {
      const payload = await AdviceService.handleChatbot(message);
      console.log("Chatbot payload:", payload);
      let botMessages: { from: "bot"; text: string }[] = [];

      /* =================================================
       | CASE 1: NORMAL CHAT
       ================================================= */
      if (payload.type === "chat") {
        botMessages.push({
          from: "bot",
          text:
            typeof payload.response === "string"
              ? payload.response
              : payload.response?.message ?? "🤖",
        });
      }

      /* =================================================
       | CASE 2: NEWS
       ================================================= */
      else if (payload.type === "news") {
        const summary = payload.response.summary ?? "Latest updates:";
        const items = payload.response.items ?? [];

        const text = [
          `📰 ${summary}`,
          "",
          ...items.map(
            (item: any, idx: number) =>
              `${idx + 1}. ${item.topic}\n${item.excerpt}`
          ),
        ].join("\n\n");

        botMessages.push({
          from: "bot",
          text,
        });
      }

      /* =================================================
       | CASE 3 & 4: ADVICE / ADVICE_MULTI
       ================================================= */
      else if (
        payload.type === "advice" ||
        payload.type === "advice_multi"
      ) {
        const results = payload.results ?? [];

        botMessages = results.map((result: any) => {
          const highlights = result.response.highlights?.length
            ? result.response.highlights.map((h: string) => `• ${h}`).join("\n")
            : "";

          const warnings = result.response.warnings?.length
            ? result.response.warnings.map((w: string) => `• ${w}`).join("\n")
            : "• None";

          const text = [
            `📊 ${result.symbol} — Recommendation: ${result.response.recommendation}`,
            "",
            highlights,
            "",
            result.response.message,
            "",
            "⚠️ Warning:",
            warnings,
            "",
            `Confidence: ${result.response.confidence}%`,
          ]
            .filter(Boolean)
            .join("\n");

          return {
            from: "bot" as const,
            text,
          };
        });
      }

      /* =================================================
       | UNKNOWN FALLBACK
       ================================================= */
      else {
        botMessages.push({
          from: "bot",
          text: "🤔 I received an unknown response type.",
        });
      }

      // remove "Typing…" and append bot messages
      setMessages((prev) => [
        ...prev.slice(0, -1),
        ...botMessages,
      ]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          from: "bot",
          text: "⚠️ Something went wrong. Please try again.",
        },
      ]);
    }
  };

  /* ----------------------------------
     Send user message
  ----------------------------------- */
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");

    setMessages((prev) => [
      ...prev,
      { from: "user", text: userMessage },
    ]);

    await receiveMessage(userMessage);
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
        <div className="w-80 h-96 bg-[#1a1a1a] text-white rounded-xl shadow-2xl flex flex-col border border-gray-700 fixed bottom-6 right-6">
          {/* Header */}
          <div className="flex justify-between items-center px-3 py-2 border-b border-gray-700">
            <p className="font-semibold">Chat with AI Assistant</p>
            <button title="chat-close" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* Messages – Messenger style */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg, idx) => {
              const isUser = msg.from === "user";

              return (
                <div
                  key={idx}
                  className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"
                    }`}
                >
                  {/* Bot avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                      AI
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`px-4 py-2 text-sm whitespace-pre-line max-w-[75%] rounded-2xl ${isUser
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-gray-700 text-gray-200 rounded-bl-md"
                      }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-700 flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-full bg-[#2a2a2a] text-sm text-white outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              title="chat-send"
              onClick={sendMessage}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

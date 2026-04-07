"use client";

import dynamic from "next/dynamic";

const ChatBox = dynamic(() => import("@/src/components/chatbox/page"), {
  ssr: false,
  loading: () => null,
});

/** Client-only lazy wrapper so the site layout can stay a Server Component. */
export default function ChatBoxLazy() {
  return <ChatBox />;
}

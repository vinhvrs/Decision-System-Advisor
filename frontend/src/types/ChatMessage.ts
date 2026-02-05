export type ChatMessage = {
  id?: number;
  from: "user" | "bot";
  text?: string;
  payload?: unknown; // advice object
};

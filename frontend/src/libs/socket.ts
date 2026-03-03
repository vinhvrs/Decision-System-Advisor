"use client";

export class SimpleSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessageCallback: (data: unknown) => void;

  constructor(url: string, onMessage: (data: unknown) => void) {
    this.url = url;
    this.onMessageCallback = onMessage;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("🚀 [WS] Connected to Python Server");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessageCallback(data);
      } catch (err) {
        console.error("❌ [WS] Parse error:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("🔌 [WS] Disconnected. Reconnecting in 3s...");
      setTimeout(() => this.connect(), 3000); // Tự động kết nối lại
    };

    this.ws.onerror = (error) => {
      console.error("⚠️ [WS] Socket Error:", error);
    };
  }

  send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
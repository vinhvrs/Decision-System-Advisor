<?php

namespace Platform\Plugins\Trading\Src\Services;

use WebSocket\Client;

class WebSocketConsumer
{
    protected $client;

    public function __construct()
    {
        // URL wss bạn muốn connect
        $this->client = new Client("wss://streamer.finance.yahoo.com");
    }

    public function subscribe(array $symbols)
    {
        $message = json_encode([
            "subscribe" => $symbols
        ]);

        $this->client->send($message);

        echo "Subscribed to: " . implode(", ", $symbols) . PHP_EOL;
    }

    public function listen()
    {
        while (true) {
            try {
                $data = $this->client->receive();

                // Yahoo Finance gửi dạng Base64 → decode
                $decoded = base64_decode($data);

                echo "Raw: $data\n";
                echo "Decoded: $decoded\n\n";

                // Bạn có thể xử lý JSON ở đây
                // $json = json_decode($decoded, true);
                // dd($json);

            } catch (\Exception $e) {
                echo "Error: {$e->getMessage()}\n";
                break;
            }
        }
    }
}

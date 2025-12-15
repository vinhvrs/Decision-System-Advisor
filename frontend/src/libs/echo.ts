/* eslint-disable @typescript-eslint/no-explicit-any */
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

if (typeof window !== 'undefined') {
  (window as any).Pusher = Pusher;
}

export function createEcho() {
  if (typeof window === 'undefined') return null;

  return new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_KEY, // ← key bạn đã dùng khi khởi tạo Reverb

    cluster: 'mt1', // ← Reverb không dùng, không ảnh hưởng
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST || '127.0.0.1',
    wsPort: parseInt(process.env.NEXT_PUBLIC_REVERB_PORT || '6001'),
    
    // wsPath: process.env.NEXT_PUBLIC_REVERB_PATH || '/app',
    forceTLS: false,
    encrypted: false,
    disableStats: true,
    enabledTransports: ['ws'],
  });
}

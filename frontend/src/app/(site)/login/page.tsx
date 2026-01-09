/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'; 

import React, { useState } from 'react';
import { AuthService } from '../../../services/Auth.service'; 

type AuthMode = 'login' | 'register';

// --- Component Form Đăng nhập (Login) ---
interface LoginFormProps {
  onSwitchMode: (mode: AuthMode) => void;
  onSuccess: () => void; // Thêm callback khi thành công
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchMode, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Thêm state xử lý lỗi

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null); // Reset lỗi

    try {
      // 🚀 GỌI HÀM LOGIN TỪ AUTHSERVICE
      const user = await AuthService.login({ email, password });
      
      console.log('Đăng nhập thành công, Người dùng:', user);
      onSuccess(); // Kích hoạt chuyển hướng/xử lý thành công

    } catch (err: any) {
      console.error("Lỗi đăng nhập:", err);
      // Giả định API trả về lỗi trong cấu trúc err.response.data.message
      const errorMessage = err.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Đăng nhập</h1>
        <p className="mt-2 text-sm text-gray-600">
          Sử dụng tài khoản của bạn
        </p>
      </div>

      {/* Hiển thị lỗi */}
      {error && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}
      
      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Trường Email */}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="nhap@email.com"
          />
        </div>

        {/* Trường Mật khẩu */}
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Mật khẩu</label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="********"
          />
        </div>

        {/* Nút Đăng nhập */}
        <button
          type="submit"
          disabled={isLoading}
          className={`flex w-full justify-center rounded-md py-2 px-4 text-sm font-medium text-white transition ${
            isLoading
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
      </form>

      {/* Chuyển sang Đăng ký */}
      <div className="mt-6 text-center text-sm">
        <p className="text-gray-600">
          Chưa có tài khoản?{' '}
          <button
            type="button"
            onClick={() => onSwitchMode('register')}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Đăng ký ngay
          </button>
        </p>
      </div>
    </>
  );
};


// --- Component Form Đăng ký (Register) ---
interface RegisterFormProps {
  onSwitchMode: (mode: AuthMode) => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchMode }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Thêm state xử lý lỗi

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null); // Reset lỗi

    try {
      // 🚀 GỌI HÀM REGISTER TỪ AUTHSERVICE
      // Lưu ý: Dữ liệu gửi đi bao gồm name, username, email, password
      const user = await AuthService.register({ name, username, email, password });
      
      console.log('Đăng ký thành công, Người dùng:', user);
      alert('Đăng ký thành công! Vui lòng đăng nhập.');
      onSwitchMode('login'); // Chuyển sang màn hình Đăng nhập sau khi đăng ký

    } catch (err) {
      console.error("Lỗi đăng ký:", err);
      // Giả định API trả về lỗi trong cấu trúc err.response.data.message
      const errorMessage = (err as any).response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Đăng ký</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tạo tài khoản mới của bạn
        </p>
      </div>

      {/* Hiển thị lỗi */}
      {error && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}
      
      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Trường Tên Đăng nhập */}
        <div>
          <label htmlFor="register-username" className="block text-sm font-medium text-gray-700">Tên đăng nhập</label>
          <input
            id="register-username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="NguyenVanA"
          />
        </div>

        {/* Trường Tên */}
        <div>
          <label htmlFor="register-name" className="block text-sm font-medium text-gray-700">Tên của bạn</label>
          <input
            id="register-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Nguyen Van A"
          />
        </div>

        {/* Trường Email */}
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="nhap@email.com"
          />
        </div>

        {/* Trường Mật khẩu */}
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-gray-700">Mật khẩu</label>
          <input
            id="register-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Tối thiểu 6 ký tự"
          />
        </div>

        {/* Nút Đăng ký */}
        <button
          type="submit"
          disabled={isLoading}
          className={`flex w-full justify-center rounded-md py-2 px-4 text-sm font-medium text-white transition ${
            isLoading
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isLoading ? 'Đang tạo...' : 'Đăng ký'}
        </button>
      </form>

      {/* Chuyển sang Đăng nhập */}
      <div className="mt-6 text-center text-sm">
        <p className="text-gray-600">
          Đã có tài khoản?{' '}
          <button
            type="button"
            onClick={() => onSwitchMode('login')}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Đăng nhập
          </button>
        </p>
      </div>
    </>
  );
};


// --- Component Container Chính ---
export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login'); // Mặc định là Login
  // const router = useRouter(); // Uncomment nếu bạn dùng Next.js router để chuyển hướng

  const handleAuthSuccess = () => {
    window.location.href = '/';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-10 shadow-xl">
        {mode === 'login' ? (
          <LoginForm 
            onSwitchMode={setMode} 
            onSuccess={handleAuthSuccess} // Truyền hàm xử lý thành công
          />
        ) : (
          <RegisterForm 
            onSwitchMode={setMode} 
          />
        )}
      </div>
    </div>
  );
}
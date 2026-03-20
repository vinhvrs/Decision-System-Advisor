/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'; 

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/src/services/Auth.service'; 
import Link from 'next/link';

type AuthMode = 'login' | 'register';

// --- Login Form Component ---
interface LoginFormProps {
  onSwitchMode: (mode: AuthMode) => void;
  onSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchMode, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const user = await AuthService.login({ email, password, remember });
      console.log('Login successful:', user);
      onSuccess();
    } catch (err: any) {
      console.error("Login error:", err);
      const errorMessage = err.response?.data?.message || "Login failed. Please check your email and password.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Sign In</h1>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm text-red-200 font-medium">
          {error}
        </div>
      )}
      
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-300">Email Address</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            placeholder="example@gmail.com"
          />
        </div>

        <div>
          <div className="flex justify-between items-center">
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-300">Password</label>
            <Link href="forgot" className="text-xs text-indigo-400 hover:text-indigo-300">
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center">
          <input
            id="login-remember"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
          />
          <label htmlFor="login-remember" className="ml-2 text-sm text-gray-400">
            Remember me (7 days)
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`flex w-full justify-center rounded-md py-2.5 px-4 text-sm font-semibold text-white transition shadow-lg ${
            isLoading
              ? 'bg-indigo-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
          }`}
        >
          {isLoading ? 'Processing...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <p className="text-gray-400">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => onSwitchMode('register')}
            className="font-medium text-indigo-400 hover:text-indigo-300 transition"
          >
            Create account
          </button>
        </p>
      </div>
    </>
  );
};

// --- Register Form Component ---
interface RegisterFormProps {
  onSwitchMode: (mode: AuthMode) => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchMode }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await AuthService.register({ name, username, email, password });
      alert('Registration successful! Please sign in.');
      onSwitchMode('login');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Registration failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Create Account</h1>
        <p className="mt-2 text-sm text-gray-400">
          Join us and start analyzing markets
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm text-red-200 font-medium">
          {error}
        </div>
      )}
      
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-300">Username</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="JohnDoe88"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Your Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="example@gmail.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="Min. 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`flex w-full justify-center rounded-md py-2.5 px-4 text-sm font-semibold text-white transition ${
            isLoading
              ? 'bg-green-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20'
          }`}
        >
          {isLoading ? 'Creating...' : 'Sign Up'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <p className="text-gray-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onSwitchMode('login')}
            className="font-medium text-indigo-400 hover:text-indigo-300"
          >
            Sign In
          </button>
        </p>
      </div>
    </>
  );
};

// --- Main Container ---
export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');

  const handleAuthSuccess = () => {
    router.replace('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0e14] p-4 text-gray-200">
      <div className="w-full max-w-md rounded-2xl bg-[#161a21] p-8 md:p-10 shadow-2xl border border-gray-800/50">
        {mode === 'login' ? (
          <LoginForm 
            onSwitchMode={setMode} 
            onSuccess={handleAuthSuccess} 
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
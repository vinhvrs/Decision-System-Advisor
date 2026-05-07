"use client";

import { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Settings, LogOut, Loader2, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthService } from '../services/Auth.service';
import { stripParentheticals } from "@/src/libs/displayString";

interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    phone?: string;
    role?: string;
}

interface UserProfileDropdownProps {
    user: User;
}

function UserProfileDropdown({ user }: UserProfileDropdownProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Xử lý đóng dropdown khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        setIsOpen(false);
        try {
            await AuthService.logout();
            router.replace("/auth/login");
        } catch (error) {
            console.error("Logout failed:", error);
            alert("Đăng xuất thất bại. Vui lòng thử lại.");
        } finally {
            setIsLoggingOut(false);
        }
    };

    // Hàm lấy chữ cái đầu của tên (ví dụ: "Nguyễn Văn A" -> N)
    const getInitial = (name: string): string => {
        if (!name) return 'U';
        return name.trim().charAt(0).toUpperCase();
    };

    const displayName = stripParentheticals(user.name || "").trim() || user.name || "User";

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Nút chính hiển thị Tên và Icon */}
            <button
                className="flex items-center gap-2 rounded-full px-2 py-1.5 text-white hover:bg-white/10 transition duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoggingOut} // Vô hiệu hóa khi đang xử lý đăng xuất
            >
                {/* Tên Người Dùng */}
                <span className="hidden sm:block font-semibold text-white/90">
                    {displayName}
                </span>
                {/* Avatar Initial */}
                <div className="w-8 h-8 rounded-full bg-white/15 text-indigo-200 flex items-center justify-center font-bold text-sm">
                    {getInitial(displayName)}
                </div>
                {/* Icon Dropdown */}
                <ChevronDown size={18} className="text-white/70" />
            </button>

            {/* Menu Dropdown */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-3 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1"
                >
                    <div className="px-4 py-2 text-sm text-gray-500 border-b mb-1">
                        Signed in as <span className="font-medium text-gray-800 break-words">{user.email}</span>
                    </div>

                    {/* Account Settings */}
                    <Link 
                        href="/profile" 
                        onClick={() => setIsOpen(false)}
                        className="flex items-center px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                    >
                        <Settings size={18} className="mr-3" />
                        Account Settings
                    </Link>

                    {/* Admin Dashboard */}
                    {(user.role === 'admin' || user.role === 'staff') && (
                        <Link 
                            href="/admin" 
                            onClick={() => setIsOpen(false)}
                            className="flex items-center px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                        >
                            <Shield size={18} className="mr-3" />
                            Admin Dashboard
                        </Link>
                    )}

                    {/* Log Out */}
                    <button 
                        onClick={handleLogout} 
                        disabled={isLoggingOut}
                        className="flex w-full items-center px-4 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoggingOut ? (
                            <Loader2 size={18} className="mr-3 animate-spin" />
                        ) : (
                            <LogOut size={18} className="mr-3" />
                        )}
                        {isLoggingOut ? 'Logging out...' : 'Log Out'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default memo(UserProfileDropdown);
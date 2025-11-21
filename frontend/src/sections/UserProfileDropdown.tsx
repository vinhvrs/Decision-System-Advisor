"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Settings, LogOut } from 'lucide-react';

/**
 * Menu Dropdown cho Tài khoản (Settings, Log Out)
 */
export default function UserProfileDropdown() {
    const [isOpen, setIsOpen] = useState(false);
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

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Nút chính hiển thị Tên và Icon */}
            <button
                className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 transition duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setIsOpen(!isOpen)}
            >
                {/* Tên Người Dùng */}
                <span className="font-semibold text-gray-800 hidden sm:block">
                    John Doe
                </span>
                {/* Avatar hoặc Initial (Tùy chọn) */}
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    JD
                </div>
                {/* Icon Dropdown */}
                <ChevronDown size={18} className="text-gray-600" />
            </button>

            {/* Menu Dropdown */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-3 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1"
                >
                    <div className="px-4 py-2 text-sm text-gray-500 border-b mb-1">
                        Signed in as <span className="font-medium text-gray-800">john.doe@example.com</span>
                    </div>

                    {/* Account Settings */}
                    <a href="/settings" className="flex items-center px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                        <Settings size={18} className="mr-3" />
                        Account Settings
                    </a>

                    {/* Log Out */}
                    <a href="/logout" className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 hover:text-red-700">
                        <LogOut size={18} className="mr-3" />
                        Log Out
                    </a>
                </div>
            )}
        </div>
    );
};
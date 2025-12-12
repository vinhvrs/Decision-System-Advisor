'use client'; // Bắt buộc phải là Client Component để truy cập localStorage

import { Menu, Search, X, LogIn, UserPlus } from "lucide-react"; // Thêm icon LogIn, UserPlus
import { useState, useEffect } from "react"; 
import Link from "next/link"; 
import UserProfileDropdown from "../../sections/UserProfileDropdown";

// Định nghĩa kiểu dữ liệu cơ bản cho người dùng
interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    phone?: string;
}

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // 1. State để lưu trữ thông tin người dùng đã đăng nhập
    const [user, setUser] = useState<User | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Trạng thái đang kiểm tra localStorage

    // Links cố định cho Navigation
    const navLinks = [
        { label: "News", href: "/news" },
        { label: "Indicators", href: "/indicators" },
        { label: "Documents", href: "/documents" },
        { label: "Contact", href: "/contact" },
    ];
    
    // 2. useEffect để kiểm tra trạng thái đăng nhập từ localStorage
    useEffect(() => {
        // Chỉ chạy trên client
        try {
            const userString = localStorage.getItem('user');
            if (userString) {
                const userData: User = JSON.parse(userString);
                setUser(userData);
            }
        } catch (error) {
            console.error("Lỗi khi đọc user từ localStorage:", error);
            setUser(null);
        } finally {
            setIsCheckingAuth(false);
        }

        // Tùy chọn: Thêm lắng nghe sự kiện để cập nhật header khi đăng nhập/đăng xuất ở component khác
        const handleStorageChange = () => {
            try {
                const userString = localStorage.getItem('user');
                setUser(userString ? JSON.parse(userString) : null);
            } catch (error) {
                setUser(null);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // 3. Hiển thị Loading hoặc không hiển thị gì trong lúc kiểm tra
    if (isCheckingAuth) {
        // Bạn có thể hiển thị một spinner hoặc return null
        return null; 
    }


    const renderAuthButtons = () => (
        <>
            <Link 
                href="/auth?mode=login" // Chuyển đến trang Auth, mặc định là login
                className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-blue-600 transition"
            >
                <LogIn size={16} />
                Đăng nhập
            </Link>
            <Link 
                href="/auth?mode=register" // Chuyển đến trang Auth, mặc định là register
                className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition"
            >
                <UserPlus size={16} />
                Đăng ký
            </Link>
        </>
    );

    return (
        <header className="bg-white shadow-lg p-4 sticky top-0 z-50 border-b border-gray-100">
            <div className="max-w-full mx-auto flex justify-between items-center h-12">
                
                {/* Logo & Search */}
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-2xl font-extrabold text-blue-700">
                        DSA
                    </Link>
                    
                    <div className="relative hidden md:block w-64 lg:w-80">
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã cổ phiếu, tin tức..."
                            className="p-2 pl-10 border border-gray-300 rounded-full w-full focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-sm"
                        />
                        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                {/* Navigation và User Profile/Auth Buttons */}
                <div className="flex items-center gap-4">
                    {/* Navigation cho Desktop */}
                    <nav className="hidden lg:flex items-center space-x-6">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-gray-600 hover:text-blue-600 font-medium transition duration-150 py-2 border-b-2 border-transparent hover:border-blue-600"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Nút Toggle Menu cho Mobile */}
                    <button
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition duration-150"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? (
                            <X size={24} className="text-gray-700" />
                        ) : (
                            <Menu size={24} className="text-gray-700" />
                        )}
                    </button>
                    
                    {/* KHU VỰC QUAN TRỌNG: Hiển thị Profile hoặc Nút Đăng nhập */}
                    {user ? (
                        <UserProfileDropdown user={user} /> // Truyền user data vào Dropdown
                    ) : (
                        renderAuthButtons()
                    )}
                </div>
            </div>

            {/* --- Menu Navigation Mobile --- */}
            <div 
                className={`lg:hidden transition-all duration-300 ease-in-out overflow-hidden ${
                    isMenuOpen ? 'max-h-96 opacity-100 py-2' : 'max-h-0 opacity-0'
                } border-t border-gray-100 mt-2`}
            >
                <nav className="flex flex-col space-y-2">
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            onClick={() => setIsMenuOpen(false)} 
                            className="text-gray-700 hover:text-blue-600 font-medium py-2 px-3 rounded-md hover:bg-gray-50 transition duration-150"
                        >
                            {link.label}
                        </Link>
                    ))}

                    {/* Hiển thị nút Auth trong menu mobile nếu chưa đăng nhập */}
                    {!user && (
                        <div className="flex justify-start gap-4 p-3 border-t mt-2">
                             <Link 
                                href="/auth?mode=login"
                                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600"
                                onClick={() => setIsMenuOpen(false)} 
                            >
                                <LogIn size={18} /> Đăng nhập
                            </Link>
                            <Link 
                                href="/auth?mode=register"
                                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                                onClick={() => setIsMenuOpen(false)} 
                            >
                                <UserPlus size={18} /> Đăng ký
                            </Link>
                        </div>
                    )}
                </nav>
            </div>
            {/* ---------------------------------------------------- */}
        </header>
    );
}
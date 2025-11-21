
import { Menu, Search } from "lucide-react";
import UserProfileDropdown from "../../sections/UserProfileDropdown";

export default function Header() {
    // Links cố định cho Navigation
    const navLinks = [
        { label: "News", href: "/news" },
        { label: "Indicators", href: "/indicators" },
        { label: "Documents", href: "/documents" },
        { label: "Contact", href: "/contact" },
    ];

    return (
        <header className="bg-white shadow-lg p-4 sticky top-0 z-50 border-b border-gray-100">
            <div className="max-w-full mx-auto flex justify-between items-center h-12">
                <div className="flex items-center gap-8">
                    {/* LOGO/BRAND */}
                    <span className="text-2xl font-extrabold text-blue-700">DSA</span>
                     <div className="relative hidden md:block w-64 lg:w-80">
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã cổ phiếu, tin tức..."
                            className="p-2 pl-10 border border-gray-300 rounded-full w-full focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-sm"
                        />
                        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                    
                </div>

                <div className="flex items-center gap-4">
                    <nav className="hidden lg:flex items-center space-x-6">
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="text-gray-600 hover:text-blue-600 font-medium transition duration-150 py-2 border-b-2 border-transparent hover:border-blue-600"
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>
                    <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition duration-150">
                        <Menu size={24} className="text-gray-700" />
                    </button>
                    <UserProfileDropdown />
                </div>
            </div>
        </header>
    );
}

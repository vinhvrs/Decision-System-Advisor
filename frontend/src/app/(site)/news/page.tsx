"use client";

import { useEffect, useState } from "react";
import newsService from "../../../services/News.service"; 
import { News } from "../../../types/News";
import Link from "next/link";

interface PaginationData {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
}

interface NewsResponse {
    data: News[]; 
    pagination: PaginationData;
}

export default function NewsListPage() {
    const [newsItems, setNewsItems] = useState<News[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const perPage = 10; 

    useEffect(() => {
        const fetchNews = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                const responseData: NewsResponse = await newsService.getAllNews(
                    { page: currentPage, per_page: perPage }
                );

                if (responseData && Array.isArray(responseData.data) && responseData.pagination) {
                    setNewsItems(responseData.data);
                    setTotalPages(responseData.pagination.totalPages);
                } else {
                    throw new Error("Dữ liệu phân trang nhận được không hợp lệ.");
                }
            } catch (err) {
                console.error("Lỗi khi tải tin tức từ API:", err);
                setError("Không thể tải tin tức. Vui lòng kiểm tra kết nối API.");
                setNewsItems([]); 
                setTotalPages(1);
            } finally {
                setIsLoading(false);
            }
        };

        fetchNews();
    }, [currentPage]);

    const handlePageChange = (page: number) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // LOGIC TẠO DÃY SỐ TRANG THÔNG MINH (1 2 3 ... N)
    const getPaginationRange = (current: number, total: number, maxVisible: number = 5): Array<number | string> => {
        if (total <= maxVisible) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        const start = 1;
        const end = total;
        const pages: Array<number | string> = [];
        const boundary = Math.floor(maxVisible / 2);

        let startRange = Math.max(2, current - boundary);
        let endRange = Math.min(total - 1, current + boundary);

        if (current <= boundary + 1) { 
            endRange = maxVisible - 1;
        } else if (current >= total - boundary) { 
            startRange = total - maxVisible + 2;
        }
        
        pages.push(start);

        if (startRange > 2) {
            pages.push('...');
        }

        for (let i = startRange; i <= endRange; i++) {
            pages.push(i);
        }

        if (endRange < total - 1) {
            pages.push('...');
        }

        if (!pages.includes(end)) {
            pages.push(end);
        }
        
        return pages.filter((value, index, self) => 
            self.indexOf(value) === index && !(value === '...' && self[index - 1] === '...')
        );
    };

    const pageRange = getPaginationRange(currentPage, totalPages);

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6 border-b pb-2 text-gray-800">
                📢 Tổng hợp Tin tức
            </h1>

            {isLoading ? (
                <p className="text-blue-500 font-semibold p-4">Đang tải tin tức...</p>
            ) : error ? (
                <p className="text-red-600 font-semibold p-4 border border-red-300 bg-red-50 rounded-lg">
                    {error}
                </p>
            ) : newsItems.length === 0 ? (
                <p className="text-gray-500 font-semibold">
                    Không có tin tức nào được đăng tải.
                </p>
            ) : (
                <>
                    <ul className="space-y-6 mb-8">
                        {newsItems.map((item) => (
                            <li
                                key={item.id || item.url_slug} 
                                className="p-5 border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition duration-300 bg-white"
                            >
                                <Link 
                                    href={`/news/${item.url_slug}`} 
                                    className="block"
                                >
                                    <h2 className="text-xl font-bold text-blue-600 hover:text-blue-800 transition duration-300">
                                        {item.topic}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Tác giả: {item.author} | Ngày: {new Date(item.published_at).toLocaleDateString("vi-VN")}
                                    </p>
                                    <p className="mt-3 text-gray-700 leading-relaxed">
                                        {item.content.substring(0, 150)}...
                                    </p>
                                    <span className="mt-2 inline-block text-sm text-blue-500 hover:underline">
                                        Xem chi tiết »
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* HIỂN THỊ PHÂN TRANG HOÀN CHỈNH */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center space-x-2">
                            {/* Nút Previous (<) */}
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`h-10 w-10 flex items-center justify-center border rounded-lg text-sm transition ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                                aria-label="Trang trước"
                            >
                                &lt;
                            </button>

                            {/* Các nút số trang và dấu '...' */}
                            {pageRange.map((page, index) => (
                                page === '...' ? (
                                    <span key={`dots-${index}`} className="px-2 py-2 text-gray-500">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(Number(page))}
                                        className={`h-10 w-10 flex items-center justify-center border rounded-lg text-sm transition ${Number(page) === currentPage ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}

                            {/* Nút Next (>) */}
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className={`h-10 w-10 flex items-center justify-center border rounded-lg text-sm transition ${currentPage === totalPages || totalPages === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-blue-600 hover:bg-blue-50'}`}
                                aria-label="Trang sau"
                            >
                                &gt;
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
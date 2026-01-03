"use client";

import { useEffect, useState } from "react";

// --- Interfaces based on new API (https://saham-production-0abd.up.railway.app/api/all-data) ---

interface StockData {
    Code: string;
    Name: string;
    Previous: number;
    High?: number;
    Low?: number;
    Last: number;
    Change?: number;
    ChangePct?: number; // Can be null
}

interface GoldData {
    LastUpdate: string;
    Source: string;
    Data: {
        Spot: { Unit: string; USD: number; IDR: number }[];
        Antam: { weight: number; price: number }[];
        UBS: { weight: number; price: number }[];
    };
}

interface CryptoItem {
    Code: string; // BTC, ETH, USDT
    Name: string;
    Price: number;
    High: number;
    Low: number;
    Vol_IDR: number;
}

interface CryptoData {
    LastUpdate: string;
    Source: string;
    Data: CryptoItem[];
}

interface ApiResponse {
    stocks: {
        LastUpdate: string;
        TotalItems: number;
        Stocks: StockData[];
    };
    gold: GoldData;
    crypto: CryptoData;
    server_time: string;
}

export default function InvestmentPage() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Pagination & Sorting States
    const [currentPage, setCurrentPage] = useState(1);
    const [sortBy, setSortBy] = useState<'gainers' | 'losers' | 'az' | 'price_desc'>('gainers');
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Direct call to new API
                const res = await fetch('https://saham-production-0abd.up.railway.app/api/all-data');
                const result: ApiResponse = await res.json();
                setData(result);
            } catch (e) {
                console.error("Failed to fetch investment data:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    // Filter, Sort, and Paginate Logic
    const getProcessedStocks = () => {
        if (!data) return { paginated: [], totalPages: 0, totalItems: 0 };

        let processed = [...data.stocks.Stocks];

        // 1. Search Filter
        if (search) {
            const query = search.toUpperCase();
            processed = processed.filter(s =>
                s.Code.includes(query) || s.Name.toUpperCase().includes(query)
            );
        }

        // 2. Sorting
        switch (sortBy) {
            case 'gainers':
                processed.sort((a, b) => (b.ChangePct || 0) - (a.ChangePct || 0));
                break;
            case 'losers':
                processed.sort((a, b) => (a.ChangePct || 0) - (b.ChangePct || 0));
                break;
            case 'az':
                processed.sort((a, b) => a.Code.localeCompare(b.Code));
                break;
            case 'price_desc': // Proxy for "Big Cap/Bluechip" request
                processed.sort((a, b) => b.Last - a.Last);
                break;
        }

        // 3. Pagination
        const totalItems = processed.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginated = processed.slice(startIndex, startIndex + itemsPerPage);

        return { paginated, totalPages, totalItems };
    };

    const { paginated: currentStocks, totalPages, totalItems } = getProcessedStocks();

    // Reset page on search/sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [search, sortBy]);

    const formatCurrency = (val: number, currency = 'IDR') => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(val).replace('Rp', 'Rp ');
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    // Helper for formatting date
    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }) + " WIB";
    };

    // --- Sub-Components ---

    const GoldCard = () => {
        if (!data) return null;
        const spotGold = data.gold.Data.Spot.find(s => s.Unit === 'Gram (gr)');
        const antam1g = data.gold.Data.Antam.find(a => a.weight === 1);
        const ubs1g = data.gold.Data.UBS.find(u => u.weight === 1);

        return (
            <div className="glass-card-premium p-6 rounded-3xl border border-yellow-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/20 transition-all"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 flex items-center justify-center bg-yellow-500/20 rounded-xl text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                            <span className="material-symbols-outlined">stars</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">Emas & Logam Mulia</h3>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">schedule</span>
                                Update: {formatDateTime(data.gold.LastUpdate)}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {spotGold && (
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <span className="text-slate-400 text-sm">Spot (IDR/gr)</span>
                                <span className="text-xl font-bold text-white tracking-tight">{formatCurrency(spotGold.IDR || 0)}</span>
                            </div>
                        )}
                        {antam1g && (
                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                <span className="text-slate-400 text-sm">Antam (1g)</span>
                                <span className="text-xl font-bold text-yellow-400 tracking-tight">{formatCurrency(antam1g.price)}</span>
                            </div>
                        )}
                        {ubs1g && (
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-sm">UBS (1g)</span>
                                <span className="text-xl font-bold text-yellow-200 tracking-tight">{formatCurrency(ubs1g.price)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const CryptoCard = () => {
        if (!data) return null;
        // Prioritize BTC, ETH, USDT
        const coins = data.crypto.Data;

        return (
            <div className="glass-card-premium p-6 rounded-3xl border border-blue-500/20 relative overflow-hidden group h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 flex items-center justify-center bg-blue-500/20 rounded-xl text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                            <span className="material-symbols-outlined">currency_bitcoin</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white leading-tight">Crypto Market</h3>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">schedule</span>
                                Update: {formatDateTime(data.crypto.LastUpdate)}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {coins.map((coin) => (
                            <div key={coin.Code} className="flex justify-between items-center bg-white/5 p-3 rounded-xl hover:bg-white/10 transition-colors border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${coin.Code === 'BTC' ? 'bg-orange-500/20 text-orange-400' :
                                        coin.Code === 'ETH' ? 'bg-purple-500/20 text-purple-400' :
                                            'bg-green-500/20 text-green-400'
                                        }`}>
                                        {coin.Code[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white leading-none mb-1">{coin.Code}</div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{coin.Name}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-white tracking-tight">{formatCurrency(coin.Price)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col">
            <main className="flex-1 flex flex-col items-center py-8 px-4 md:px-8">
                <div className="max-w-7xl w-full space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-end border-b border-rose-500/20 pb-6 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200">
                                Market <span className="text-rose-500">Monitor</span>
                            </h1>
                            <p className="text-slate-400 mt-2">Real-time data: Saham IDX, Emas & Crypto.</p>
                        </div>
                        {data && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Live Connection
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <div className="w-12 h-12 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                            <p className="text-slate-400 animate-pulse font-medium">Authorizing Railway API...</p>
                        </div>
                    ) : !data ? (
                        <div className="text-center bg-red-500/10 border border-red-500/20 p-12 rounded-3xl">
                            <span className="material-symbols-outlined text-4xl text-red-400 mb-2">cloud_off</span>
                            <p className="text-red-200">Gagal terhubung ke Server Data.</p>
                        </div>
                    ) : (
                        <>
                            {/* TOP SECTION: Gold & Crypto */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                                <GoldCard />
                                <CryptoCard />
                            </div>

                            {/* STOCKS SECTION */}
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">

                                {/* Market Header + Sort Filter + Search */}
                                <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        <div className="w-12 h-12 flex items-center justify-center bg-rose-500/20 rounded-xl text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                                            <span className="material-symbols-outlined">table_chart</span>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white leading-tight">Pasar Saham (IDX)</h3>
                                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                                <span>{totalItems} Emiten</span>
                                                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                    Update: {formatDateTime(data.stocks.LastUpdate)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                                        {/* Sort Buttons */}
                                        <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5">
                                            <button
                                                onClick={() => setSortBy('gainers')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'gainers' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                Top Gainers
                                            </button>
                                            <button
                                                onClick={() => setSortBy('losers')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'losers' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                Top Losers
                                            </button>
                                            <button
                                                onClick={() => setSortBy('price_desc')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'price_desc' ? 'bg-yellow-500/20 text-yellow-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                                title="Urutkan berdasarkan Harga Tertinggi"
                                            >
                                                Highest Price
                                            </button>
                                            <button
                                                onClick={() => setSortBy('az')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'az' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                A-Z
                                            </button>
                                        </div>

                                        {/* Search */}
                                        <div className="relative w-full md:w-64 group">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-rose-400 transition-colors text-lg">search</span>
                                            <input
                                                type="text"
                                                placeholder="Cari (BBCA)..."
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-rose-500/50 transition-colors placeholder:text-slate-600 text-sm font-medium"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Stocks Table */}
                                <div className="bg-[#0f0f13] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/[0.02] text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-white/5">
                                                    <th className="p-5 text-center w-16">No</th>
                                                    <th className="p-5">Kode</th>
                                                    <th className="p-5">Nama Emiten</th>
                                                    <th className="p-5 text-right">Tertinggi</th>
                                                    <th className="p-5 text-right">Terendah</th>
                                                    <th className="p-5 text-right">Penutupan</th>
                                                    <th className="p-5 text-right">Selisih</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-sm">
                                                {currentStocks.map((stock, index) => (
                                                    <tr key={stock.Code} className="hover:bg-white/[0.03] transition-colors group">
                                                        <td className="p-5 text-center text-slate-600 group-hover:text-slate-400 font-medium">
                                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="font-black text-white tracking-wide">{stock.Code}</div>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="text-slate-400 group-hover:text-slate-200 transition-colors truncate max-w-[240px]" title={stock.Name}>{stock.Name}</div>
                                                        </td>
                                                        <td className="p-5 text-right font-medium text-slate-500 group-hover:text-slate-400">
                                                            {formatCurrency(stock.High || 0)}
                                                        </td>
                                                        <td className="p-5 text-right font-medium text-slate-500 group-hover:text-slate-400">
                                                            {formatCurrency(stock.Low || 0)}
                                                        </td>
                                                        <td className="p-5 text-right">
                                                            <span className="font-bold text-white bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">{formatCurrency(stock.Last)}</span>
                                                        </td>
                                                        <td className="p-5 text-right">
                                                            <div className={`flex flex-col items-end gap-0.5 ${(stock.Change || 0) > 0 ? 'text-green-400' : (stock.Change || 0) < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                                <span className="font-bold text-sm">
                                                                    {(stock.Change || 0) > 0 ? '+' : ''}{stock.Change}
                                                                </span>
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${(stock.Change || 0) > 0 ? 'bg-green-500/10' : (stock.Change || 0) < 0 ? 'bg-rose-500/10' : 'bg-slate-500/10'}`}>
                                                                    {(stock.ChangePct || 0) >= 0 ? '+' : ''}{stock.ChangePct ? stock.ChangePct.toFixed(2) : "0.00"}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {currentStocks.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="p-16 text-center text-slate-500">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                                                                <p>Tidak ada emiten ditemukan.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2 px-1">
                                        <div className="text-sm text-slate-500 font-medium">
                                            Menampilkan <span className="text-white font-bold">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)}</span> dari <span className="text-white font-bold">{totalItems}</span> data
                                        </div>

                                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-2xl border border-white/5">
                                            <button
                                                onClick={() => handlePageChange(1)}
                                                disabled={currentPage === 1}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-transparent hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                                title="First Page"
                                            >
                                                <span className="material-symbols-outlined text-lg">first_page</span>
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-transparent hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                                title="Previous Page"
                                            >
                                                <span className="material-symbols-outlined text-lg">chevron_left</span>
                                            </button>

                                            <div className="px-4 py-1.5 rounded-xl bg-white/10 border border-white/5 text-white font-bold text-xs min-w-[80px] text-center">
                                                Page {currentPage} / {totalPages}
                                            </div>

                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-transparent hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                                title="Next Page"
                                            >
                                                <span className="material-symbols-outlined text-lg">chevron_right</span>
                                            </button>
                                            <button
                                                onClick={() => handlePageChange(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-transparent hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                                title="Last Page"
                                            >
                                                <span className="material-symbols-outlined text-lg">last_page</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

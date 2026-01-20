"use client";

import { useEffect, useState } from "react";

// --- Interfaces for New APIs ---

interface GoldData {
    pegadaian: {
        ubs: { weight: number; price: number }[];
        g24: { weight: number; price: number }[];
        antam: { weight: number; price: number }[];
    };
    hargaEmas: {
        antam: { weight: number; price: number }[];
        ubs: { weight: number; price: number }[];
        spot: { unit: string; usd: number; idr: number }[];
    };
    worldGold: {
        priceUSD: number;
        changeUSD: number;
        changePct: number;
        date: string;
    };
    lastUpdate: string;
}

interface CryptoData {
    lastUpdate: string;
    source: string;
    total: number;
    data: {
        symbol: string;
        pair: string;
        price: number;
        change: number;
        high: number;
        low: number;
        volume: number;
    }[];
}

interface IDXData {
    lastUpdate: string;
    source: string;
    total: number;
    data: {
        symbol: string;
        name: string;
        price: number;
        change: number;
        changePct: number;
        high: number;
        low: number;
    }[];
}

interface USStockData {
    lastUpdate: string;
    source: string;
    total: number;
    data: {
        symbol: string;
        name: string;
        price: number;
        change: number;
        changePct: number;
        marketCap: number;
    }[];
}

export default function InvestmentPage() {
    // Data States
    const [goldData, setGoldData] = useState<GoldData | null>(null);
    const [cryptoData, setCryptoData] = useState<CryptoData | null>(null);
    const [idxData, setIdxData] = useState<IDXData | null>(null);
    const [usData, setUsData] = useState<USStockData | null>(null);

    // UI States
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'IDX' | 'US' | 'CRYPTO'>('IDX');
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<'gainers' | 'losers' | 'az' | 'price_desc'>('gainers');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const fetchData = async () => {
        try {
            const [goldRes, cryptoRes, idxRes, usRes] = await Promise.allSettled([
                fetch('https://investasi-plum.vercel.app/api/gold'),
                fetch('https://investasi-plum.vercel.app/api/crypto'),
                fetch('https://investasi-plum.vercel.app/api/idx'),
                fetch('https://investasi-plum.vercel.app/api/us-stocks')
            ]);

            if (goldRes.status === 'fulfilled') setGoldData(await goldRes.value.json());
            if (cryptoRes.status === 'fulfilled') setCryptoData(await cryptoRes.value.json());
            if (idxRes.status === 'fulfilled') setIdxData(await idxRes.value.json());
            if (usRes.status === 'fulfilled') setUsData(await usRes.value.json());

        } catch (e) {
            console.error("Error fetching data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    // Reset pagination when filter/tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [search, sortBy, activeTab]);

    // --- Helpers ---

    const formatCurrency = (val: number, currency = 'IDR') => {
        return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'id-ID', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: currency === 'USD' ? 2 : 0
        }).format(val).replace('Rp', 'Rp ');
    };

    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }) + " WIB";
    };

    const formatLargeNumber = (num?: number) => {
        if (!num) return "-";
        if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        return num.toLocaleString();
    };

    // --- Processing Logic ---

    const getProcessedStocks = () => {
        let allItems: any[] = [];
        let total = 0;

        if (activeTab === 'IDX' && idxData) {
            allItems = [...idxData.data];
            total = idxData.total;
        } else if (activeTab === 'US' && usData) {
            allItems = [...usData.data];
            total = usData.total;
        } else if (activeTab === 'CRYPTO' && cryptoData) {
            // Calculate changePct for Crypto since API doesn't provide it
            allItems = cryptoData.data.map(item => {
                const prevPrice = item.price - item.change;
                const changePct = prevPrice !== 0 ? (item.change / prevPrice) * 100 : 0;
                return { ...item, changePct };
            });
            total = cryptoData.total;
        }

        // 1. Search
        if (search) {
            const query = search.toUpperCase();
            allItems = allItems.filter(item => {
                if (activeTab === 'CRYPTO') {
                    // Item now has changePct, but original properties remain
                    return item.symbol.includes(query) || (item.pair && item.pair.toUpperCase().includes(query));
                }
                return item.symbol.includes(query) || item.name.toUpperCase().includes(query);
            });
        }

        // 2. Sort
        switch (sortBy) {
            case 'gainers':
                allItems.sort((a, b) => b.changePct - a.changePct);
                break;
            case 'losers':
                allItems.sort((a, b) => a.changePct - b.changePct);
                break;
            case 'az':
                allItems.sort((a, b) => a.symbol.localeCompare(b.symbol));
                break;
            case 'price_desc':
                allItems.sort((a, b) => b.price - a.price);
                break;
        }

        // 3. Paginate
        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginated = allItems.slice(startIndex, startIndex + itemsPerPage);

        return { paginated, totalPages, totalItems };
    };

    const { paginated: currentItems, totalPages, totalItems } = getProcessedStocks();

    // --- Sub-Components ---

    const GoldCard = () => {
        const [goldTab, setGoldTab] = useState<'spot' | 'antam' | 'pegadaian' | 'ubs'>('spot');

        if (!goldData) return null;

        // Spot Data
        const spotIDR = goldData.hargaEmas.spot.find(s => s.unit === 'Gram (gr)' || s.unit.toLowerCase().includes('gram'))?.idr;
        const spotUSD = goldData.hargaEmas.spot.find(s => s.unit === 'Ounce (oz)' || s.unit.toLowerCase().includes('ounce'))?.usd;

        // Helper to render simple weight table
        const renderTable = (items: { weight: number, price: number }[], label: string) => (
            <div className="overflow-x-auto no-scrollbar max-h-[250px] overflow-y-auto pr-1">
                <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#0f0f13]/90 backdrop-blur-sm z-10 text-xs uppercase text-slate-500 font-bold">
                        <tr>
                            <th className="py-2">Berat</th>
                            <th className="py-2 text-right">Harga</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {items.map((item, idx) => (
                            <tr key={`${label}-${item.weight}-${idx}`} className="hover:bg-white/5 transition-colors">
                                <td className="py-2 font-medium text-slate-300">{item.weight}g</td>
                                <td className="py-2 text-right font-bold text-yellow-500 tracking-wide">{formatCurrency(item.price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );

        return (
            <div className="glass-card-premium p-6 rounded-3xl border border-yellow-500/20 relative overflow-hidden group h-full flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/20 transition-all"></div>
                <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 flex items-center justify-center bg-yellow-500/20 rounded-xl text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)] shrink-0">
                            <span className="material-symbols-outlined">stars</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-tight">Emas (Gold)</h3>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">schedule</span>
                                Update: {formatDateTime(goldData.lastUpdate)}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-black/30 p-1 rounded-xl mb-4 overflow-x-auto no-scrollbar gap-1">
                        {(['spot', 'antam', 'pegadaian', 'ubs'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setGoldTab(tab)}
                                className={`flex-1 min-w-[60px] py-1.5 px-3 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${goldTab === tab ? 'bg-yellow-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-[200px]">
                        {goldTab === 'spot' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                        <div>
                                            <span className="text-slate-400 text-sm block">World (USD/oz)</span>
                                            <span className={`text-[10px] font-bold ${goldData.worldGold.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {goldData.worldGold.changePct >= 0 ? '+' : ''}{goldData.worldGold.changeUSD} ({goldData.worldGold.changePct}%)
                                            </span>
                                        </div>
                                        <span className="text-2xl font-bold text-yellow-100 tracking-tight">{formatCurrency(spotUSD || 0, 'USD')}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                        <div>
                                            <span className="text-slate-400 text-sm block">Spot (IDR/gr)</span>
                                            <span className="text-[10px] text-slate-500">Converted</span>
                                        </div>
                                        <span className="text-xl font-bold text-white tracking-tight">{formatCurrency(spotIDR || 0, 'IDR')}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-slate-400 text-sm block">Data Source</span>
                                            <span className="text-[10px] text-slate-500">GoldAPI & LogamMulia</span>
                                        </div>
                                        <span className="text-xs text-yellow-500/80 font-mono">LIVE</span>
                                    </div>
                                    <div className="mt-4 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/10">
                                        <p className="text-[10px] text-yellow-100/70 leading-relaxed text-center">
                                            Harga Spot adalah acuan pasar dunia. Harga fisik (Antam/UBS) mencakup biaya cetak & distribusi.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {goldTab === 'antam' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                {renderTable(goldData.hargaEmas.antam || [], 'antam')}
                            </div>
                        )}

                        {goldTab === 'pegadaian' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1">Galeri 24</h4>
                                    {renderTable(goldData.pegadaian.g24 || [], 'g24')}
                                </div>
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1">UBS (via Pegadaian)</h4>
                                    {renderTable(goldData.pegadaian.ubs || [], 'pegadaian-ubs')}
                                </div>
                            </div>
                        )}

                        {goldTab === 'ubs' && (
                            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                                {renderTable(goldData.hargaEmas.ubs || [], 'ubs')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const CryptoCard = () => {
        if (!cryptoData || !cryptoData.data || cryptoData.data.length === 0) return null;

        // Strategy: Sort by Volume Descending (Most Active) -> Show Top 5
        const topCoins = [...cryptoData.data]
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);

        return (
            <div className="glass-card-premium p-6 rounded-3xl border border-blue-500/20 relative overflow-hidden group h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 flex items-center justify-center bg-blue-500/20 rounded-xl text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                            <span className="material-symbols-outlined">currency_bitcoin</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-tight">Crypto Assets</h3>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">schedule</span>
                                Update: {formatDateTime(cryptoData.lastUpdate)}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {topCoins.map((coin) => (
                            <div key={coin.symbol} className="flex justify-between items-center bg-white/5 p-2.5 rounded-xl hover:bg-white/10 transition-colors border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shadow-inner 
                                        ${coin.symbol === 'BTC' ? 'bg-orange-500/20 text-orange-400' :
                                            coin.symbol === 'ETH' ? 'bg-purple-500/20 text-purple-400' :
                                                coin.symbol === 'SOL' ? 'bg-teal-500/20 text-teal-400' :
                                                    'bg-green-500/20 text-green-400'}`}>
                                        {coin.symbol.substring(0, 3)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-sm leading-none mb-0.5">{coin.symbol}</div>
                                        <div className="text-[9px] text-slate-400 uppercase">{coin.pair}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-white tracking-tight text-xs">{formatCurrency(coin.price, 'IDR')}</div>
                                    <div className={`text-[9px] font-bold ${coin.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {coin.change >= 0 ? '+' : ''}{coin.change.toLocaleString()}
                                    </div>
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
            <main className="flex-1 flex flex-col items-center py-4 px-3 md:py-8 md:px-8">
                <div className="max-w-7xl w-full space-y-6 md:space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-center md:items-end border-b border-rose-500/20 pb-4 md:pb-6 gap-3 md:gap-4">
                        <div className="text-center md:text-left">
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200">
                                Market <span className="text-rose-500">Monitor</span>
                            </h1>
                            <p className="text-slate-400 text-xs md:text-base mt-1 md:mt-2">Real-time Data: IDX, US Stocks, Gold & Crypto.</p>
                        </div>
                        {(!loading && (goldData || idxData)) && (
                            <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 bg-white/5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-white/5">
                                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Live APIs Connected
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 md:py-32 gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                            <p className="text-slate-400 text-sm md:text-base animate-pulse font-medium">Fetching Market Data...</p>
                        </div>
                    ) : (
                        <>
                            {/* TOP SECTION */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <GoldCard />
                                <CryptoCard />
                            </div>

                            {/* STOCKS SECTION */}
                            <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">

                                {/* CONTROLS */}
                                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 md:gap-4 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/10 backdrop-blur-sm">

                                    {/* Tabs */}
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto">
                                        <div className="flex w-full md:w-auto p-1 bg-black/40 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
                                            <button
                                                onClick={() => setActiveTab('IDX')}
                                                className={`flex-1 md:flex-none px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'IDX' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <span className="material-symbols-outlined text-base md:text-lg">flag</span>
                                                IDX
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('US')}
                                                className={`flex-1 md:flex-none px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'US' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <span className="material-symbols-outlined text-base md:text-lg">public</span>
                                                US
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('CRYPTO')}
                                                className={`flex-1 md:flex-none px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap ${activeTab === 'CRYPTO' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                <span className="material-symbols-outlined text-base md:text-lg">currency_bitcoin</span>
                                                Crypto
                                            </button>
                                        </div>

                                        {/* Update Time Indicator */}
                                        <div className="hidden md:flex flex-col">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Last Update</span>
                                            <span className="text-xs text-white font-medium">
                                                {activeTab === 'IDX' ? formatDateTime(idxData?.lastUpdate) :
                                                    activeTab === 'US' ? formatDateTime(usData?.lastUpdate) :
                                                        formatDateTime(cryptoData?.lastUpdate)}
                                            </span>
                                        </div>
                                    </div>


                                    {/* Sort & Search */}
                                    <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                                        <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full md:w-auto overflow-x-auto no-scrollbar">
                                            {[
                                                { id: 'gainers', label: 'Gainers', color: 'green' },
                                                { id: 'losers', label: 'Losers', color: 'red' },
                                                { id: 'price_desc', label: 'Price', color: 'yellow' },
                                                { id: 'az', label: 'A-Z', color: 'blue' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setSortBy(opt.id as any)}
                                                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap transition-all ${sortBy === opt.id ? `bg-${opt.color}-500/20 text-${opt.color}-400` : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="relative w-full md:w-64">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base md:text-lg">search</span>
                                            <input
                                                type="text"
                                                placeholder={`Cari ${activeTab === 'IDX' ? 'BBCA' : activeTab === 'CRYPTO' ? 'BTC' : 'NVDA'}...`}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-1.5 md:py-2 pl-9 md:pl-10 pr-4 text-white focus:outline-none focus:border-rose-500/50 transition-colors placeholder:text-slate-600 text-xs md:text-sm"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* TABLE */}
                                <div className="bg-[#0f0f13] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative min-h-[400px]">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[350px] md:min-w-[600px]">
                                            <thead>
                                                <tr className="bg-white/[0.02] text-slate-400 text-[10px] md:text-[11px] font-bold uppercase tracking-wider border-b border-white/5">
                                                    <th className="p-2 md:p-4 w-8 md:w-12 text-center text-[9px] md:text-[11px]">No</th>
                                                    <th className="p-2 md:p-4">Symbol</th>
                                                    <th className="hidden sm:table-cell p-2 md:p-4">{activeTab === 'CRYPTO' ? 'Global Pair' : 'Reference Name'}</th>
                                                    <th className="p-2 md:p-4 text-right">Price</th>
                                                    <th className="p-2 md:p-4 text-right">Change</th>
                                                    <th className="hidden sm:table-cell p-2 md:p-4 text-right">
                                                        {activeTab === 'IDX' ? 'Range (H/L)' :
                                                            activeTab === 'CRYPTO' ? 'Range & Vol' : 'Market Cap'}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-[10px] md:text-sm">
                                                {currentItems.map((item, index) => (
                                                    <tr key={`${item.symbol}-${index}`} className="hover:bg-white/[0.03] transition-colors group">
                                                        <td className="p-2 md:p-4 text-center text-slate-600">
                                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                                        </td>
                                                        <td className="p-2 md:p-4">
                                                            <div className="font-black text-white tracking-wide text-xs md:text-sm">{item.symbol}</div>
                                                            {/* Mobile Only Sub-label */}
                                                            <div className="sm:hidden text-[9px] text-slate-500 truncate max-w-[80px]" title={item.name || item.pair}>
                                                                {activeTab === 'CRYPTO' ? item.pair?.toUpperCase() : item.name}
                                                            </div>
                                                        </td>
                                                        <td className="hidden sm:table-cell p-2 md:p-4">
                                                            <div className="text-slate-400 truncate max-w-[200px]" title={item.name || item.pair}>
                                                                {activeTab === 'CRYPTO' ? item.pair?.toUpperCase() : item.name}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 md:p-4 text-right">
                                                            <span className="font-bold text-white bg-white/5 px-1.5 py-0.5 md:px-2 md:py-1 rounded md:rounded-lg border border-white/5 whitespace-nowrap">
                                                                {formatCurrency(item.price, activeTab === 'US' ? 'USD' : 'IDR')}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 md:p-4 text-right">
                                                            <div className={`flex flex-col items-end gap-0.5 ${(item.changePct || 0) >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                                                                <span className="font-bold text-[10px] md:text-xs whitespace-nowrap">
                                                                    {(item.change || 0) >= 0 ? '+' : ''}{(item.change || 0).toLocaleString()}
                                                                </span>
                                                                <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md ${(item.changePct || 0) >= 0 ? 'bg-green-500/10' : 'bg-rose-500/10'}`}>
                                                                    {(item.changePct || 0) >= 0 ? '+' : ''}{(item.changePct || 0).toFixed(2)}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="hidden sm:table-cell p-2 md:p-4 text-right text-slate-500 font-medium text-xs">
                                                            {activeTab === 'IDX' ? (
                                                                <div className="flex flex-col items-end">
                                                                    <span>H: {item.high}</span>
                                                                    <span>L: {item.low}</span>
                                                                </div>
                                                            ) : activeTab === 'CRYPTO' ? (
                                                                <div className="flex flex-col items-end gap-0.5">
                                                                    <span className="text-slate-400">H: {formatCurrency(item.high, 'IDR')}</span>
                                                                    <span className="text-slate-400">L: {formatCurrency(item.low, 'IDR')}</span>
                                                                    <span className="text-[10px] text-slate-600 font-mono mt-0.5">Vol: {formatLargeNumber(item.volume)}</span>
                                                                </div>
                                                            ) : (
                                                                <span>{formatLargeNumber(item.marketCap)}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {currentItems.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 md:p-16 text-center text-slate-500">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                                                                <p className="text-xs md:text-sm">No assets found.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* PAGINATION */}
                                {totalPages > 1 && (
                                    <div className="flex flex-row justify-between items-center gap-2 pt-2 px-1">
                                        <div className="text-[10px] md:text-xs text-slate-500">
                                            <span className="hidden xs:inline">Showing </span>
                                            <span className="text-white font-bold">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-white font-bold">{totalItems}</span>
                                        </div>

                                        <div className="flex items-center gap-1 md:gap-2 bg-black/20 p-1 rounded-xl md:rounded-2xl border border-white/5">
                                            <button
                                                onClick={() => setCurrentPage(1)}
                                                disabled={currentPage === 1}
                                                className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-lg md:rounded-xl hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-base md:text-lg">first_page</span>
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-lg md:rounded-xl hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-base md:text-lg">chevron_left</span>
                                            </button>

                                            <div className="px-2 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl bg-white/10 text-white font-bold text-[10px] md:text-xs min-w-[50px] text-center">
                                                {currentPage} / {totalPages}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-lg md:rounded-xl hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-base md:text-lg">chevron_right</span>
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-lg md:rounded-xl hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-base md:text-lg">last_page</span>
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

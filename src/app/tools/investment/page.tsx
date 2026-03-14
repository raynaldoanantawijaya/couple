"use client";

import { useEffect, useState, useMemo } from "react";

// --- Interfaces for New APIs ---

interface GoldProduct {
    name: string;
    weight: number;
    sellPrice: number;
    buybackPrice: number;
    productType: string;
    image: string;
}

interface WeightPrice {
    vendor: string;
    weight: string;
    sellPrice: number;
    buybackPrice: number;
}

interface SpotPrice {
    vendor: string;
    sellPrice: number;
    buybackPrice: number;
    date: string;
    changeSell: number;
    changeBuy: number;
}

interface RawTable {
    title: string;
    headers: string[];
    rows: Record<string, string>[];
}

interface GoldSource {
    spotPrices: SpotPrice[];
    weightPrices: WeightPrice[];
    rawTables: RawTable[];
    products: GoldProduct[];
    totalProducts: number;
    lastUpdate: string;
}

interface GoldData {
    galeri24: GoldSource;
    hargaEmas: GoldSource;
    logamMulia: GoldSource;
    source: string;
}

interface CryptoItem {
    symbol: string;
    pair: string;
    price: number;
    change: number;
    changePct: number;
    high: number;
    low: number;
    volume: number;
    marketCap: number;
    name: string;
}

interface CryptoData {
    lastUpdate: string;
    source: string;
    total: number;
    data: CryptoItem[];
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
        volume: number;
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
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<'gainers' | 'losers' | 'az' | 'price_desc'>('gainers');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Gold State
    const [activeGoldTab, setActiveGoldTab] = useState<'hargaEmas' | 'galeri24' | 'logamMulia'>('hargaEmas');

    const fetchData = async () => {
        try {
            const [goldRes, cryptoRes, idxRes] = await Promise.allSettled([
                fetch('/api/market/gold'),
                fetch('/api/market/crypto'),
                fetch('/api/market/idx')
            ]);

            if (goldRes.status === 'fulfilled') setGoldData(await goldRes.value.json());
            if (cryptoRes.status === 'fulfilled') setCryptoData(await cryptoRes.value.json());
            if (idxRes.status === 'fulfilled') setIdxData(await idxRes.value.json());
            // US Data is coming soon
            setUsData(null);

        } catch (e) {
            console.error("Error fetching data:", e);
        } finally {
            setLoading(false);
        }
    };

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        fetchData();
        const interval = setInterval(fetchData, 60000); // 1 min refresh
        return () => clearInterval(interval);
    }, []);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setSearch(searchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchInput]);

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

    const { paginated: currentItems, totalPages, totalItems } = useMemo(() => {
        let allItems: any[] = [];
        let total = 0;

        if (activeTab === 'IDX' && idxData) {
            allItems = [...idxData.data];
            total = idxData.total;
        } else if (activeTab === 'US' && usData) {
            allItems = [...usData.data];
            total = usData.total;
        } else if (activeTab === 'CRYPTO' && cryptoData) {
            allItems = [...cryptoData.data];
            total = cryptoData.total;
        }

        // 1. Search
        if (search) {
            const query = search.toUpperCase();
            allItems = allItems.filter(item => {
                if (activeTab === 'CRYPTO') {
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
        const tItems = allItems.length;
        const tPages = Math.ceil(tItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginated = allItems.slice(startIndex, startIndex + itemsPerPage);

        return { paginated, totalPages: tPages, totalItems: tItems };
    }, [activeTab, idxData, usData, cryptoData, search, sortBy, currentPage]);

    // --- Sub-Components ---

    const GoldCard = () => {
        const currentSource = goldData?.[activeGoldTab];
        const rawTables = currentSource?.rawTables || [];
        
        const processedTables = useMemo(() => {
            if (!rawTables || rawTables.length === 0) return [];
            
            const cardGroups: any[] = [];
            
            rawTables.forEach(tabel => {
                // 1. Shorten Headers
                const shortHeaders = tabel.headers.map(h => {
                    let text = h;
                    if (text.includes('PPN 1.1% + PPh 22 0.25%')) text = 'Harga (+Pajak PPh 0.25%)';
                    if (text.includes('PPN 1.65%')) text = 'Harga (+PPN 1.65%)';
                    if (text === 'Harga Dasar') text = 'Harga Dasar';
                    return text;
                });

                // 2. Shorten the verbose footer/cell text
                const shortRows = tabel.rows.map(row => {
                    const newRow: any = { ...row };
                    Object.keys(newRow).forEach(k => {
                        let val = String(newRow[k]);
                        if (val.includes('Update harga LM Antam')) {
                            const match = val.match(/Harga pembelian kembali:(Rp[\d.]+\/grm)/i);
                            if (match) {
                                val = `Info: Buyback ${match[1]}`;
                            } else {
                                val = `Info: Data Diperbarui`; 
                            }
                        }
                        if (val.includes('Update harga LM Pegadaian')) {
                             val = val.replace(/Update harga LM Pegadaian:.*/, '');
                        }
                        newRow[k] = val;
                    });
                    return newRow;
                });

                const processedTbl = {
                    title: tabel.title,
                    headers: shortHeaders,
                    rows: shortRows
                };

                // 3. Group Tables into Cards by semantic category
                let groupKey = tabel.title;
                const tLower = (tabel.title || '').toLowerCase();

                if (activeGoldTab === 'logamMulia') {
                    if (tLower.includes('batik') || tLower.includes('liontin')) {
                        groupKey = 'lm_batik';
                    } else if (tLower.includes('gift') || tLower.includes('imlek') || tLower.includes('fitri')) {
                        groupKey = 'lm_koleksi';
                    }
                } else if (activeGoldTab === 'galeri24') {
                    // Box 3: UBS Disney + UBS Hello Kitty
                    if (tLower.includes('ubs disney') || tLower.includes('hello kitty')) {
                        groupKey = 'g24_ubs_disney';
                    // Box 5: UBS Anka + UBS Elsa
                    } else if (tLower.includes('ubs a') || tLower.includes('elsa')) {
                        groupKey = 'g24_ubs_other';
                    // Box 6: Lotus Archi Gift + Lotus Archi
                    } else if (tLower.includes('lotus')) {
                        groupKey = 'g24_lotus';
                    // Box 7: Dinar G24 + UBS Mickey Fullbody + Baby Series Investasi
                    } else if (tLower.includes('dinar') || tLower.includes('mickey') || tLower.includes('baby series investasi')) {
                        groupKey = 'g24_dinar_mix';
                    // Box 11: Antam Non Pegadaian + Baby Series Tumbuhan
                    } else if (tLower.includes('pegadaian') || tLower.includes('baby series tumbuhan')) {
                        groupKey = 'g24_antam_baby';
                    }
                }

                const isGrouped = groupKey !== tabel.title;
                let targetGroup = cardGroups.find(g => g.groupKey === groupKey);
                if (targetGroup) {
                    targetGroup.tables.push(processedTbl);
                } else {
                    cardGroups.push({ groupKey, tables: [processedTbl], isSmallGroup: isGrouped });
                }
            });
            
            // 4. Sort boxes for Galeri24 per user-specified order
            if (activeGoldTab === 'galeri24') {
                const getG24Priority = (key: string) => {
                    const k = key.toLowerCase();
                    if (k.includes('galeri 24') || k.includes('galeri24')) return 0;  // but not 'baby galeri'
                    if (k.includes('antam') && !k.includes('retro') && !k.includes('antam_baby') && !k.includes('pegadaian')) return 1;
                    if (k.includes('retro')) return 2;
                    if (k.includes('antam_baby') || k.includes('pegadaian')) return 3;
                    if (k === 'g24_ubs_disney' || k === 'g24_ubs_other') return 50; // UBS grouped after main UBS
                    if (k.includes('ubs') && !k.includes('disney') && !k.includes('ubs_other') && !k.includes('dinar')) return 4;
                    return 50;
                };
                // Exclude 'baby galeri' from priority 0
                cardGroups.sort((a, b) => {
                    const aP = a.groupKey.toLowerCase().includes('baby galeri') ? 50 : getG24Priority(a.groupKey);
                    const bP = b.groupKey.toLowerCase().includes('baby galeri') ? 50 : getG24Priority(b.groupKey);
                    return aP - bP;
                });
            }

            return cardGroups;
        }, [rawTables]);

        if (!goldData) return null;

        return (
            <div className="glass-card-premium p-6 rounded-3xl border border-yellow-500/20 relative overflow-hidden group h-full flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/20 transition-all"></div>
                <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-start sm:items-center justify-between mb-4 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 shrink">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-yellow-500/20 rounded-lg sm:rounded-xl text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)] shrink-0">
                                <span className="material-symbols-outlined text-[18px] sm:text-base">stars</span>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Emas (Gold)</h3>
                                <div className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                                    <span className="hidden sm:inline">Update: </span>{formatDateTime(currentSource?.lastUpdate)}
                                </div>
                            </div>
                        </div>

                        {/* Gold Source Tabs */}
                        <div className="flex bg-black/40 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-white/5 max-w-[160px] sm:max-w-[250px] shrink-0 mt-0.5 sm:mt-0">
                           <button onClick={() => setActiveGoldTab('hargaEmas')} className={`px-1.5 sm:px-2 py-0.5 sm:py-1 flex-1 rounded-md sm:rounded-lg text-[7px] sm:text-[10px] whitespace-nowrap font-bold transition-all ${activeGoldTab === 'hargaEmas' ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:text-white'}`}>Emas.org</button>
                           <button onClick={() => setActiveGoldTab('galeri24')} className={`px-1.5 sm:px-2 py-0.5 sm:py-1 flex-1 rounded-md sm:rounded-lg text-[7px] sm:text-[10px] whitespace-nowrap font-bold transition-all ${activeGoldTab === 'galeri24' ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:text-white'}`}>Galeri24</button>
                           <button onClick={() => setActiveGoldTab('logamMulia')} className={`px-1.5 sm:px-2 py-0.5 sm:py-1 flex-1 rounded-md sm:rounded-lg text-[7px] sm:text-[10px] whitespace-nowrap font-bold transition-all ${activeGoldTab === 'logamMulia' ? 'bg-yellow-500 text-black' : 'text-slate-400 hover:text-white'}`}>LogamMulia</button>
                        </div>
                    </div>


                    {/* Raw Tables (Detailed Grams) */}
                    {processedTables.length > 0 && (
                        <div className="mb-4">
                            <span className="text-[10px] uppercase text-slate-500 font-bold mb-3 block tracking-wider">Harga Emas Berbagai Spesifikasi</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {processedTables.map((group: any, gIdx: number) => (
                                    <div key={gIdx} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                        {group.tables.map((tabel: any, tIdx: number) => (
                                            <div key={tIdx}>
                                                <div className={`py-1.5 px-3 text-[10px] font-bold text-yellow-500 border-white/5 flex items-center gap-2 ${tIdx === 0 ? 'bg-white/5 border-b' : 'bg-black/30 border-y mt-2'}`}>
                                                    <span className="material-symbols-outlined text-[12px]">
                                                        {tIdx === 0 && !group.isSmallGroup ? 'table_chart' : 'format_list_bulleted'}
                                                    </span>
                                                    {tabel.title || `Tabel ${tIdx + 1}`}
                                                </div>
                                                <div className="p-2 overflow-x-auto no-scrollbar">
                                                    <table className="w-full text-left border-collapse min-w-full">
                                                        <thead>
                                                            <tr className="text-slate-500 text-[6px] sm:text-[8px] md:text-[9px] uppercase border-b border-white/5 bg-black/20">
                                                                {tabel.headers.map((h: string, i: number) => (
                                                                    <th key={i} className={`p-1 md:p-1.5 font-bold leading-tight ${i === tabel.headers.length - 1 ? 'text-right' : ''}`}>
                                                                        {h}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/[0.02]">
                                                            {tabel.rows.map((row: any, rIdx: number) => {
                                                                if (row._isSection) {
                                                                    return (
                                                                        <tr key={rIdx} className="bg-white/5 border-t border-white/10">
                                                                            <td colSpan={tabel.headers.length} className="p-1 md:p-1.5 text-[7px] sm:text-[9px] md:text-[10px] text-yellow-500 font-bold uppercase tracking-wider text-center bg-black/20">
                                                                                {row.title}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }
                                                                
                                                                const displayCells = Object.keys(row).filter(k => k !== '_isSection' && k !== 'title').map(k => row[k]);
                                                                
                                                                // Ensure footer rows span across if they only have 1 column
                                                                if (displayCells.length === 1) {
                                                                      return (
                                                                        <tr key={rIdx} className="hover:bg-white/5 transition-colors group">
                                                                            <td colSpan={tabel.headers.length} className="p-1 md:p-1.5 text-[6px] sm:text-[8px] md:text-[9px] text-slate-400 italic text-center">
                                                                                {String(displayCells[0])}
                                                                            </td>
                                                                        </tr>
                                                                      );
                                                                }

                                                                return (
                                                                    <tr key={rIdx} className="hover:bg-white/5 transition-colors group">
                                                                        {displayCells.map((val: any, cIdx: number) => (
                                                                            <td key={cIdx} className={`p-1 md:p-1.5 text-[7px] sm:text-[9px] md:text-[10px] text-slate-300 ${cIdx === 0 ? 'font-bold text-slate-200' : 'font-medium group-hover:text-white'} ${cIdx === displayCells.length - 1 ? 'text-right' : ''}`}>
                                                                                {String(val)}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}


                </div>
            </div>
        );
    };



    if (!isMounted) {
        return (
            <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col">
                <main className="flex-1 flex flex-col items-center py-4 px-3 md:py-8 md:px-8">
                    <div className="max-w-7xl w-full space-y-6 md:space-y-8 animate-pulse">
                        <div className="h-10 w-48 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
                        <div className="h-[400px] w-full bg-slate-200 dark:bg-white/10 rounded-3xl mt-6"></div>
                    </div>
                </main>
            </div>
        );
    }

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
                            <div className="grid grid-cols-1 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <GoldCard />
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
                                                value={searchInput}
                                                onChange={(e) => setSearchInput(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* TABLE OR COMING SOON */}
                                {activeTab === 'US' ? (
                                    <div className="bg-[#0f0f13] border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl relative min-h-[400px] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 border border-blue-500/20">
                                            <span className="material-symbols-outlined text-3xl text-blue-400">public</span>
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">US Stocks</h3>
                                        <p className="text-slate-400 text-sm md:text-base max-w-sm">
                                            Integrasi data pasar saham Amerika Serikat (NYSE/NASDAQ) sedang dalam pengembangan. <strong className="text-rose-500 font-bold block mt-2">Coming Soon!</strong>
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-[#0f0f13] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative min-h-[400px]">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse min-w-full md:min-w-[600px]">
                                                    <thead>
                                                        <tr className="bg-white/[0.02] text-slate-400 text-[6px] sm:text-[9px] md:text-[11px] font-bold uppercase tracking-wider border-b border-white/5">
                                                            {activeTab === 'IDX' ? (
                                                                <>
                                                                    <th className="p-1 md:p-4 text-center leading-tight">No</th>
                                                                    <th className="p-1 md:p-4 leading-tight">Kode</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">Tertinggi</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">Terendah</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">Penutupan</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">Selisih</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">%</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">Volume</th>
                                                                </>
                                                            ) : activeTab === 'CRYPTO' ? (
                                                                <>
                                                                    <th className="p-1 md:p-4 text-center leading-tight">Rank</th>
                                                                    <th className="p-1 md:p-4 leading-tight">Name</th>
                                                                    <th className="p-1 md:p-4 leading-tight">Symbol</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">Price</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">1h %</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">24h %</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">7d %</th>
                                                                    <th className="p-1 md:p-4 text-right leading-tight">Market Cap</th>
                                                                </>
                                                            ) : null}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5 text-[7px] sm:text-[10px] md:text-sm">
                                                        {currentItems.map((item, index) => (
                                                            <tr key={`${item.symbol}-${index}`} className="hover:bg-white/[0.03] transition-colors group">
                                                                {activeTab === 'IDX' ? (
                                                                    <>
                                                                        <td className="p-1 md:p-4 text-center text-slate-600">
                                                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                                                        </td>
                                                                        <td className="p-1 md:p-4">
                                                                            <div className="font-black text-white tracking-wide text-[8px] sm:text-[10px] xl:text-sm">{item.symbol}</div>
                                                                            <div className="text-[6px] sm:text-[8px] xl:text-xs text-slate-500 truncate max-w-[60px] md:max-w-none" title={item.name}>
                                                                                {item.name}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right text-slate-400">
                                                                            {formatCurrency(item.high, 'IDR')}
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right text-slate-400">
                                                                            {formatCurrency(item.low, 'IDR')}
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className="font-bold text-white bg-white/5 px-1 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg border border-white/5 whitespace-nowrap">
                                                                                {formatCurrency(item.price, 'IDR')}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className={`font-bold whitespace-nowrap ${(item.change || 0) >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                                                                                {(item.change || 0) >= 0 ? '+' : ''}{(item.change || 0).toLocaleString()}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className={`font-bold px-1 py-0.5 rounded-sm md:rounded-md inline-block ${(item.changePct || 0) >= 0 ? 'text-green-400 bg-green-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                                                                {(item.changePct || 0) >= 0 ? '+' : ''}{(item.changePct || 0).toFixed(2)}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right font-mono text-[6px] sm:text-[10px] text-slate-500">
                                                                            {formatLargeNumber(item.volume)}
                                                                        </td>
                                                                    </>
                                                                ) : activeTab === 'CRYPTO' ? (
                                                                    <>
                                                                        <td className="p-1 md:p-4 text-center text-slate-600">
                                                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-left">
                                                                            <div className="text-[6px] sm:text-[8px] xl:text-xs text-slate-400 truncate max-w-[40px] md:max-w-[150px]" title={item.name}>{item.name}</div>
                                                                        </td>
                                                                        <td className="p-1 md:p-4">
                                                                            <div className="font-black text-white tracking-wide text-[8px] sm:text-[10px] xl:text-sm">{item.symbol}</div>
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className="font-bold text-white bg-white/5 px-1 md:px-2 py-0.5 md:py-1 rounded-md md:rounded-lg border border-white/5 whitespace-nowrap">
                                                                                {formatCurrency(item.price, 'USD')}
                                                                            </span>
                                                                        </td>
                                                                        {/* 1h % */}
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className={`font-bold ${(item.change1h || 0) >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                                                                                {(item.change1h || 0) >= 0 ? '+' : ''}{(item.change1h || 0).toFixed(2)}%
                                                                            </span>
                                                                        </td>
                                                                        {/* 24h % (main change variable) */}
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className={`font-bold px-1 py-0.5 rounded-sm md:rounded-md inline-block ${(item.changePct || 0) >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                                                {(item.changePct || 0) >= 0 ? '+' : ''}{(item.changePct || 0).toFixed(2)}%
                                                                            </span>
                                                                        </td>
                                                                        {/* 7d % */}
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className={`font-bold ${(item.change7d || 0) >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                                                                                {(item.change7d || 0) >= 0 ? '+' : ''}{(item.change7d || 0).toFixed(2)}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-1 md:p-4 text-right">
                                                                            <span className="text-[6px] sm:text-[9px] xl:text-xs text-slate-400">{formatCurrency(item.marketCap, 'USD')}</span>
                                                                        </td>
                                                                    </>
                                                                ) : null}
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
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

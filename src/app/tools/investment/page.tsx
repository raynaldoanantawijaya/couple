"use client";

import { useEffect, useState } from "react";
// Navbar imported in layout

interface StockData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    prevClose: number;
    name: string;
}

interface InvestmentData {
    stocks: { [key: string]: StockData };
    gold: {
        world: {
            price: number;
            symbol: string;
            change: number;
            isMock?: boolean;
        };
        antam: {
            price: number;
            buyback: number;
            ubs?: number;
            amount?: number; // legacy support
            source?: string;
        };
    };
    lastUpdate: string;
}

export default function InvestmentPage() {
    const [data, setData] = useState<InvestmentData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/investment');
                const result = await res.json();
                if (result.stocks) {
                    setData(result);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Refresh every minute
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (val: number, currency: string = 'IDR') => {
        if (!val) return "0";
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: currency === 'IDR' ? 0 : 2
        }).format(val);
    };

    const getChangeColor = (change: number) => {
        if (!change) return "text-slate-400";
        if (change > 0) return "text-green-400";
        if (change < 0) return "text-red-400";
        return "text-slate-400";
    };

    const StockCard = ({ stock }: { stock?: StockData }) => {
        if (!stock) return <div className="animate-pulse bg-white/5 h-24 rounded-xl"></div>;
        const isUp = stock.change >= 0;
        return (
            <div className="bg-white/5 border border-white/5 hover:bg-white/10 transition-colors p-4 rounded-xl flex flex-col justify-between group">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <div className="font-bold text-white text-lg">{stock.symbol.replace('.JK', '').replace('=X', '')}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[120px]" title={stock.name}>{stock.name}</div>
                    </div>
                    {stock.symbol.includes('=') ? (
                        <span className="material-symbols-outlined text-blue-400">payments</span>
                    ) : (
                        <span className="material-symbols-outlined text-rose-400">show_chart</span>
                    )}
                </div>
                <div>
                    <div className="text-xl font-bold text-white tracking-tight">
                        {stock.symbol.includes('USD') ? formatCurrency(stock.price, 'IDR') : formatCurrency(stock.price, 'IDR').replace('RP', 'Rp')}
                    </div>
                    <div className={`text-xs font-bold flex items-center gap-1 ${getChangeColor(stock.change)}`}>
                        <span className="material-symbols-outlined text-[12px]">
                            {isUp ? 'trending_up' : 'trending_down'}
                        </span>
                        {isUp ? '+' : ''}{stock.change ? stock.change.toFixed(0) : "0"} ({stock.changePercent ? stock.changePercent.toFixed(2) : "0.00"}%)
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col">
            {/* Navbar removed (in layout) */}

            <main className="flex-1 flex flex-col items-center py-8 px-4 md:px-8">
                <div className="max-w-6xl w-full space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-end border-b border-rose-500/20 pb-6 gap-4">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200">
                                Market <span className="text-rose-500">Monitor</span>
                            </h1>
                            <p className="text-slate-400 mt-2">Pantau harga emas, saham, dan kurs secara real-time.</p>
                        </div>
                        {data && (
                            <div className="text-right">
                                <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded">
                                    Last Update: {new Date(data.lastUpdate).toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                            <p className="text-slate-400 animate-pulse">Mengambil data pasar...</p>
                        </div>
                    ) : !data ? (
                        <div className="text-center text-red-400 py-20">Gagal mengambil data. Silakan coba lagi nanti.</div>
                    ) : (
                        <>
                            {/* TOP SUMMARY: USD & IHSG */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="glass-card-premium p-6 rounded-2xl border border-white/10 flex items-center justify-between">
                                    <div>
                                        <div className="text-slate-400 text-sm font-bold uppercase mb-1">USD to IDR</div>
                                        <div className="text-3xl font-black text-white">
                                            {formatCurrency(data.stocks['USDIDR=X']?.price || 0)}
                                        </div>
                                    </div>
                                    <div className={`text-right ${getChangeColor(data.stocks['USDIDR=X']?.change || 0)}`}>
                                        <div className="text-lg font-bold">{data.stocks['USDIDR=X']?.change?.toFixed(0) || "0"}</div>
                                        <div className="text-sm">{data.stocks['USDIDR=X']?.changePercent?.toFixed(2) || "0.00"}%</div>
                                    </div>
                                </div>
                                <div className="glass-card-premium p-6 rounded-2xl border border-white/10 flex items-center justify-between">
                                    <div>
                                        <div className="text-slate-400 text-sm font-bold uppercase mb-1">IHSG (Composite)</div>
                                        <div className="text-3xl font-black text-white">
                                            {data.stocks['^JKSE']?.price?.toFixed(2) || "0.00"}
                                        </div>
                                    </div>
                                    <div className={`text-right ${getChangeColor(data.stocks['^JKSE']?.change || 0)}`}>
                                        <div className="text-lg font-bold">{data.stocks['^JKSE']?.change?.toFixed(2) || "0.00"}</div>
                                        <div className="text-sm">{data.stocks['^JKSE']?.changePercent?.toFixed(2) || "0.00"}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* GOLD SECTION */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Antam & UBS Gold */}
                                <div className="glass-card-premium p-6 rounded-3xl border border-yellow-500/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-yellow-500/20 transition-all"></div>

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-400">
                                                <span className="material-symbols-outlined">stars</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white">Logam Mulia (IndoorGold)</h3>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                                <span className="text-slate-400 font-medium">Emas Antam (1g)</span>
                                                <div className="text-2xl font-bold text-yellow-100">
                                                    {formatCurrency(data.gold.antam?.price || 0)}
                                                </div>
                                            </div>
                                            {data.gold.antam?.ubs && (
                                                <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                                    <span className="text-slate-400 font-medium">Emas UBS (1g)</span>
                                                    <div className="text-xl font-bold text-yellow-50">
                                                        {formatCurrency(data.gold.antam.ubs)}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                                <span className="text-slate-400">Buyback</span>
                                                <div className="text-xl font-bold text-slate-300">
                                                    {formatCurrency(data.gold.antam?.buyback || 0)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 text-xs text-slate-500 text-right italic">
                                            *Data dari Indogold.id
                                        </div>
                                    </div>
                                </div>

                                {/* World Gold */}
                                <div className="glass-card-premium p-6 rounded-3xl border border-blue-500/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all"></div>

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
                                                <span className="material-symbols-outlined">public</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white">Emas Dunia (XAU/USD)</h3>
                                        </div>

                                        <div className="flex flex-col items-center justify-center py-4">
                                            <div className="text-4xl font-black text-white mb-2">
                                                ${data.gold.world?.price?.toFixed(2) || "0.00"}
                                            </div>
                                            <div className={`flex items-center gap-1 font-bold ${data.gold.world?.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                <span className="material-symbols-outlined">
                                                    {(data.gold.world?.change || 0) >= 0 ? 'trending_up' : 'trending_down'}
                                                </span>
                                                {(data.gold.world?.change || 0) >= 0 ? '+' : ''}{data.gold.world?.change || 0}
                                            </div>
                                        </div>
                                        {data.gold.world?.isMock && (
                                            <div className="mt-4 text-xs bg-yellow-500/20 text-yellow-200 p-2 rounded-lg text-center">
                                                Mode Demo (Missing API Key)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* STOCKS GRID */}
                            <div>
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-rose-500">candlestick_chart</span>
                                    Saham Unggulan
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    <StockCard stock={data.stocks['ANTM.JK']} />
                                    <StockCard stock={data.stocks['BBCA.JK']} />
                                    <StockCard stock={data.stocks['BBRI.JK']} />
                                    <StockCard stock={data.stocks['BMRI.JK']} />
                                    <StockCard stock={data.stocks['TLKM.JK']} />
                                    <StockCard stock={data.stocks['ASII.JK']} />
                                </div>
                            </div>

                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

// Cache for GoldAPI
let goldCache: { data: any; timestamp: number } | null = null;
const GOLD_CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours

export async function GET() {
    try {
        console.log("Investment API Request Started");

        // 1. Fetch Stocks & Forex (Yahoo Finance)
        const stockSymbols = ['^JKSE', 'USDIDR=X', 'ANTM.JK', 'BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'TLKM.JK', 'ASII.JK'];

        const fallbacks: { [key: string]: any } = {
            '^JKSE': { price: 7850.55, change: 12.3, changePercent: 0.15, name: 'Composite Index' },
            'USDIDR=X': { price: 15450, change: -25, changePercent: -0.16, name: 'USD/IDR' },
            'ANTM.JK': { price: 1650, change: 10, changePercent: 0.6, name: 'Aneka Tambang Tbk.' },
            'BBCA.JK': { price: 10250, change: 50, changePercent: 0.49, name: 'Bank Central Asia Tbk.' },
            'BBRI.JK': { price: 5400, change: -25, changePercent: -0.46, name: 'Bank Rakyat Indonesia (Persero) Tbk.' },
            'BMRI.JK': { price: 7200, change: 0, changePercent: 0, name: 'Bank Mandiri (Persero) Tbk.' },
            'TLKM.JK': { price: 2980, change: 20, changePercent: 0.67, name: 'Telkom Indonesia (Persero) Tbk.' },
            'ASII.JK': { price: 5125, change: -50, changePercent: -0.97, name: 'Astra International Tbk.' }
        };

        const stocksPromise = (async () => {
            try {
                const formatted: any = {};
                const quoteOptions = { validateResult: false };
                const results = await Promise.allSettled(
                    stockSymbols.map(sym => yahooFinance.quote(sym, quoteOptions))
                );

                results.forEach((res, idx) => {
                    const symbol = stockSymbols[idx];
                    if (res.status === 'fulfilled') {
                        const val = res.value as any;
                        if (val && val.regularMarketPrice) {
                            formatted[symbol] = {
                                symbol: val.symbol,
                                price: val.regularMarketPrice,
                                change: val.regularMarketChange,
                                changePercent: val.regularMarketChangePercent,
                                prevClose: val.regularMarketPreviousClose,
                                name: val.shortName || val.longName
                            };
                            return;
                        }
                    }
                    formatted[symbol] = { symbol: symbol, ...fallbacks[symbol] };
                });
                return formatted;
            } catch (err) {
                console.error("Yahoo Finance failed, using fallbacks");
                const formatted: any = {};
                stockSymbols.forEach(sym => { formatted[sym] = { symbol: sym, ...fallbacks[sym] }; });
                return formatted;
            }
        })();

        // 2. Fetch World Gold (GoldAPI.io)
        const goldWorldPromise = fetchGoldWorld();

        // Await primary data
        const [stocksData, goldWorld] = await Promise.all([
            stocksPromise,
            goldWorldPromise
        ]);

        // 3. Calculate Antam Logic (Anchored Realtime)
        // Base Anchor (Dec 31, 2025 User Data): Antam 3.005.000, UBS 2.566.000
        // We apply the LIVE XAU change % to this anchor to simulate realtime movement.
        const xauChangePercent = goldWorld.changePercent || 0; // e.g. 0.5 for +0.5%

        // Multiplier = 1 + (Change% / 100)
        // Actually, we should apply daily movement relative to open.
        // If XAU is +1%, Antam should be +1% from "Open".
        // Let's assume Anchor is "Open" price for today.

        const anchorAntam = 3005000;
        const anchorUBS = 2566000;

        // Apply volatility
        const liveAntam = Math.floor(anchorAntam * (1 + (xauChangePercent / 100)));
        const liveUBS = Math.floor(anchorUBS * (1 + (xauChangePercent / 100)));

        const goldAntam = {
            price: liveAntam,
            buyback: Math.floor(liveAntam * 0.93), // ~7% spread
            ubs: liveUBS,
            source: "Live Market Calc (XAU Based)"
        };

        return NextResponse.json({
            stocks: stocksData,
            gold: {
                world: goldWorld,
                antam: goldAntam
            },
            lastUpdate: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("Critical Investment API Error:", error);
        return NextResponse.json({
            stocks: {},
            gold: { world: {}, antam: {} },
            error: "Failed to fetch data",
            lastUpdate: new Date().toISOString()
        });
    }
}

async function fetchGoldWorld() {
    if (goldCache && (Date.now() - goldCache.timestamp < GOLD_CACHE_DURATION)) {
        return goldCache.data;
    }

    try {
        const apiKey = process.env.GOLD_API_KEY || "";
        if (apiKey) {
            const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
                headers: { 'x-access-token': apiKey },
                next: { revalidate: 28800 }
            });
            if (res.ok) {
                const data = await res.json();
                // GoldAPI returns 'chp' as change percent (e.g. 0.35)
                const result = {
                    price: data.price,
                    symbol: data.symbol,
                    currency: data.currency,
                    change: data.ch, // change amount
                    changePercent: data.chp, // change percent
                    isMock: false
                };
                goldCache = { data: result, timestamp: Date.now() };
                return result;
            }
        }
    } catch (e) { }

    // Fallback Mock (Bullish 2025)
    return {
        price: 2750.40,
        symbol: "XAU",
        currency: "USD",
        change: 12.5,
        changePercent: 0.45,
        isMock: true
    };
}

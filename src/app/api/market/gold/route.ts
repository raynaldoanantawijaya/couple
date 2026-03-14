import { NextResponse } from 'next/server';

export const revalidate = 14400; // Cache for 4 hours

// Helper to extract products from various captured API structures
const extractProducts = (capturedApis: any) => {
    let productResults: any[] = [];
    for (const [url, val] of Object.entries(capturedApis || {})) {
        if (url.toLowerCase().includes('product') && typeof val === 'object' && val !== null) {
            const apiResponse = val as any;
            if (apiResponse.results && Array.isArray(apiResponse.results)) {
                productResults = [...productResults, ...apiResponse.results];
            }
        }
    }
    return productResults.map((p: any) => ({
        name: p.name || 'Unknown',
        weight: p.weight || 0,
        sellPrice: p.sellPrice || p.price || 0,
        buybackPrice: p.buybackPrice || 0,
        productType: p.productType || '',
        image: p.imagePath || '',
    })).filter((p: any) => p.name && p.name.length > 0 && p.sellPrice > 0);
};

// Helper to extract spot prices from daily-update
const extractSpotPrices = (capturedApis: any) => {
    let spotPrices: any[] = [];
    for (const [url, val] of Object.entries(capturedApis || {})) {
        if (url.includes('daily-update') && Array.isArray(val)) {
            // These arrays usually contain the raw vendor prices
            spotPrices = [...spotPrices, ...val.map((item: any) => ({
                vendor: item.vendorName || 'Unknown',
                sellPrice: parseInt(item.sellingPrice || '0', 10),
                buybackPrice: parseInt(item.buybackPrice || '0', 10),
                date: item.date || '',
                changeSell: parseFloat(item.changeSell || '0'),
                changeBuy: parseFloat(item.changeBuy || '0')
            }))];
        }
    }
    // Remove duplicates based on vendor
    const uniqueSpots = [];
    const seen = new Set();
    for (const spot of spotPrices) {
        if (!seen.has(spot.vendor)) {
            seen.add(spot.vendor);
            uniqueSpots.push(spot);
        }
    }
    return uniqueSpots;
};

// Helper to extract detailed weight-based prices (0.5g, 1g, dll) from explicit tables
const extractWeightPrices = (tables: any[]) => {
    let weightPrices: any[] = [];
    if (!tables || !Array.isArray(tables)) return weightPrices;

    for (const table of tables) {
        if (!table.rows || !Array.isArray(table.rows)) continue;
        const title = (table.title || '').toLowerCase();
        
        // Skip irrelevant tables like foreign exchange rates or silver
        if (title.includes('kurs') || title.includes('spot') || title.includes('perak')) continue;
        
        let vendor = table.title || 'Unknown';
        
        // Clean up prefixes like "Harga Emas Hari Ini, 12 Mar 2026 - Emas Batangan" or "Harga Emas - BABY GALERI 24"
        vendor = vendor.replace(/Harga Emas Hari Ini.*?-\s*/i, '').trim();
        vendor = vendor.replace(/Harga Emas\s*-\s*/i, '').trim();
        
        // Standardize common names
        const vLower = vendor.toLowerCase();
        if (vLower.includes('antam') && !vLower.includes('pegadaian') && !vLower.includes('retro')) vendor = 'Antam';
        else if (vLower.includes('antam non pegadaian')) vendor = 'Antam Non-Pegadaian';
        else if (vLower.includes('antam mulia retro')) vendor = 'Antam Retro';
        else if (vLower.includes('ubs') && !vLower.includes('disney') && !vLower.includes('hello kitty')) vendor = 'UBS';
        else if (vLower.includes('galeri 24') && !vLower.includes('baby') && !vLower.includes('dinar')) vendor = 'Galeri 24';
        else if (vLower === 'emas batangan') vendor = 'Antam';

        for (const row of table.rows) {
            const cells = Object.values(row) as string[];
            if (cells.length >= 2) {
                const weightStr = cells[0].toLowerCase();
                // Simple heuristic to check if row represents a weight (e.g "0.5 gr", "1000")
                if (weightStr.match(/\d/) && (weightStr.includes('gr') || weightStr.includes('gram') || !weightStr.match(/[a-z]/))) {
                    weightPrices.push({
                        vendor,
                        weight: cells[0],
                        // Extract numbers only for prices (e.g "3,042,000")
                        sellPrice: parseInt(cells[1].replace(/[^\d]/g, ''), 10) || 0,
                        buybackPrice: cells.length >= 3 ? (parseInt(cells[2].replace(/[^\d]/g, ''), 10) || 0) : 0
                    });
                }
            }
        }
    }
    return weightPrices;
};

// Main fetch function for a specific prefix
const fetchGoldSource = async (files: any[], prefix: string) => {
    const fileNode = files
        .filter((f: any) => f.name.startsWith(prefix) && f.name.endsWith('.json'))
        .sort((a: any, b: any) => b.name.localeCompare(a.name))[0];

    if (!fileNode) return null;

    try {
        const res = await fetch(fileNode.download_url, { next: { revalidate: 14400 } });
        if (!res.ok) return null;
        const rawJson = await res.json();
        
        const capturedApis = rawJson?.data?.captured_apis || {};
        const spotPrices = extractSpotPrices(capturedApis);
        const products = extractProducts(capturedApis);
        const tables = rawJson?.tables || rawJson?.data?.tables || [];
        const rawTables = tables.filter((t: any) => {
            const title = (t.title || '').toLowerCase();
            return !title.includes('kurs') && !title.includes('perak');
        });
        const weightPrices = extractWeightPrices(tables);
        const lastUpdate = rawJson?.metadata?.scrape_time || rawJson?.metadata?.scrape_date || new Date().toISOString();

        return {
            spotPrices,
            weightPrices,
            rawTables,
            products: products.slice(0, 50),
            totalProducts: products.length,
            lastUpdate
        };
    } catch {
        return null;
    }
};

export async function GET() {
    try {
        const repoUrl = 'https://api.github.com/repos/raynaldoanantawijaya/emas/contents';
        const res = await fetch(repoUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Our-Space-App'
            },
            next: { revalidate: 14400 }
        });

        if (!res.ok) throw new Error('Failed to fetch from GitHub API');
        const files: any[] = await res.json();

        // Fetch all three sources concurrently
        const [galeri24, hargaEmas, logamMulia] = await Promise.all([
            fetchGoldSource(files, 'galeri24'),
            fetchGoldSource(files, 'harga-emas_org'),
            fetchGoldSource(files, 'www_logammulia')
        ]);

        const goldData = {
            galeri24: galeri24 || { spotPrices: [], weightPrices: [], rawTables: [], products: [], totalProducts: 0, lastUpdate: new Date().toISOString() },
            hargaEmas: hargaEmas || { spotPrices: [], weightPrices: [], rawTables: [], products: [], totalProducts: 0, lastUpdate: new Date().toISOString() },
            logamMulia: logamMulia || { spotPrices: [], weightPrices: [], rawTables: [], products: [], totalProducts: 0, lastUpdate: new Date().toISOString() },
            source: 'GitHub (Galeri24, HargaEmas, LogamMulia)'
        };

        return NextResponse.json(goldData);
    } catch (e: any) {
        console.error('Gold API error:', e);
        return NextResponse.json({ error: 'Failed to load gold data', details: e.message }, { status: 500 });
    }
}

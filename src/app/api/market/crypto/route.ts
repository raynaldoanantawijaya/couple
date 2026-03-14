import { NextResponse } from 'next/server';

export const revalidate = 14400; // Cache for 4 hours

// Parse "$69,568.95" -> 69568.95
function parseDollar(str: string): number {
    if (!str) return 0;
    return parseFloat(str.replace(/[$,]/g, '')) || 0;
}

// Parse "-1.90%" -> -1.90
function parsePercent(str: string): number {
    if (!str) return 0;
    return parseFloat(str.replace('%', '')) || 0;
}

export async function GET() {
    try {
        const repoUrl = 'https://api.github.com/repos/raynaldoanantawijaya/crypto/contents';
        const res = await fetch(repoUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Our-Space-App'
            },
            next: { revalidate: 14400 }
        });

        if (!res.ok) throw new Error('Failed to fetch from GitHub API');
        const files: any[] = await res.json();

        // Find latest coinmarketcap json
        const cmcFile = files
            .filter((f: any) => f.name.startsWith('coinmarketcap') && f.name.endsWith('.json'))
            .sort((a: any, b: any) => b.name.localeCompare(a.name))[0];

        if (!cmcFile) throw new Error('No crypto json found in repo');

        const cmcRes = await fetch(cmcFile.download_url, { next: { revalidate: 14400 } });
        if (!cmcRes.ok) throw new Error('Failed to download raw json');

        const rawJson = await cmcRes.json();

        // Structure: { metadata, data: { technique, tables: [{ title, headers, rows }] } }
        const tables = rawJson?.data?.tables || [];
        const mainTable = tables[0];
        if (!mainTable || !mainTable.rows) throw new Error('No crypto table data found');

        // Map rows to CryptoData UI structure
        const mappedData = mainTable.rows
            .filter((row: any) => row.Rank && row.Rank !== '') // Skip index entries
            .map((row: any) => ({
                rank: row.Rank || '',
                symbol: row.Symbol || '',
                pair: (row.Symbol || '') + '/USD',
                price: parseDollar(row.Price),
                change1h: parsePercent(row['1h %']),
                change: parsePercent(row['24h %']),
                changePct: parsePercent(row['24h %']),
                change7d: parsePercent(row['7d %']),
                high: 0,
                low: 0,
                volume: parseDollar(row['Volume(24h)']),
                marketCap: parseDollar(row['Market Cap']),
                name: row.Name || '',
            }))
            .slice(0, 100); // Top 100

        const result = {
            lastUpdate: rawJson?.metadata?.scrape_date || new Date().toISOString(),
            source: 'CoinMarketCap via GitHub',
            total: mappedData.length,
            data: mappedData
        };

        return NextResponse.json(result);
    } catch (e: any) {
        console.error('Crypto API error:', e);
        return NextResponse.json({ error: 'Failed to load crypto data', details: e.message }, { status: 500 });
    }
}

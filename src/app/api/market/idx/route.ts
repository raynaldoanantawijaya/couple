import { NextResponse } from 'next/server';

export const revalidate = 14400; // Cache for 4 hours

export async function GET() {
    try {
        const repoUrl = 'https://api.github.com/repos/raynaldoanantawijaya/sahamidx/contents';
        const res = await fetch(repoUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Our-Space-App'
            },
            next: { revalidate: 14400 }
        });

        if (!res.ok) throw new Error('Failed to fetch from GitHub API');
        const files: any[] = await res.json();

        // Find latest idx json
        const idxFile = files
            .filter((f: any) => f.name.startsWith('idx') && f.name.endsWith('.json'))
            .sort((a: any, b: any) => b.name.localeCompare(a.name))[0];

        if (!idxFile) throw new Error('No IDX json found in repo');

        const idxRes = await fetch(idxFile.download_url, { next: { revalidate: 14400 } });
        if (!idxRes.ok) throw new Error('Failed to download raw json');

        const rawJson = await idxRes.json();

        // Structure: { metadata, stocks: { "AALI": {...}, ... }, brokers: [...] }
        const stocksDict = rawJson?.stocks || {};

        // Map dict to array for the UI
        const mappedData = Object.values(stocksDict).map((s: any) => {
            const price = s.Harga_Tutup || 0;
            const change = s.Selisih || 0;
            // Manually calc change percentage since source gives 0
            let changePct = 0;
            if (price - change > 0) {
                changePct = (change / (price - change)) * 100;
            }
            return {
                symbol: s.Kode || '',
                name: s.Nama_Perusahaan || '-',
                price: price,
                change: change,
                changePct: changePct,
                high: s.Harga_Tinggi || 0,
                low: s.Harga_Rendah || 0,
                volume: s.Volume || 0,
            };
        }).filter((s: any) => s.symbol !== '');

        const result = {
            lastUpdate: rawJson?.metadata?.scrape_date || new Date().toISOString(),
            source: 'IDX via GitHub',
            total: mappedData.length,
            data: mappedData
        };

        return NextResponse.json(result);
    } catch (e: any) {
        console.error('IDX API error:', e);
        return NextResponse.json({ error: 'Failed to load IDX data', details: e.message }, { status: 500 });
    }
}

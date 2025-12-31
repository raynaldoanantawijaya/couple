
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        console.log("-> Fetching Disaster Data from Official BMKG...");

        // URLs for official BMKG Data
        // 1. AutoGempa (Latest Major Quake)
        // 2. GempaTerkini (Recent M > 5.0)
        // 3. GempaDirasakan (Felt Quakes)
        const urls = {
            autogempa: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
            gempaterkini: "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
            gempadirasakan: "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json"
        };

        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        const [autoRes, terkiniRes, dirasakanRes] = await Promise.all([
            fetch(urls.autogempa, { cache: "no-store", headers: { "User-Agent": userAgent } }),
            fetch(urls.gempaterkini, { cache: "no-store", headers: { "User-Agent": userAgent } }),
            fetch(urls.gempadirasakan, { cache: "no-store", headers: { "User-Agent": userAgent } })
        ]);

        if (!autoRes.ok) throw new Error("Failed to fetch AutoGempa");

        const autoData = await autoRes.json();
        const terkiniData = terkiniRes.ok ? await terkiniRes.json() : { Infogempa: { gempa: [] } };
        const dirasakanData = dirasakanRes.ok ? await dirasakanRes.json() : { Infogempa: { gempa: [] } };

        // Normalize Data Structure to match our Frontend Interface
        // BMKG returns { Infogempa: { gempa: { ... } } } or { Infogempa: { gempa: [ ... ] } }

        const result = {
            autogempa: autoData.Infogempa.gempa,
            gempaterkini: Array.isArray(terkiniData.Infogempa.gempa) ? terkiniData.Infogempa.gempa : [terkiniData.Infogempa.gempa],
            gempadirasakan: Array.isArray(dirasakanData.Infogempa.gempa) ? dirasakanData.Infogempa.gempa : [dirasakanData.Infogempa.gempa]
        };

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("-> API Error:", error);
        // Return a safe fallback if BMKG is down, so the app doesn't crash
        return NextResponse.json(
            { error: error.message || "Failed to fetch data from BMKG" },
            { status: 500 }
        );
    }
}

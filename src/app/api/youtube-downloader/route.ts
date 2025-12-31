import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { url, type, quality } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Ryzumi API (Dynamic Endpoint)
        // Video: /ytmp4?url=...&quality=...
        // Audio: /ytmp3?url=...

        let endpoint = "https://api.ryzumi.vip/api/downloader/ytmp4";
        if (type === "audio") {
            endpoint = "https://api.ryzumi.vip/api/downloader/ytmp3";
        }

        const targetUrl = new URL(endpoint);
        targetUrl.searchParams.append("url", url);

        // Append quality for video, or potentially audio if supported
        if (quality) {
            targetUrl.searchParams.append("quality", quality);
        }

        console.log(`-> Fetching from Ryzumi (${type || 'video'}):`, targetUrl.toString());

        const res = await fetch(targetUrl.toString(), {
            method: "GET",
            cache: "no-store", // Critical: Disable caching to ensure quality param changes work
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) {
            const text = await res.text();
            console.error("-> Nekolabs Error:", res.status, text);
            return NextResponse.json({ error: `External API Error: ${res.status}`, details: text }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("-> YouTube Downloader API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

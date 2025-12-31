
import { NextRequest, NextResponse } from "next/server";

// Standard browser headers to bypass simple bot checks
const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.youtube.com/",
    "Origin": "https://www.youtube.com"
};

export async function POST(req: NextRequest) {
    try {
        const { url, type, quality } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        console.log(`-> Processing YouTube Download: ${url} (Type: ${type}, Quality: ${quality})`);

        // --- PROVIDER 1: Ryzumi (Primary) ---
        // Good metadata, but strict IP blocking (403)
        try {
            console.log("-> Attempting Provider 1: Ryzumi...");
            let endpoint = "https://api.ryzumi.vip/api/downloader/ytmp4";
            if (type === "audio") endpoint = "https://api.ryzumi.vip/api/downloader/ytmp3";

            const targetUrl = new URL(endpoint);
            targetUrl.searchParams.append("url", url);
            if (quality) targetUrl.searchParams.append("quality", quality);

            const res = await fetch(targetUrl.toString(), {
                method: "GET",
                cache: "no-store",
                headers: BROWSER_HEADERS
            });

            if (res.ok) {
                const data = await res.json();
                console.log("-> Provider 1 Success!");
                return NextResponse.json(data);
            } else {
                console.warn(`-> Provider 1 Failed: ${res.status} ${await res.text()}`);
            }
        } catch (err) {
            console.warn("-> Provider 1 Error:", err);
        }

        // --- PROVIDER 2: Cobalt Public Instance (Fallback) ---
        // Very consistent, less blocking. Open source.
        try {
            console.log("-> Attempting Provider 2: Cobalt (wuk.sh)...");

            // Cobalt API needs POST to /api/json
            const cobaltRes = await fetch("https://co.wuk.sh/api/json", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": BROWSER_HEADERS["User-Agent"]
                },
                body: JSON.stringify({
                    url: url,
                    vCodec: "h264",
                    vQuality: quality && quality !== 'Highest' ? quality.replace('p', '') : "1080",
                    aFormat: "mp3",
                    isAudioOnly: type === "audio"
                })
            });

            if (cobaltRes.ok) {
                const data = await cobaltRes.json();
                console.log("-> Provider 2 Success!", data.status);

                // Normalize cobalt response to match our frontend expectation (somewhat)
                // Cobalt returns { url: "...", status: "stream" }
                if (data.url) {
                    return NextResponse.json({
                        url: data.url,
                        title: data.filename || "YouTube Video",
                        thumbnail: "", // Cobalt doesn't always return thumb in this endpoint
                        size: "Unknown"
                    });
                }
            } else {
                console.warn(`-> Provider 2 Failed: ${cobaltRes.status}`);
            }

        } catch (err) {
            console.warn("-> Provider 2 Error:", err);
        }

        // --- ALL FAILED ---
        return NextResponse.json(
            { error: "All download providers failed to process this request. Access restricted." },
            { status: 502 }
        );

    } catch (error: any) {
        console.error("-> API FATAL Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

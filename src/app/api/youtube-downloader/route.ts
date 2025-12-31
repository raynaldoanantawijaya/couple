
import { NextRequest, NextResponse } from "next/server";

// Standard browser headers to bypass simple bot checks
const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.youtube.com/",
    "Origin": "https://www.youtube.com"
};

// List of known public Cobalt instances
// We will cycle through these if one fails
const COBALT_INSTANCES = [
    "https://api.cobalt.tools",    // Official-ish (often strictly rate limited)
    "https://co.wuk.sh",           // Popular
    "https://cobalt.xy24.eu",      // EU Mirror
    "https://api.wpsh.eu.org",     // Community
    "https://cobalt.kwiatekmiki.pl"// Community
];

export async function POST(req: NextRequest) {
    try {
        const { url, type, quality } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        console.log(`-> Processing YouTube Download: ${url}`);

        // --- STRATEGY: Try Cobalt Instances Round-Robin ---

        let successData = null;
        let lastError = null;

        for (const instanceBase of COBALT_INSTANCES) {
            try {
                console.log(`-> Attempting Cobalt Instance: ${instanceBase}...`);
                const apiUrl = `${instanceBase}/api/json`;

                const cobaltRes = await fetch(apiUrl, {
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
                    if (data.url || data.stream) {
                        console.log(`-> Success via ${instanceBase}!`);
                        successData = {
                            url: data.url,
                            title: data.filename || "YouTube Video",
                            thumbnail: "",
                            size: "Unknown"
                        };
                        break; // EXIT LOOP ON SUCCESS
                    }
                } else {
                    console.warn(`-> Failed ${instanceBase}: ${cobaltRes.status}`);
                    lastError = `Status ${cobaltRes.status}`;
                }
            } catch (e: any) {
                console.warn(`-> Error ${instanceBase}: ${e.message}`);
                lastError = e.message;
            }
        }

        if (successData) {
            return NextResponse.json(successData);
        }

        // --- FALLBACK: Ryzumi (If all Cobalt failed) ---
        // As a last resort, try Ryzumi mechanism
        try {
            console.log("-> All Cobalt instances failed. Trying Ryzumi fallback...");
            let endpoint = "https://api.ryzumi.vip/api/downloader/ytmp4";
            if (type === "audio") endpoint = "https://api.ryzumi.vip/api/downloader/ytmp3";
            const ryzUrl = new URL(endpoint);
            ryzUrl.searchParams.append("url", url);
            if (quality) ryzUrl.searchParams.append("quality", quality);

            const ryzRes = await fetch(ryzUrl.toString(), {
                method: "GET",
                cache: "no-store",
                headers: BROWSER_HEADERS
            });
            if (ryzRes.ok) {
                return NextResponse.json(await ryzRes.json());
            }
        } catch (e) {
            console.error("-> Ryzumi fallback failed too.");
        }

        // If here, everything failed
        return NextResponse.json(
            { error: "All download providers failed. Please try again later.", details: lastError },
            { status: 502 }
        );

    } catch (error: any) {
        console.error("-> API FATAL Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

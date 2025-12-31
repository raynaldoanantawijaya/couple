import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    console.log("-> API Remove BG Hit");
    try {
        const contentType = req.headers.get("content-type") || "";
        let targetImage: string | Blob;
        let isUrl = false;

        if (contentType.includes("multipart/form-data")) {
            console.log("-> Processing Multipart FormData");
            const formData = await req.formData();
            const file = formData.get("image") as File;
            if (!file) {
                console.error("-> Error: No file found in 'image' field");
                return NextResponse.json({ error: "No image file provided" }, { status: 400 });
            }
            console.log("-> File received:", file.name, file.size, file.type);
            targetImage = file;
        } else {
            console.log("-> Processing JSON URL");
            const { imageUrl } = await req.json();
            if (!imageUrl) {
                return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
            }
            targetImage = imageUrl;
            isUrl = true;
            console.log("-> Received Image URL:", targetImage);
        }

        // 2. Prepare Body for Pitucode
        let pitucodeBody;
        let pitucodeHeaders = {};

        if (isUrl) {
            // For URLs, standard APIs often prefer x-www-form-urlencoded or JSON
            // "Required body param: image" suggests x-www-form-urlencoded might be safer than multipart for a simple string.
            const params = new URLSearchParams();
            params.append("image", targetImage as string);
            pitucodeBody = params;
            // fetch automatically sets Content-Type to application/x-www-form-urlencoded for URLSearchParams
            console.log("-> Sending URL via x-www-form-urlencoded");
        } else {
            // For Files, must use FormData
            const formData = new FormData();
            formData.append("image", targetImage as Blob, "image.jpg");
            pitucodeBody = formData;
            console.log("-> Sending File via Multipart FormData");
        }

        // 3. Send to Pitucode API
        // Note: Using the key directly as requested. In production, use env vars.
        const apiUrl = "https://api.pitucode.com/ai/removebg2?apikey=7C0dEdfd6c1&username=helsing";

        console.log("-> Sending to Pitucode:", apiUrl);
        const apiRes = await fetch(apiUrl, {
            method: "POST",
            body: pitucodeBody,
            // headers: pitucodeHeaders // fetch handles headers for FormData and URLSearchParams
        });

        console.log("-> Pitucode Response Status:", apiRes.status);

        if (!apiRes.ok) {
            const errorText = await apiRes.text();
            console.error("-> Pitucode API Error Body:", errorText);

            // Try to parse JSON error from Pitucode
            let errorMessage = errorText;
            try {
                const errJson = JSON.parse(errorText);
                errorMessage = errJson.message || errorText;
            } catch (e) { }

            return NextResponse.json({ error: `Pitucode Error: ${errorMessage}` }, { status: apiRes.status });
        }

        // 4. Handle Response (JSON vs Blob)
        const resContentType = apiRes.headers.get("content-type") || "";
        console.log("-> Pitucode Response Type:", resContentType);

        if (resContentType.includes("application/json")) {
            const data = await apiRes.json();
            console.log("-> Pitucode JSON Response:", JSON.stringify(data));

            // Check for Base64 Data
            if (data.data && typeof data.data === 'string' && data.data.startsWith('data:image')) {
                console.log("-> Processing Base64 Image Data");
                // data.data is "data:image/png;base64,....."
                const base64Data = data.data.split(';base64,').pop();
                if (!base64Data) throw new Error("Invalid Base64 format");

                const imageBuffer = Buffer.from(base64Data, 'base64');
                return new NextResponse(imageBuffer, {
                    headers: {
                        "Content-Type": "image/png",
                        "Content-Disposition": 'attachment; filename="removed-bg.png"',
                    },
                });
            }

            // Fallback for URL pattern
            const resultUrl = data.url || data.result || data.media?.url;

            if (resultUrl) {
                console.log("-> Fetching result image from:", resultUrl);
                const imageFetch = await fetch(resultUrl);
                if (!imageFetch.ok) throw new Error("Failed to download result image");

                const imageBuffer = await imageFetch.arrayBuffer();
                return new NextResponse(imageBuffer, {
                    headers: {
                        "Content-Type": "image/png",
                        "Content-Disposition": 'attachment; filename="removed-bg.png"',
                    },
                });
            }

            // If neither
            console.error("-> Valid Data Fields:", Object.keys(data));
            throw new Error(`Unknown response format. Keys: ${Object.keys(data).join(', ')}`);
        } else {
            // Assume it's the image blob directly
            const resultBuffer = await apiRes.arrayBuffer();
            console.log("-> Success! Result buffer size:", resultBuffer.byteLength);

            return new NextResponse(resultBuffer, {
                headers: {
                    "Content-Type": "image/png",
                    "Content-Disposition": 'attachment; filename="removed-bg.png"',
                },
            });
        }

    } catch (error: any) {
        console.error("-> Remove BG Exception:", error);
        return NextResponse.json({ error: error.message || "Something went wrong" }, { status: 500 });
    }
}

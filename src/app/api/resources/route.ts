import { NextResponse } from 'next/server';

const API_KEY = "722993354673771";
const API_SECRET = "V7dxhMF7RYI1Hv1SbqDaey5X_38";
const CLOUD_NAME = "dtpskj8gv";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'image'; // image or video
    const nextCursor = searchParams.get('next_cursor');

    try {
        // Construct basic auth header
        const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

        // Build query URL for Admin API
        // We use the search endpoint for more flexibility (filtering by folder/tags if needed)
        // Or strictly list resources. Let's use list resources for simplicity standard folders.
        // Actually, search is better for tags.
        // Let's use 'resources/search' to filter by checks if needed, or just list.
        // Standard list: https://api.cloudinary.com/v1_1/<cloud_name>/resources/<resource_type>

        // We want context (metadata) and tags.
        let url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${type}?max_results=50&context=true&tags=true&direction=desc`;

        if (nextCursor) {
            url += `&next_cursor=${nextCursor}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        const data = await response.json();

        if (data.error) {
            return NextResponse.json({ error: data.error }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
    }
}

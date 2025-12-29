import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CLOUD_NAME = "dtpskj8gv";
const API_KEY = "722993354673771";
const API_SECRET = "V7dxhMF7RYI1Hv1SbqDaey5X_38";

export async function POST(request: Request) {
    try {
        const { public_id, resource_type } = await request.json();

        if (!public_id || !resource_type) {
            return NextResponse.json({ error: "Missing public_id or resource_type" }, { status: 400 });
        }

        const timestamp = Math.round(new Date().getTime() / 1000);

        // Signature generation: SHA1(params + secret)
        // Params must be sorted alphabetically by key.
        // For destroy: public_id, timestamp.
        const paramsStr = `public_id=${public_id}&timestamp=${timestamp}${API_SECRET}`;
        const signature = crypto.createHash('sha1').update(paramsStr).digest('hex');

        const formData = new FormData();
        formData.append('public_id', public_id);
        formData.append('api_key', API_KEY);
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resource_type}/destroy`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (data.result !== 'ok') {
            return NextResponse.json({ error: data }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

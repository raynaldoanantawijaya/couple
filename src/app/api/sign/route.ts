import { NextResponse } from 'next/server';
import crypto from 'crypto';

const API_SECRET = "V7dxhMF7RYI1Hv1SbqDaey5X_38";
const API_KEY = "722993354673771";
const CLOUD_NAME = "dtpskj8gv";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { paramsToSign } = body;

        if (!paramsToSign) {
            return NextResponse.json({ error: "Missing paramsToSign" }, { status: 400 });
        }

        // Sort params by key
        const sortedKeys = Object.keys(paramsToSign).sort();

        // Create parameter string: key=value&key=value
        const paramsStr = sortedKeys
            .map(key => `${key}=${paramsToSign[key]}`)
            .join('&');

        // Append secret
        const toSign = paramsStr + API_SECRET;

        // Generate signature
        const signature = crypto.createHash('sha1').update(toSign).digest('hex');

        return NextResponse.json({
            signature,
            apiKey: API_KEY,
            cloudName: CLOUD_NAME
        });

    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

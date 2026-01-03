"use client";

import { useState, useRef } from "react";
import Link from "next/link";

export default function AiPhotoPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");

    // Results
    const [resultNano, setResultNano] = useState<string | null>(null);
    const [resultGpt, setResultGpt] = useState<string | null>(null);
    const [resultRyzumiEdit, setResultRyzumiEdit] = useState<string | null>(null);

    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingNano, setLoadingNano] = useState(false);
    const [loadingGpt, setLoadingGpt] = useState(false);
    const [loadingRyzumiEdit, setLoadingRyzumiEdit] = useState(false);

    // Error States
    const [errorNano, setErrorNano] = useState<string | null>(null);
    const [errorGpt, setErrorGpt] = useState<string | null>(null);
    const [errorRyzumiEdit, setErrorRyzumiEdit] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            resetResults();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files?.[0]) {
            const file = e.dataTransfer.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            resetResults();
        }
    };

    const resetResults = () => {
        setResultNano(null);
        setResultGpt(null);
        setResultRyzumiEdit(null);
        setErrorNano(null);
        setErrorGpt(null);
        setErrorRyzumiEdit(null);
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setPrompt("");
        resetResults();
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const uploadToCloudinary = async (file: File): Promise<{ url: string, public_id: string }> => {
        // 1. Get Signature
        const timestamp = Math.round(new Date().getTime() / 1000);
        const tags = 'temp_ai_photo';

        const signRes = await fetch('/api/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paramsToSign: { timestamp, tags }
            })
        });

        if (!signRes.ok) throw new Error("Gagal menyiapkan upload (Signature)");
        const { signature, apiKey, cloudName } = await signRes.json();

        // 2. Upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", apiKey);
        formData.append("timestamp", timestamp.toString());
        formData.append("signature", signature);
        formData.append("tags", tags);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });

        if (!uploadRes.ok) throw new Error("Gagal mengupload gambar sementara");

        const data = await uploadRes.json();
        return { url: data.secure_url, public_id: data.public_id };
    };

    const deleteTempImage = async (public_id: string) => {
        try {
            await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_id, resource_type: 'image' })
            });
            console.log("Temporary image deleted:", public_id);
        } catch (e) {
            console.error("Failed to delete temp image:", e);
        }
    };

    const callAiApi = async (fullUrl: string, apiName: string, retries = 0): Promise<string> => {
        let lastError: any;
        let nextDelay = 2000; // Default initial delay

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`Retrying ${apiName} (Attempt ${attempt + 1}/${retries + 1}) in ${nextDelay}ms...`);
                    await new Promise(r => setTimeout(r, nextDelay));
                }

                console.log(`Calling API: ${apiName}`);
                const res = await fetch(fullUrl);

                if (!res.ok) {
                    // Check if it's a rate limit error (429) or server error (500)
                    if (res.status >= 500 || res.status === 429) {
                        if (res.status === 429) {
                            // Try to guess a delay if header provided (sometimes retry-after header exists)
                            const retryAfter = res.headers.get("retry-after");
                            if (retryAfter) {
                                nextDelay = (parseInt(retryAfter) * 1000) + 1000;
                            } else {
                                nextDelay *= 2; // Exponential backoff
                            }
                        }
                        throw new Error(`HTTP ${res.status} ${res.statusText}`);
                    }

                    let errorMsg = `API Error: ${res.status} ${res.statusText}`;
                    try {
                        const errText = await res.text();
                        if (errText) errorMsg += ` - ${errText.substring(0, 100)}`;
                    } catch (e) { /* ignore */ }
                    throw new Error(errorMsg);
                }

                const contentType = res.headers.get("content-type");

                // Handle JSON response
                if (contentType && contentType.includes("application/json")) {
                    const data = await res.json();

                    if (data.url) return data.url;
                    if (data.data) return data.data;
                    if (data.image) return data.image;
                    if (data.result) return data.result;

                    // Handle explicit error fields in JSON
                    if (data.error || data.message) {
                        const errObj = data.error || {};
                        const msg = (typeof errObj === 'string' ? errObj : errObj.message) || data.message || JSON.stringify(data);

                        // Check for rate limit info in JSON
                        // Example: "Please retry in 58.623s" or nested details
                        let delayFound = 0;
                        if (JSON.stringify(data).match(/retryDelay"?\s*:\s*"?(\d+)/)) {
                            delayFound = parseInt(JSON.stringify(data).match(/retryDelay"?\s*:\s*"?(\d+)/)![1]);
                        } else if (msg.match(/retry in (\d+)/)) {
                            delayFound = parseInt(msg.match(/retry in (\d+)/)[1]);
                        }

                        if (delayFound > 0) {
                            nextDelay = (delayFound * 1000) + 2000; // Wait slightly longer than asked
                            throw new Error(`HTTP 429: Quota exceeded, retry in ${delayFound}s`);
                        }

                        if (msg.includes("429") || msg.toLowerCase().includes("too many requests") || msg.includes("limit")) {
                            throw new Error(`HTTP 429: ${msg}`);
                        }
                        throw new Error(msg);
                    }

                    if (data.status === false || data.success === false) throw new Error(data.message || "API returned failed status");

                    throw new Error(`Unknown JSON format. Keys: ${Object.keys(data).join(', ')}`);
                }

                // Handle Direct Image Blob
                const blob = await res.blob();
                if (blob.size === 0) throw new Error("API returned empty image blob");

                if (blob.size < 5000) {
                    const text = await blob.text();
                    try {
                        const json = JSON.parse(text);
                        if (json.url) return json.url;

                        if (json.error) {
                            const errObj = json.error;
                            const msg = (typeof errObj === 'string' ? errObj : errObj.message) || "Unknown Error";

                            // Extract delay from blob JSON
                            let delayFound = 0;
                            if (JSON.stringify(json).match(/retryDelay"?\s*:\s*"?(\d+)/)) {
                                delayFound = parseInt(JSON.stringify(json).match(/retryDelay"?\s*:\s*"?(\d+)/)![1]);
                            } else if (msg.match(/retry in (\d+)/)) {
                                delayFound = parseInt(msg.match(/retry in (\d+)/)[1]);
                            }

                            if (delayFound > 0) {
                                nextDelay = (delayFound * 1000) + 2000;
                                throw new Error(`HTTP 429: Quota exceeded, retry in ${delayFound}s`);
                            }

                            if (msg.includes("429") || msg.toLowerCase().includes("too many requests")) {
                                throw new Error(`HTTP 429: ${msg}`);
                            }
                            throw new Error(msg);
                        }
                        if (json.message) throw new Error(json.message);
                    } catch (e: any) {
                        if (text.includes("<html>") || text.includes("Error")) {
                            throw new Error(`Invalid Image Data: ${text.substring(0, 50)}...`);
                        }
                        if (e.message && e.message.includes("HTTP")) throw e;
                    }
                    console.warn(`Warning: Small image blob received (${blob.size} bytes)`);
                }

                return URL.createObjectURL(blob);

            } catch (error: any) {
                console.error(`${apiName} Error (Attempt ${attempt + 1}):`, error);

                const isRetryable = error.message.includes("HTTP") ||
                    error.message.includes("Failed to fetch") ||
                    error.message.includes("NetworkError");

                if (!isRetryable) {
                    throw error;
                }
                lastError = error;
                // If we didn't update nextDelay specifically (e.g. from 429 parsing), ensure it grows
                if (nextDelay === 2000 && attempt > 0) nextDelay = 4000;
            }
        }

        throw lastError || new Error(`${apiName} Failed after ${retries + 1} attempts`);
    };

    const handleProcess = async () => {
        if (!selectedFile || !prompt) return;

        setIsProcessing(true);
        setLoadingNano(true);
        setLoadingGpt(true);
        setLoadingRyzumiEdit(true);
        resetResults();

        let tempPublicId = "";

        try {
            // 1. Upload Original to Cloudinary
            const { url: cloudinaryUrl, public_id } = await uploadToCloudinary(selectedFile);
            tempPublicId = public_id;

            // 2. Run Generations in Parallel
            const MAX_RETRIES = 5;

            // Nano Banana
            const promisedNano = callAiApi(`https://api.nekolabs.web.id/image.gen/nano-banana?prompt=${encodeURIComponent(prompt)}&imageUrl=${encodeURIComponent(cloudinaryUrl)}`, 'Nano Banana', MAX_RETRIES)
                .then(url => {
                    setResultNano(url);
                    setLoadingNano(false);
                })
                .catch(e => {
                    setErrorNano(e.message || "Gagal");
                    setLoadingNano(false);
                });

            const promisedGpt = callAiApi(`https://api.nekolabs.web.id/image.gen/gpt/image-1?prompt=${encodeURIComponent(prompt)}&imageUrl=${encodeURIComponent(cloudinaryUrl)}`, 'GPT Image', MAX_RETRIES)
                .then(url => {
                    setResultGpt(url);
                    setLoadingGpt(false);
                })
                .catch(e => {
                    setErrorGpt(e.message || "Gagal");
                    setLoadingGpt(false);
                });

            const promisedRyzumiEdit = callAiApi(`https://api.ryzumi.vip/api/ai/edit?prompt=${encodeURIComponent(prompt)}&imageUrl=${encodeURIComponent(cloudinaryUrl)}`, 'Gemini 1', MAX_RETRIES)
                .then(url => {
                    setResultRyzumiEdit(url);
                    setLoadingRyzumiEdit(false);
                })
                .catch(e => {
                    setErrorRyzumiEdit(e.message || "Gagal");
                    setLoadingRyzumiEdit(false);
                });

            await Promise.allSettled([promisedNano, promisedGpt, promisedRyzumiEdit]);

        } catch (error: any) {
            console.error("Main Process Error:", error);
            setLoadingNano(false);
            setLoadingGpt(false);
            setLoadingRyzumiEdit(false);
        } finally {
            setIsProcessing(false);
            // Cleanup Cloudinary
            if (tempPublicId) {
                await deleteTempImage(tempPublicId);
            }
        }
    };

    return (
        <div className="min-h-screen bg-background-dark font-display text-white selection:bg-red-500/30">
            {/* Header */}
            <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                    <span className="material-symbols-outlined text-4xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-pink-400">add_a_photo</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-red-200 to-pink-200">
                    AI Foto Generator
                </h1>
                <p className="text-slate-400 max-w-lg text-lg">
                    Ubah fotomu menjadi karya seni dengan tiga model AI sekaligus.
                </p>
            </div>

            <main className="max-w-7xl mx-auto px-6 pb-20 space-y-8">

                {/* Input Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT: Upload & Prompt */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Upload Box */}
                        <div
                            className={`relative aspect-square w-full rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden group ${previewUrl
                                ? "border-red-500/50 bg-white/5"
                                : "border-white/10 hover:border-red-500/50 hover:bg-white/5 cursor-pointer"
                                }`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => !previewUrl && fileInputRef.current?.click()}
                        >
                            {previewUrl ? (
                                <>
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                    {!isProcessing && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                            className="absolute top-4 right-4 w-8 h-8 bg-black/50 hover:bg-rose-500 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-slate-500 group-hover:text-red-400 transition-colors">
                                    <span className="material-symbols-outlined text-5xl">cloud_upload</span>
                                    <div className="text-center px-4">
                                        <p className="font-bold text-white">Upload Foto</p>
                                        <p className="text-xs mt-1">JPG/PNG, Max 5MB</p>
                                    </div>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        {/* Prompt Input */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-400 ml-1">Deskripsi / Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Contoh: Ubah baju menjadi warna merah, gaya cyberpunk..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-red-500/50 focus:bg-white/10 transition-all resize-none h-32 text-sm"
                            />
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleProcess}
                            disabled={!selectedFile || !prompt || isProcessing}
                            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${!selectedFile || !prompt || isProcessing
                                ? "bg-white/5 text-slate-500 cursor-not-allowed"
                                : "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:scale-[1.02] shadow-red-500/25"
                                }`}
                        >
                            {isProcessing ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Sedang Memproses...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">auto_fix_high</span>
                                    <span>Generate Magic</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* RIGHT: Results Area */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {/* Status/Placeholder */}
                        {(!resultNano && !resultGpt && !resultRyzumiEdit && !isProcessing && !errorNano && !errorGpt) && (
                            <div className="h-full min-h-[400px] rounded-3xl bg-white/5 border border-white/10 border-dashed flex flex-col items-center justify-center text-slate-500 gap-4">
                                <span className="material-symbols-outlined text-6xl opacity-20">photo_library</span>
                                <p>Hasil generate akan muncul di sini</p>
                            </div>
                        )}

                        {/* Result Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Card 1: Nano Banana */}
                            {(loadingNano || resultNano || errorNano) && (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-yellow-400/20 text-yellow-400 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-sm">science</span>
                                        </div>
                                        <h3 className="font-bold text-white">Nano Banana</h3>
                                    </div>

                                    <div className="aspect-square rounded-2xl bg-black/30 overflow-hidden relative group flex items-center justify-center">
                                        {loadingNano ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                <div className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin"></div>
                                                <span className="text-xs text-yellow-400 animate-pulse">Generating...</span>
                                                <span className="text-[10px] text-yellow-400/70">Warming up engines...</span>
                                            </div>
                                        ) : errorNano ? (
                                            <div className="bg-red-500/10 p-4 rounded-xl text-center flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
                                                <p className="text-xs text-red-400 font-medium px-2">{errorNano.includes('500') ? 'Server Sibuk / Limit' : 'Gagal Memproses'}</p>
                                                <p className="text-[10px] text-red-500/70 max-w-[200px] truncate">{errorNano}</p>
                                            </div>
                                        ) : resultNano ? (
                                            <>
                                                <img src={resultNano} alt="Nano Result" className="w-full h-full object-cover" />
                                                <a
                                                    href={resultNano}
                                                    download="nano-banana-result.png"
                                                    className="absolute bottom-4 right-4 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg translate-y-20 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                                                >
                                                    <span className="material-symbols-outlined">download</span>
                                                </a>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            {/* Card 2: GPT Image */}
                            {(loadingGpt || resultGpt || errorGpt) && (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-400/20 text-blue-400 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-sm">psychology</span>
                                        </div>
                                        <h3 className="font-bold text-white">GPT Image</h3>
                                    </div>

                                    <div className="aspect-square rounded-2xl bg-black/30 overflow-hidden relative group flex items-center justify-center">
                                        {loadingGpt ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                                                <span className="text-xs text-blue-400 animate-pulse">Generating...</span>
                                            </div>
                                        ) : errorGpt ? (
                                            <div className="bg-red-500/10 p-4 rounded-xl text-center flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
                                                <p className="text-xs text-red-400 font-medium px-2">Gagal Memproses</p>
                                                <p className="text-[10px] text-red-500/70 max-w-[200px] truncate">{errorGpt}</p>
                                            </div>
                                        ) : resultGpt ? (
                                            <>
                                                <img src={resultGpt} alt="GPT Result" className="w-full h-full object-cover" />
                                                <a
                                                    href={resultGpt}
                                                    download="gpt-image-result.png"
                                                    className="absolute bottom-4 right-4 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg translate-y-20 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                                                >
                                                    <span className="material-symbols-outlined">download</span>
                                                </a>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            {/* Card 3: Gemini 1 (Ryzumi Edit) */}
                            {(loadingRyzumiEdit || resultRyzumiEdit || errorRyzumiEdit) && (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 col-span-1 md:col-span-2 lg:col-span-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-purple-400/20 text-purple-400 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-sm">edit_square</span>
                                        </div>
                                        <h3 className="font-bold text-white">Gemini 1</h3>
                                    </div>

                                    <div className="aspect-square rounded-2xl bg-black/30 overflow-hidden relative group flex items-center justify-center">
                                        {loadingRyzumiEdit ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin"></div>
                                                <span className="text-xs text-purple-400 animate-pulse">Generating...</span>
                                            </div>
                                        ) : errorRyzumiEdit ? (
                                            <div className="bg-red-500/10 p-4 rounded-xl text-center flex flex-col items-center gap-2">
                                                <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
                                                <p className="text-xs text-red-400 font-medium px-2">Gagal Memproses</p>
                                                <p className="text-[10px] text-red-500/70 max-w-[200px] truncate">{errorRyzumiEdit}</p>
                                            </div>
                                        ) : resultRyzumiEdit ? (
                                            <>
                                                <img src={resultRyzumiEdit} alt="Gemini 1 Result" className="w-full h-full object-cover" />
                                                <a
                                                    href={resultRyzumiEdit}
                                                    download="gemini-1-result.png"
                                                    className="absolute bottom-4 right-4 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg translate-y-20 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
                                                >
                                                    <span className="material-symbols-outlined">download</span>
                                                </a>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

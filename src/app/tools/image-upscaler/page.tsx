"use client";

import { useState, useRef } from "react";
import Image from "next/image";

export default function ImageUpscalerPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [scale, setScale] = useState<number>(4);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Upload & Process States
    const [uploadProgress, setUploadProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResultUrl(null);
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files?.[0]) {
            const file = e.dataTransfer.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResultUrl(null);
            setError(null);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResultUrl(null);
        setError(null);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const uploadToCloudinary = async (file: File): Promise<{ url: string, public_id: string }> => {
        // 1. Get Signature
        const timestamp = Math.round(new Date().getTime() / 1000);
        const tags = 'temp_upscale';

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

        const xhr = new XMLHttpRequest();

        return new Promise((resolve, reject) => {
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    setUploadProgress(progress);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const data = JSON.parse(xhr.responseText);
                    resolve({ url: data.secure_url, public_id: data.public_id });
                } else {
                    reject(new Error("Upload failed"));
                }
            };

            xhr.onerror = () => reject(new Error("Upload failed"));
            xhr.send(formData);
        });
    };

    const deleteTempImage = async (public_id: string) => {
        try {
            await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ public_id, resource_type: 'image' })
            });
        } catch (e) {
            console.error("Failed to delete temp image:", e);
        }
    };

    const handleProcess = async () => {
        if (!selectedFile) return;

        setIsProcessing(true);
        setError(null);
        setResultUrl(null);
        setUploadProgress(0);

        let tempPublicId = "";

        try {
            // 1. Upload to Cloudinary
            const { url: cloudinaryUrl, public_id } = await uploadToCloudinary(selectedFile);
            tempPublicId = public_id;

            // 2. Call Upscale API
            // Endpoint: https://api.nekolabs.web.id/tools/upscale/supawork?imageUrl={url}&scale={scale}
            const apiUrl = `https://api.nekolabs.web.id/tools/upscale/supawork?imageUrl=${encodeURIComponent(cloudinaryUrl)}&scale=${scale}`;

            console.log("Calling Upscale API:", apiUrl);
            const res = await fetch(apiUrl);

            if (!res.ok) {
                if (res.status === 429) throw new Error("Too many requests. Please wait a moment.");
                throw new Error(`API Error: ${res.status} ${res.statusText}`);
            }

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const data = await res.json();
                console.log("Upscale API Response:", data);

                let foundUrl = null;

                // Try to find URL in various known fields
                if (data.url) foundUrl = data.url;
                else if (typeof data.data === 'string') foundUrl = data.data;
                else if (data.data?.url) foundUrl = data.data.url; // nested
                else if (data.result) foundUrl = data.result;
                else if (data.link) foundUrl = data.link;
                else if (data.output) foundUrl = data.output;
                else if (data.image) foundUrl = data.image;
                else if (data.task_url) foundUrl = data.task_url;
                else if (data.result_url) foundUrl = data.result_url;

                if (foundUrl) {
                    setResultUrl(foundUrl);
                } else if (data.status === false && data.message) {
                    throw new Error(`API Error: ${data.message}`);
                } else {
                    throw new Error(`API returned unexpected JSON structure. keys: ${Object.keys(data).join(', ')}`);
                }
            } else {
                // Assume blob/image response
                const blob = await res.blob();
                setResultUrl(URL.createObjectURL(blob));
            }

        } catch (err: any) {
            console.error("Upscale Error:", err);
            setError(err.message || "Gagal memproses gambar");
        } finally {
            setIsProcessing(false);
            if (tempPublicId) {
                // Delete temp image after processing (or maybe keep it? better to clean up)
                await deleteTempImage(tempPublicId);
            }
        }
    };

    return (
        <div className="min-h-screen bg-background-dark font-display text-white selection:bg-red-500/30 overflow-hidden">
            <div>
                {/* Header */}
                <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                        <span className="material-symbols-outlined text-4xl text-transparent bg-clip-text bg-gradient-to-br from-red-400 to-pink-400">hd</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-red-200 to-pink-200 py-2">
                        Upscale Image
                    </h1>
                    <p className="text-slate-400 max-w-lg text-lg">
                        Tingkatkan resolusi gambarmu hingga 16x lipat dengan teknologi AI super tajam.
                    </p>
                </div>

                <main className="max-w-7xl mx-auto px-6 pb-20 space-y-8">

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT: Controls */}
                        <div className="lg:col-span-4 space-y-6">

                            {/* Upload Zone */}
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
                                        <img src={previewUrl} alt="Original" className="w-full h-full object-contain p-2" />
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
                                        <span className="material-symbols-outlined text-5xl">add_photo_alternate</span>
                                        <div className="text-center px-4">
                                            <p className="font-bold text-white">Upload Gambar</p>
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

                            {/* Scale Settings */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-400 ml-1">Pilih Skala Upscale</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 4, 8, 16].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setScale(s)}
                                            disabled={isProcessing}
                                            className={`py-3 rounded-xl font-bold transition-all border ${scale === s
                                                ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/25"
                                                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                                                }`}
                                        >
                                            {s}x
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Process Button */}
                            <button
                                onClick={handleProcess}
                                disabled={!selectedFile || isProcessing}
                                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${!selectedFile || isProcessing
                                    ? "bg-white/5 text-slate-500 cursor-not-allowed"
                                    : "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:scale-[1.02] shadow-red-500/25"
                                    }`}
                            >
                                {isProcessing ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>{uploadProgress < 100 ? `Uploading ${uploadProgress}%` : "Enhancing..."}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">auto_fix_normal</span>
                                        <span>Mulai Upscale</span>
                                    </>
                                )}
                            </button>

                            {/* Error Message */}
                            {error && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
                                    <span className="material-symbols-outlined text-xl shrink-0">error</span>
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Result */}
                        <div className="lg:col-span-8 bg-black/20 rounded-3xl border border-white/10 p-2 overflow-hidden flex flex-col items-center justify-center min-h-[500px] relative">
                            {resultUrl ? (
                                <div className="relative w-full h-full flex items-center justify-center group">
                                    <img src={resultUrl} alt="Upscaled Result" className="max-h-[80vh] w-auto object-contain rounded-xl shadow-2xl" />

                                    <div className="absolute bottom-6 flex gap-3">
                                        <a
                                            href={resultUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">open_in_new</span>
                                            Preview Full
                                        </a>
                                        <a
                                            href={resultUrl}
                                            download={`upscaled_${scale}x_${new Date().getTime()}.png`}
                                            className="px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-500/25 transition-all flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">download</span>
                                            Download HD
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-slate-600 gap-4">
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-4xl opacity-50">image</span>
                                    </div>
                                    <p>Hasil upscale akan muncul di sini</p>
                                </div>
                            )}
                        </div>
                    </div>

                </main>
            </div>
        </div>
    );
}

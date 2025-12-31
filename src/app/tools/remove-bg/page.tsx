"use client";

import { useState, useRef } from "react";
import Image from "next/image";

export default function RemoveBgPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResultUrl(null); // Reset result
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
        }
    };

    const uploadToCloudinary = async (file: File): Promise<{ url: string, public_id: string }> => {
        // 1. Get Signature
        const timestamp = Math.round(new Date().getTime() / 1000);
        const tags = 'temp_remove_bg';

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

    const handleProcess = async () => {
        if (!selectedFile || !previewUrl) return;

        setIsProcessing(true);
        let tempPublicId = "";

        try {
            // Step 1: Upload to Cloudinary to get a public URL
            const { url: cloudinaryUrl, public_id } = await uploadToCloudinary(selectedFile);
            tempPublicId = public_id;

            // Step 2: Send URL to our API
            const res = await fetch('/api/remove-bg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: cloudinaryUrl }),
            });

            if (!res.ok) {
                let errorMessage = "Gagal memproses gambar";
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    console.error("Failed to parse error response", e);
                }
                throw new Error(errorMessage);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setResultUrl(url);

        } catch (error: any) {
            console.error(error);
            alert(`Gagal: ${error.message}`);
        } finally {
            // Cleanup: Delete the temporary image from Cloudinary
            if (tempPublicId) {
                await deleteTempImage(tempPublicId);
            }
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setResultUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="min-h-screen pt-24 pb-20 px-6 max-w-5xl mx-auto flex flex-col items-center">
            <div className="text-center mb-10 space-y-4">
                <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary mb-4">
                    <span className="material-symbols-outlined text-4xl">auto_fix_high</span>
                </div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500 pb-1 leading-normal">
                    Magic Background Remover
                </h1>
                <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                    Hapus background Foto dalam sekejap dengan teknologi AI
                </p>
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                {/* Upload Area */}
                <div
                    className={`relative aspect-[4/3] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden ${previewUrl
                        ? "border-primary/50 bg-slate-100 dark:bg-white/5"
                        : "border-slate-300 dark:border-white/10 hover:border-primary hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                        }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => !previewUrl && fileInputRef.current?.click()}
                >
                    {previewUrl ? (
                        <>
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                            {!isProcessing && !resultUrl && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                    className="absolute top-4 right-4 size-10 bg-black/50 hover:bg-red-500/80 text-white rounded-full grid place-items-center backdrop-blur-sm transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <span className="material-symbols-outlined text-5xl">cloud_upload</span>
                            <div className="text-center">
                                <p className="font-bold text-lg text-slate-900 dark:text-white">Klik atau Tarik Foto ke Sini</p>
                                <p className="text-sm">Mendukung format JPG, PNG</p>
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

                {/* Result Area */}
                <div className="space-y-6">
                    <div className="aspect-[4/3] rounded-3xl bg-[url('https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%3Fid%3DOIP.U35M0E0n1Vv9t2k3xV5xSwHaHa%26pid%3DApi&f=1&ipt=6c6d2c463f699026418858227090886733221971718049281928038814728590&ipo=images')] bg-repeat bg-[length:20px_20px] border border-slate-200 dark:border-white/10 overflow-hidden flex items-center justify-center relative">
                        {isProcessing ? (
                            <div className="flex flex-col items-center gap-4 z-10">
                                <div className="relative size-20">
                                    <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <p className="font-bold text-slate-900 bg-white/80 px-4 py-2 rounded-full backdrop-blur-sm">Sedang mengerjakan sihir...</p>
                            </div>
                        ) : resultUrl ? (
                            <img src={resultUrl} alt="Result" className="w-full h-full object-contain z-10 relative" />
                        ) : (
                            <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center">
                                <p className="text-slate-500 font-medium">Hasil akan muncul di sini</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleProcess}
                            disabled={!selectedFile || isProcessing || !!resultUrl}
                            className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${!selectedFile || isProcessing || resultUrl
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-white/5"
                                : "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25 hover:scale-[1.02]"
                                }`}
                        >
                            <span className="material-symbols-outlined">auto_fix_high</span>
                            Hapus Background
                        </button>

                        {resultUrl && (
                            <a
                                href={resultUrl}
                                download="removed-bg.png"
                                className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/25 transition-all hover:scale-[1.02]"
                            >
                                <span className="material-symbols-outlined">download</span>
                                Download
                            </a>
                        )}

                        {resultUrl && (
                            <button
                                onClick={handleReset}
                                className="px-5 rounded-xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-100 transition-colors"
                            >
                                Ulangi
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

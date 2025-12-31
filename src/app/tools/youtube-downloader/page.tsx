"use client";

import { useState } from "react";

// List of public Cobalt instances (Fallback Strategy)
// These APIs support CORS, allowing direct browser access
const COBALT_INSTANCES = [
    "https://api.cobalt.tools",    // Official-ish
    "https://co.wuk.sh",           // Popular
    "https://cobalt.xy24.eu",      // EU Mirror
    "https://api.wpsh.eu.org",     // Community
    "https://cobalt.kwiatekmiki.pl"// Community
];

export default function YoutubeDownloader() {
    const [url, setUrl] = useState("");
    const [quality, setQuality] = useState("720");
    const [type, setType] = useState("video"); // 'video' | 'audio'
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [updatingParams, setUpdatingParams] = useState(false);
    const [error, setError] = useState("");

    // --- CLIENT-SIDE FETCH LOGIC ---
    const fetchDirectFromCobalt = async (targetUrl: string, targetType: string, targetQuality: string) => {
        let lastError = null;

        // Try each instance until one works
        for (const instance of COBALT_INSTANCES) {
            try {
                console.log(`Trying Cobalt instance: ${instance}`);
                const res = await fetch(`${instance}/api/json`, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        url: targetUrl,
                        vCodec: "h264",
                        vQuality: targetQuality && targetQuality !== 'Highest' ? targetQuality.replace('p', '') : "1080",
                        aFormat: "mp3",
                        isAudioOnly: targetType === "audio"
                    })
                });

                if (res.ok) {
                    const result = await res.json();
                    if (result.url || result.stream) {
                        return {
                            url: result.url,
                            title: result.filename || "YouTube Video",
                            thumbnail: "", // Cobalt often skips thumb in simple mode
                            text: result.filename
                        };
                    }
                }
            } catch (err: any) {
                console.warn(`Failed instance ${instance}:`, err);
                lastError = err.message;
            }
        }

        throw new Error(lastError || "Semua server sedang sibuk. Coba lagi nanti.");
    };

    // Main Fetch Function
    const handleFetch = async () => {
        if (!url) return;

        if (data) {
            setUpdatingParams(true);
        } else {
            setLoading(true);
        }
        setError("");

        try {
            // Direct Client-Side Call
            const result = await fetchDirectFromCobalt(url, type, quality);
            setData(result);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Gagal mengambil data. Pastikan link valid.");
        } finally {
            setLoading(false);
            setUpdatingParams(false);
        }
    };

    // Triggered when Quality changes
    const handleQualityChange = async (newQuality: string) => {
        setQuality(newQuality);
        if (!url) return;

        setUpdatingParams(true);
        setError("");

        try {
            const result = await fetchDirectFromCobalt(url, type, newQuality);
            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUpdatingParams(false);
        }
    };

    const getYouTubeID = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Helper to render download links safely
    const renderDownloadSection = () => {
        if (!data) return null;

        // Parser
        const raw = data; // Cobalt data is flatter now
        let title = raw.title || raw.text || "Video YouTube";

        // Thumbnail Logic
        const thumbUrl = (getYouTubeID(url) ? `https://img.youtube.com/vi/${getYouTubeID(url)}/hqdefault.jpg` : "");

        // Download Link Logic
        let downloadUrl = raw.url || "";

        return (
            <div className="w-full max-w-2xl glass-card-premium rounded-2xl p-6 shadow-2xl border border-white/10 bg-white/5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

                {/* 1. Video Info (Thumbnail + Title) */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Thumbnail */}
                    <div className="w-full md:w-1/3 aspect-video rounded-xl overflow-hidden bg-black/50 relative group shadow-lg">
                        {thumbUrl ? (
                            <img src={thumbUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <span className="material-symbols-outlined text-4xl">movie</span>
                            </div>
                        )}
                    </div>

                    {/* Title & Status */}
                    <div className="flex-1 flex flex-col justify-center space-y-2">
                        <h3 className="font-bold text-lg text-white leading-tight line-clamp-3">
                            {title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-white/10 border border-white/5 font-mono text-xs uppercase">
                                {type === 'audio' ? 'MP3' : `${quality}p`}
                            </span>
                            {updatingParams && (
                                <span className="flex items-center gap-1 text-rose-400 text-xs animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                                    Updating Link...
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Controls & Download Action */}
                <div className="bg-black/20 rounded-xl p-4 border border-white/5 flex flex-col gap-4">

                    {/* Quality Selector (Only if Video) */}
                    {type === 'video' && (
                        <div className="w-full">
                            <label className="text-xs text-slate-400 ml-1 mb-1 block">Pilih Kualitas Video:</label>
                            <div className="relative">
                                <select
                                    value={quality}
                                    onChange={(e) => handleQualityChange(e.target.value)}
                                    className="w-full appearance-none bg-slate-900/80 border border-white/10 text-white py-3 px-4 rounded-xl outline-none focus:border-rose-500/50 transition-colors cursor-pointer text-sm font-medium hover:bg-slate-800"
                                >
                                    <option value="2160">4K (2160p)</option>
                                    <option value="1440">2K (1440p)</option>
                                    <option value="1080">Full HD (1080p)</option>
                                    <option value="720">HD (720p)</option>
                                    <option value="480">SD (480p)</option>
                                    <option value="360">Low (360p)</option>
                                    <option value="144">Very Low (144p)</option>
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/50">
                                    <span className="material-symbols-outlined text-sm">expand_more</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Download Button */}
                    <div className="w-full">
                        {downloadUrl && typeof downloadUrl === 'string' ? (
                            <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`w-full py-4 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg border border-white/10 ${updatingParams
                                    ? "bg-slate-700/50 cursor-wait opacity-80"
                                    : "bg-gradient-to-br from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 shadow-rose-500/20 active:scale-[0.98]"
                                    }`}
                            >
                                {updatingParams ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Memproses...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">download</span>
                                        <span>Download {type === 'audio' ? 'Audio' : 'Video'}</span>
                                    </>
                                )}
                            </a>
                        ) : (
                            <button disabled className="w-full py-4 bg-slate-700/50 text-slate-400 rounded-xl font-bold border border-white/5 cursor-not-allowed">
                                Link Tidak Tersedia
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <main className="flex-1 flex w-full relative min-h-screen overflow-hidden bg-background-dark selection:bg-rose-500/30 selection:text-rose-200 font-sans">

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-5xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start pt-12 md:pt-20 space-y-8 overflow-y-auto">

                {/* Header */}
                <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 text-rose-400 mb-2 shadow-lg shadow-rose-500/10 backdrop-blur-md">
                        <span className="material-symbols-outlined text-4xl">smart_display</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200 tracking-tight">
                        YouTube <span className="text-rose-500">Downloader</span>
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-light tracking-wide">
                        Simpan video favoritmu dalam kualitas HD. Cepat, gratis, dan tanpa gangguan.
                    </p>
                </div>

                {/* Input Card Container */}
                <div className="w-full max-w-2xl">

                    {/* Search Bar + Format Toggle */}
                    <div className="glass-card-premium p-2 rounded-2xl shadow-2xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col md:flex-row gap-2 transition-transform hover:scale-[1.01] duration-300">
                        {/* Format Dropdown (Pre-Search) */}
                        <div className="relative md:w-36 border-b md:border-b-0 md:border-r border-white/10 shrink-0">
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full h-full appearance-none bg-transparent text-white py-3 pl-4 pr-10 font-bold outline-none cursor-pointer hover:bg-white/5 transition-colors text-sm rounded-t-xl md:rounded-l-xl md:rounded-tr-none"
                            >
                                <option value="video" className="bg-slate-900 text-rose-400">MP4 (Video)</option>
                                <option value="audio" className="bg-slate-900 text-blue-400">MP3 (Audio)</option>
                            </select>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/50">
                                <span className="material-symbols-outlined text-sm">expand_more</span>
                            </div>
                        </div>

                        {/* Input */}
                        <div className="flex-1 relative group">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-rose-500 transition-colors">link</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Tempel link YouTube di sini..."
                                className="w-full pl-10 pr-4 py-4 bg-transparent border-none outline-none text-white placeholder-slate-500 font-medium focus:ring-0"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                        </div>

                        {/* Search Button */}
                        <button
                            onClick={() => handleFetch()}
                            disabled={loading || !url}
                            className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${loading || !url
                                ? "bg-white/10 cursor-not-allowed text-slate-500"
                                : "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 shadow-rose-500/30 active:scale-95"
                                }`}
                        >
                            {loading ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span className="hidden md:inline">Proses</span>
                                </>
                            ) : (
                                <>
                                    <span className="hidden md:inline">Cari</span>
                                    <span className="material-symbols-outlined">search</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="w-full max-w-2xl animate-in fade-in slide-in-from-top-2">
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl flex items-start gap-3 backdrop-blur-md">
                            <span className="material-symbols-outlined shrink-0 mt-0.5 text-red-400">error</span>
                            <div className="text-sm font-medium">{error}</div>
                        </div>
                    </div>
                )}

                {/* Result Section */}
                <div className="w-full flex justify-center pb-20">
                    {renderDownloadSection()}
                </div>
            </div>
        </main>
    );
}

"use client";

import { useState, useEffect } from "react";

interface GempaData {
    Tanggal: string;
    Jam: string;
    DateTime: string;
    Coordinates: string;
    Lintang: string;
    Bujur: string;
    Magnitude: string;
    Kedalaman: string;
    Wilayah: string;
    Potensi?: string;
    Dirasakan?: string;
    Shakemap?: string;
}

interface DisasterResponse {
    autogempa: GempaData;
    gempaterkini: GempaData[];
    gempadirasakan: GempaData[];
}

export default function DisasterDetectorPage() {
    const [data, setData] = useState<DisasterResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<'terkini' | 'dirasakan'>('dirasakan');

    // Geolocation State
    const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
    const [userAddress, setUserAddress] = useState<string>("");
    const [distance, setDistance] = useState<number | null>(null);
    const [closestGempa, setClosestGempa] = useState<GempaData & { distance: number } | null>(null);
    const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [locError, setLocError] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/disaster-detector");
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Gagal mengambil data");
            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getShakemapUrl = (filename?: string) => {
        if (!filename) return null;
        return `https://data.bmkg.go.id/DataMKG/TEWS/${filename}`;
    };

    // Haversine Formula to calculate distance in km
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // Distance in km
        return Math.round(d);
    };

    const deg2rad = (deg: number) => {
        return deg * (Math.PI / 180);
    };

    const handleCheckLocation = () => {
        if (!navigator.geolocation) {
            setLocError("Browser Anda tidak mendukung Geolocation.");
            setLocStatus('error');
            return;
        }

        setLocStatus('loading');
        setLocError("");
        setClosestGempa(null);
        setUserAddress(""); // Clear previous address

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // 1. Calculate Distance & Show Result IMMEDIATELY
                // We update state here first so the user gets "Fast" feedback
                if (data) {
                    try {
                        const allGempa = [
                            data.autogempa,
                            ...data.gempaterkini,
                            ...data.gempadirasakan
                        ];

                        const gempaWithDist = allGempa.map(g => {
                            const [gLat, gLng] = g.Coordinates.split(',').map(parseFloat);
                            return {
                                ...g,
                                distance: calculateDistance(latitude, longitude, gLat, gLng)
                            };
                        });

                        gempaWithDist.sort((a, b) => a.distance - b.distance);
                        const nearest = gempaWithDist[0];

                        setClosestGempa(nearest);
                        setDistance(nearest.distance);
                        setUserLoc({ lat: latitude, lng: longitude });
                        setLocStatus('success'); // UNBLOCK UI HERE
                    } catch (e) {
                        console.error("Calculation Error:", e);
                        setLocError("Gagal menghitung jarak gempa.");
                        setLocStatus('error');
                        return;
                    }
                }

                // 2. Resolve Address in Background (Async)
                try {
                    const addrRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`, {
                        headers: { 'User-Agent': 'OurSpaceDisasterDetector/1.0' }
                    });

                    if (addrRes.ok) {
                        const addrData = await addrRes.json();
                        if (addrData && (addrData.address || addrData.display_name)) {
                            const parts = addrData.address || {};
                            const locName = [
                                parts.village || parts.town || parts.city || parts.county,
                                parts.state || parts.region
                            ].filter(Boolean).join(", ");
                            setUserAddress(locName || addrData.display_name.split(',').slice(0, 2).join(', '));
                        } else {
                            setUserAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                        }
                    } else {
                        // Silent fail to coords
                        setUserAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                    }
                } catch (fetchErr) {
                    console.warn("Nominatim fetch failed", fetchErr);
                    setUserAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                }
            },
            (err) => {
                setLocStatus('error');
                let msg = "Gagal mengambil lokasi.";
                if (err.code === 1) msg = "Izin lokasi ditolak. Mohon izinkan akses lokasi di browser.";
                else if (err.code === 2) msg = "Sinyal GPS tidak tersedia.";
                else if (err.code === 3) msg = "Waktu permintaan habis (Timeout). Coba lagi.";
                setLocError(msg);
                console.error(err);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    return (
        <main className="flex-1 flex w-full relative min-h-screen overflow-hidden bg-background-dark selection:bg-rose-500/30 selection:text-rose-200 font-sans">

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col items-center justify-start pt-12 md:pt-20 space-y-8 overflow-y-auto">

                {/* Header */}
                <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 text-rose-400 mb-2 shadow-lg shadow-rose-500/10 backdrop-blur-md">
                        <span className="material-symbols-outlined text-4xl">tsunami</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-200 tracking-tight">
                        Info <span className="text-rose-500">Gempa</span>
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-light tracking-wide">
                        Pantau informasi gempa bumi terkini dari BMKG secara real-time.
                    </p>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="w-full max-w-2xl p-20 flex flex-col items-center justify-center gap-4 animate-in fade-in">
                        <div className="w-12 h-12 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                        <p className="text-slate-400 text-sm animate-pulse">Mengambil data dari BMKG...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="w-full max-w-2xl bg-red-500/10 border border-red-500/20 text-red-200 p-6 rounded-2xl flex flex-col items-center gap-2 backdrop-blur-md">
                        <span className="material-symbols-outlined text-3xl text-red-400">error</span>
                        <div className="font-bold">Gagal Mengambil Data</div>
                        <div className="text-sm opacity-80">{error}</div>
                        <button
                            onClick={fetchData}
                            className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg text-sm font-bold transition-colors"
                        >
                            Coba Lagi
                        </button>
                    </div>
                )}

                {/* Data Display */}
                {!loading && !error && data && (
                    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">

                        {/* LEFT COLUMN: Main Hightlight (AutoGempa) */}
                        <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6">

                            {/* Hero Card */}
                            <div className="glass-card-premium rounded-3xl overflow-hidden border border-white/10 relative group">
                                <div className="absolute top-0 right-0 p-6 z-10">
                                    <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-500/20 animate-pulse">
                                        TERBARU
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 bg-black/20">
                                    {/* Map / Image */}
                                    <div className="relative min-h-[300px] h-full flex items-center justify-center p-4">
                                        {data.autogempa.Shakemap ? (
                                            <img
                                                src={getShakemapUrl(data.autogempa.Shakemap) || ""}
                                                alt="Shakemap"
                                                className="w-full h-full object-contain relative z-10"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                <span className="material-symbols-outlined text-6xl">map</span>
                                            </div>
                                        )}
                                        {/* Subtle vignette */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none md:hidden"></div>
                                    </div>

                                    {/* Details */}
                                    <div className="p-6 md:p-8 flex flex-col justify-center gap-6 relative bg-background-dark/50 backdrop-blur-sm">
                                        <div>
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className={`text-5xl md:text-6xl font-black tracking-tighter ${parseFloat(data.autogempa.Magnitude) >= 5 ? "text-rose-500" : "text-white"}`}>
                                                    {data.autogempa.Magnitude}
                                                </span>
                                                <span className="text-xl font-medium text-slate-400">SR</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm uppercase tracking-wider mb-4">
                                                <span className="material-symbols-outlined text-lg">public</span>
                                                Magnitude
                                            </div>
                                            <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mb-2">
                                                {data.autogempa.Wilayah}
                                            </h2>
                                            <p className="text-slate-400 text-sm">
                                                {data.autogempa.Tanggal} • {data.autogempa.Jam}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors">
                                                <div className="text-xs text-slate-400 uppercase font-bold mb-1">Kedalaman</div>
                                                <div className="text-white font-bold flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-blue-400">vertical_align_bottom</span>
                                                    {data.autogempa.Kedalaman}
                                                </div>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors">
                                                <div className="text-xs text-slate-400 uppercase font-bold mb-1">Koordinat</div>
                                                <div className="text-white font-bold flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-green-400">explore</span>
                                                    {data.autogempa.Lintang}, {data.autogempa.Bujur}
                                                </div>
                                            </div>
                                        </div>

                                        {/* POTENSI SECTION */}
                                        <div className={`border rounded-xl p-4 flex flex-col gap-2 ${data.autogempa.Potensi?.toLowerCase().includes('tidak berpotensi')
                                            ? "bg-green-500/10 border-green-500/20"
                                            : "bg-red-500/20 border-red-500/50 animate-pulse"
                                            }`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`material-symbols-outlined ${data.autogempa.Potensi?.toLowerCase().includes('tidak berpotensi') ? "text-green-400" : "text-red-400"
                                                    }`}>
                                                    {data.autogempa.Potensi?.toLowerCase().includes('tidak berpotensi') ? "check_circle" : "warning"}
                                                </span>
                                                <span className={`text-xs font-bold uppercase ${data.autogempa.Potensi?.toLowerCase().includes('tidak berpotensi') ? "text-green-400" : "text-red-400"
                                                    }`}>
                                                    Status Potensi
                                                </span>
                                            </div>
                                            <div className={`text-sm md:text-base font-bold leading-relaxed ${data.autogempa.Potensi?.toLowerCase().includes('tidak berpotensi') ? "text-green-100" : "text-white"
                                                }`}>
                                                {data.autogempa.Potensi}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* GPS SAFETY CHECK - SEPARATE CARD */}
                            <div className="glass-card-premium rounded-3xl p-6 border border-white/10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                                    <div className="flex-1 min-w-0 text-center md:text-left">
                                        <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                                            <span className="material-symbols-outlined text-rose-400">add_location_alt</span>
                                            Cek Dampak Lokasi
                                        </h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            Analisis jarak & lokasi otomatis untuk mengetahui gempa mana yang paling dekat dengan posisi Anda.
                                        </p>
                                    </div>

                                    <div className="w-full md:w-auto shrink-0 flex flex-col gap-2 min-w-[200px]">
                                        {locStatus === 'idle' && (
                                            <button
                                                onClick={handleCheckLocation}
                                                className="w-full py-3 px-6 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-rose-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined">my_location</span>
                                                Cek Sekarang
                                            </button>
                                        )}

                                        {locStatus === 'loading' && (
                                            <div className="w-full py-3 px-6 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center gap-3 text-slate-400 animate-pulse">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Melacak...</span>
                                            </div>
                                        )}

                                        {locStatus === 'error' && (
                                            <div className="w-full">
                                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-xs text-center mb-2">
                                                    {locError}
                                                </div>
                                                <button onClick={handleCheckLocation} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg">
                                                    Coba Lagi
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Result Display */}
                                {locStatus === 'success' && closestGempa && (
                                    <div className={`mt-6 p-5 rounded-2xl border flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 ${closestGempa.distance < 100
                                        ? "bg-orange-500/10 border-orange-500/30"
                                        : "bg-blue-500/10 border-blue-500/30"
                                        }`}>
                                        {/* Status Header */}
                                        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${closestGempa.distance < 100 ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
                                                }`}>
                                                <span className="material-symbols-outlined text-xl">
                                                    {closestGempa.distance < 100 ? "warning" : "verified_user"}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-xs text-white/60 uppercase font-bold">Status Keamanan</div>
                                                <div className={`font-bold text-lg leading-none ${closestGempa.distance < 100 ? "text-orange-400" : "text-blue-400"
                                                    }`}>
                                                    {closestGempa.distance < 50 ? "BAHAYA / TERASA KUAT" : closestGempa.distance < 200 ? "WASPADA GUNCANGAN" : "RELATIF AMAN"}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Location Info */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-black/20 rounded-xl p-3">
                                                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold mb-1">
                                                    <span className="material-symbols-outlined text-sm">person_pin_circle</span>
                                                    LOKASI ANDA
                                                </div>
                                                <div className="text-white text-sm font-medium line-clamp-2">
                                                    {userAddress || "Mendeteksi alamat..."}
                                                </div>
                                            </div>

                                            <div className="bg-black/20 rounded-xl p-3">
                                                <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold mb-1">
                                                    <span className="material-symbols-outlined text-sm">social_distance</span>
                                                    GEMPA TERDEKAT ({closestGempa.distance} km)
                                                </div>
                                                <div className="text-white text-sm font-medium">
                                                    {closestGempa.Wilayah}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                                    <span className="bg-white/10 px-1.5 rounded text-white">{closestGempa.Magnitude} SR</span>
                                                    <span>{closestGempa.Tanggal} • {closestGempa.Jam}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Advisory Message */}
                                        <div className="text-sm text-white/80 italic border-l-2 border-white/20 pl-3">
                                            "{closestGempa.distance < 50
                                                ? "Pusat gempa sangat dekat. Jika baru saja terjadi, waspadai gempa susulan!"
                                                : closestGempa.distance < 200
                                                    ? "Anda mungkin merasakan getaran. Tetap tenang dan pantau informasi."
                                                    : "Pusat gempa cukup jauh dari lokasi Anda. Kecil kemungkinan dampak kerusakan."
                                            }"
                                        </div>

                                        <button onClick={handleCheckLocation} className="self-end text-xs text-white/40 hover:text-white flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-full transition-colors">
                                            <span className="material-symbols-outlined text-sm">refresh</span> Update Lokasi
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* RIGHT COLUMN: List (Tabs) */}
                        <div className="lg:col-span-12 xl:col-span-4 flex flex-col h-full min-h-[500px]">
                            <div className="glass-card-premium rounded-3xl border border-white/10 flex flex-col h-full overflow-hidden">

                                {/* Tabs */}
                                <div className="flex border-b border-white/10">
                                    <button
                                        onClick={() => setActiveTab('dirasakan')}
                                        className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'dirasakan' ? 'bg-white/10 text-white border-b-2 border-rose-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        Dirasakan ({data.gempadirasakan.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('terkini')}
                                        className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'terkini' ? 'bg-white/10 text-white border-b-2 border-rose-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        Terkini ({data.gempaterkini.length})
                                    </button>
                                </div>

                                {/* List Content */}
                                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar max-h-[600px] lg:max-h-[none]">
                                    {(activeTab === 'dirasakan' ? data.gempadirasakan : data.gempaterkini).map((gempa, idx) => (
                                        <div key={idx} className="bg-white/5 hover:bg-white/10 rounded-xl p-4 transition-colors border border-white/5 flex gap-4 group">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shrink-0 ${parseFloat(gempa.Magnitude) >= 5.0 ? 'bg-red-500 shadow-lg shadow-red-500/20' : 'bg-slate-700'}`}>
                                                {gempa.Magnitude}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-bold text-white text-sm truncate pr-2" title={gempa.Wilayah}>
                                                        {gempa.Wilayah}
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap bg-black/20 px-1.5 py-0.5 rounded">
                                                        {gempa.Jam}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[10px]">calendar_today</span>
                                                        {gempa.Tanggal}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[10px]">vertical_align_bottom</span>
                                                        {gempa.Kedalaman}
                                                    </span>
                                                </div>
                                                {gempa.Dirasakan && (
                                                    <p className="text-[10px] text-yellow-500/80 italic leading-tight line-clamp-2">
                                                        <span className="font-bold">Dirasakan:</span> {gempa.Dirasakan}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>

                    </div>
                )}
            </div>
        </main>
    );
}

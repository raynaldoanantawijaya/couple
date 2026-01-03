"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Image Upload State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    // Video Preview State
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
    const [videoDuration, setVideoDuration] = useState(0);
    const [coverTime, setCoverTime] = useState(0);
    const [showVideoModal, setShowVideoModal] = useState(false);

    // Common Metadata State
    const [uploadTitle, setUploadTitle] = useState("");
    const [uploadDate, setUploadDate] = useState("");
    const [coverGravity, setCoverGravity] = useState("center");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Session Check & Logout Logic
    useEffect(() => {
        const checkSession = () => {
            const session = localStorage.getItem("auth_session");
            if (session) {
                try {
                    const { loginTime } = JSON.parse(session);
                    // 24 hours = 86400000 ms
                    if (Date.now() - loginTime > 86400000) {
                        handleLogout();
                    }
                } catch (e) {
                    console.error("Session parse error", e);
                }
            }
        };

        checkSession();
        const interval = setInterval(checkSession, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        if (confirm("Apakah Anda yakin ingin keluar?")) {
            localStorage.removeItem("auth_session");
            document.cookie = "auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
            router.push("/");
        }
    };

    if (pathname === "/") return null;

    const navItems = [
        { name: "Beranda", href: "/beranda" },
        { name: "Galeri", href: "/gallery" },
        { name: "Vidio", href: "/video" },
        { name: "Visi Misi", href: "/visi-misi" },
        { name: "Tabungan", href: "/tabungan" },
        { name: "Project", href: "/project" },
        {
            name: "Alat",
            href: "#",
            children: [
                { name: "AI Foto Generator", href: "/tools/ai-photo", icon: "add_a_photo" },
                { name: "Upscale Image", href: "/tools/image-upscaler", icon: "hd" },
                { name: "Hapus Background", href: "/tools/remove-bg", icon: "auto_fix_high" },
                { name: "Youtube Downloader", href: "/tools/youtube-downloader", icon: "smart_display" },
                { name: "Info Gempa", href: "/tools/disaster-detector", icon: "tsunami" },
                { name: "Market Monitor", href: "/tools/investment", icon: "show_chart" }
            ]
        },
    ];

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        if (!e.target.files?.[0]) return;
        const file = e.target.files[0];

        // Reset metadata
        setUploadTitle("");
        setUploadDate(new Date().toISOString().split('T')[0]); // Default today

        if (type === 'video') {
            const url = URL.createObjectURL(file);
            setVideoFile(file);
            setVideoPreviewUrl(url);
            setCoverTime(0);
            setShowVideoModal(true);
        } else {
            const url = URL.createObjectURL(file);
            setImageFile(file);
            setImagePreviewUrl(url);
            setShowImageModal(true);
            setCoverGravity("center"); // Reset gravity
        }
        e.target.value = ""; // Reset input
    };

    const handleGravityClick = (x: number, y: number) => {

        // Simple 3x3 Grid Logic
        let v = "center";
        let h = "center";

        if (y < 0.33) v = "north";
        else if (y > 0.66) v = "south";

        if (x < 0.33) h = "west";
        else if (x > 0.66) h = "east";

        if (v === "center" && h === "center") setCoverGravity("center");
        else if (v === "center") setCoverGravity(h);
        else if (h === "center") setCoverGravity(v);
        else setCoverGravity(`${v}_${h}`);
    };

    const getIndicatorPos = (gravity: string) => {
        const map: Record<string, { x: string, y: string }> = {
            center: { x: '50%', y: '50%' },
            north: { x: '50%', y: '15%' },
            south: { x: '50%', y: '85%' },
            east: { x: '85%', y: '50%' },
            west: { x: '15%', y: '50%' },
            north_east: { x: '85%', y: '15%' },
            north_west: { x: '15%', y: '15%' },
            south_east: { x: '85%', y: '85%' },
            south_west: { x: '15%', y: '85%' },
        };
        return map[gravity] || map.center;
    };

    const processUpload = async (type: 'image' | 'video') => {
        const file = type === 'image' ? imageFile : videoFile;
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);
        setShowImageModal(false);
        setShowVideoModal(false);

        try {
            const timestamp = Math.round(new Date().getTime() / 1000);
            const tags = type === 'image' ? 'gallery' : 'video';

            // Build Context Metadata
            let context = `caption=${uploadTitle}|date=${uploadDate}|cover_gravity=${coverGravity}`;
            if (type === 'video') {
                context += `|duration=${videoDuration}|cover_offset=${coverTime}`;
            }

            // 1. Get Signature from Server
            const signRes = await fetch('/api/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paramsToSign: {
                        timestamp,
                        tags,
                        context
                    }
                })
            });

            if (!signRes.ok) throw new Error("Failed to sign request");
            const { signature, apiKey, cloudName } = await signRes.json();

            // 2. Upload to Cloudinary with Signature
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", apiKey);
            formData.append("timestamp", timestamp.toString());
            formData.append("signature", signature);
            formData.append("tags", tags);
            formData.append("context", context);

            const xhr = new XMLHttpRequest();
            xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                setIsUploading(false);
                if (xhr.status === 200) {
                    alert(`Upload berhasil!`);
                    window.location.reload(); // Reload to fetch new data from API
                } else {
                    console.error("Upload failed", xhr.responseText);
                    try {
                        const err = JSON.parse(xhr.responseText);
                        alert("Upload gagal: " + (err.error?.message || "Unknown error"));
                    } catch (e) {
                        alert("Upload gagal: " + xhr.responseText);
                    }
                }
            };

            xhr.onerror = () => {
                setIsUploading(false);
                alert("Terjadi kesalahan jaringan.");
            };

            xhr.send(formData);

        } catch (error) {
            console.error(error);
            setIsUploading(false);
            alert("Terjadi kesalahan saat menyiapkan upload.");
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    return (
        <>
            {/* Image Details Modal */}
            {showImageModal && imagePreviewUrl && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col gap-4 border border-white/10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detail Foto</h3>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">
                                Posisi Fokus Thumbnail ({coverGravity.replace('_', ' ')})
                            </label>
                            <div className="relative aspect-square bg-black rounded-lg overflow-hidden cursor-move group touch-none select-none"
                                onMouseDown={(e) => {
                                    const target = e.currentTarget as HTMLElement;
                                    const rect = target.getBoundingClientRect();
                                    const x = (e.clientX - rect.left) / rect.width;
                                    const y = (e.clientY - rect.top) / rect.height;
                                    handleGravityClick(x, y);

                                    const handleMouseMove = (ev: MouseEvent) => {
                                        const rx = (ev.clientX - rect.left) / rect.width;
                                        const ry = (ev.clientY - rect.top) / rect.height;
                                        handleGravityClick(rx, ry);
                                    };

                                    const handleMouseUp = () => {
                                        window.removeEventListener('mousemove', handleMouseMove);
                                        window.removeEventListener('mouseup', handleMouseUp);
                                    };

                                    window.addEventListener('mousemove', handleMouseMove);
                                    window.addEventListener('mouseup', handleMouseUp);
                                }}
                                onTouchStart={(e) => {
                                    const target = e.currentTarget as HTMLElement;
                                    const rect = target.getBoundingClientRect();
                                    const x = (e.touches[0].clientX - rect.left) / rect.width;
                                    const y = (e.touches[0].clientY - rect.top) / rect.height;
                                    handleGravityClick(x, y);

                                    const handleTouchMove = (ev: TouchEvent) => {
                                        const rx = (ev.touches[0].clientX - rect.left) / rect.width;
                                        const ry = (ev.touches[0].clientY - rect.top) / rect.height;
                                        handleGravityClick(rx, ry);
                                    };

                                    const handleTouchEnd = () => {
                                        window.removeEventListener('touchmove', handleTouchMove);
                                        window.removeEventListener('touchend', handleTouchEnd);
                                    };

                                    window.addEventListener('touchmove', handleTouchMove);
                                    window.addEventListener('touchend', handleTouchEnd);
                                }}
                            >
                                <img
                                    src={imagePreviewUrl}
                                    className="w-full h-full object-cover pointer-events-none opacity-80"
                                    style={{
                                        objectPosition: `${getIndicatorPos(coverGravity).x} ${getIndicatorPos(coverGravity).y}`
                                    }}
                                    alt="Preview"
                                />

                                {/* Grid Lines */}
                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                                    {[...Array(9)].map((_, i) => <div key={i} className="border border-white/50"></div>)}
                                </div>

                                {/* Focus Indicator */}
                                <div
                                    className="absolute w-8 h-8 -ml-4 -mt-4 border-2 border-primary bg-primary/20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg shadow-black/50"
                                    style={{
                                        left: getIndicatorPos(coverGravity).x,
                                        top: getIndicatorPos(coverGravity).y
                                    }}
                                >
                                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                                </div>

                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                                    Geser titik fokus
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Judul / Caption</label>
                                <input
                                    type="text"
                                    value={uploadTitle}
                                    onChange={e => setUploadTitle(e.target.value)}
                                    placeholder="Contoh: Kencan Pertama"
                                    className="w-full p-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Tanggal</label>
                                <input
                                    type="date"
                                    value={uploadDate}
                                    onChange={e => setUploadDate(e.target.value)}
                                    className="w-full p-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={() => { setShowImageModal(false); setImagePreviewUrl(null); }}
                                className="flex-1 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => processUpload('image')}
                                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Details Modal */}
            {showVideoModal && videoPreviewUrl && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 border border-white/10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Detail Vidio</h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Judul</label>
                                    <input
                                        type="text"
                                        value={uploadTitle}
                                        onChange={e => setUploadTitle(e.target.value)}
                                        placeholder="Judul Vidio"
                                        className="w-full p-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Tanggal</label>
                                    <input
                                        type="date"
                                        value={uploadDate}
                                        onChange={e => setUploadDate(e.target.value)}
                                        className="w-full p-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Cover Gravity Interaction */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">
                                    Posisi Fokus Cover ({coverGravity.replace('_', ' ')})
                                </label>
                                <div
                                    className="relative aspect-video bg-black rounded-lg overflow-hidden cursor-move group touch-none select-none"
                                    onMouseDown={(e) => {
                                        const target = e.currentTarget as HTMLElement;
                                        const rect = target.getBoundingClientRect();
                                        const x = (e.clientX - rect.left) / rect.width;
                                        const y = (e.clientY - rect.top) / rect.height;
                                        handleGravityClick(x, y);

                                        const handleMouseMove = (ev: MouseEvent) => {
                                            const rx = (ev.clientX - rect.left) / rect.width;
                                            const ry = (ev.clientY - rect.top) / rect.height;
                                            handleGravityClick(rx, ry);
                                        };

                                        const handleMouseUp = () => {
                                            window.removeEventListener('mousemove', handleMouseMove);
                                            window.removeEventListener('mouseup', handleMouseUp);
                                        };

                                        window.addEventListener('mousemove', handleMouseMove);
                                        window.addEventListener('mouseup', handleMouseUp);
                                    }}
                                    onTouchStart={(e) => {
                                        const target = e.currentTarget as HTMLElement;
                                        const rect = target.getBoundingClientRect();
                                        const x = (e.touches[0].clientX - rect.left) / rect.width;
                                        const y = (e.touches[0].clientY - rect.top) / rect.height;
                                        handleGravityClick(x, y);

                                        const handleTouchMove = (ev: TouchEvent) => {
                                            const rx = (ev.touches[0].clientX - rect.left) / rect.width;
                                            const ry = (ev.touches[0].clientY - rect.top) / rect.height;
                                            handleGravityClick(rx, ry);
                                        };

                                        const handleTouchEnd = () => {
                                            window.removeEventListener('touchmove', handleTouchMove);
                                            window.removeEventListener('touchend', handleTouchEnd);
                                        };

                                        window.addEventListener('touchmove', handleTouchMove);
                                        window.addEventListener('touchend', handleTouchEnd);
                                    }}
                                >
                                    <video
                                        ref={videoRef}
                                        src={videoPreviewUrl}
                                        className="w-full h-full object-cover pointer-events-none opacity-80 transition-all duration-200"
                                        style={{
                                            objectPosition: `${getIndicatorPos(coverGravity).x} ${getIndicatorPos(coverGravity).y}`
                                        }}
                                        onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                                        key={videoPreviewUrl}
                                        muted
                                    />

                                    {/* Grid Lines for visual aid */}
                                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
                                        {[...Array(9)].map((_, i) => <div key={i} className="border border-white/50"></div>)}
                                    </div>

                                    {/* Focus Indicator */}
                                    <div
                                        className="absolute w-8 h-8 -ml-4 -mt-4 border-2 border-primary bg-primary/20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg shadow-black/50"
                                        style={{
                                            left: getIndicatorPos(coverGravity).x,
                                            top: getIndicatorPos(coverGravity).y
                                        }}
                                    >
                                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                                    </div>

                                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                                        Geser untuk atur posisi
                                    </div>
                                </div>
                            </div>

                            {/* Cover Selection Slider */}
                            <div className="flex flex-col gap-2 bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                                <label className="text-xs font-bold uppercase text-slate-500">Pilih Frame Cover</label>
                                <div className="flex justify-between text-xs text-slate-500 font-medium font-mono">
                                    <span>{formatDuration(coverTime)}</span>
                                    <span>{formatDuration(videoDuration)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max={videoDuration || 100}
                                    step="0.1"
                                    value={coverTime}
                                    onChange={(e) => {
                                        const time = parseFloat(e.target.value);
                                        setCoverTime(time);
                                        if (videoRef.current) videoRef.current.currentTime = time;
                                    }}
                                    className="w-full accent-primary h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 hover:accent-primary/80 transition-all"
                                />
                                <p className="text-[10px] text-center text-slate-400">Geser untuk memilih detik keberapa yang jadi cover</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={() => { setShowVideoModal(false); setVideoPreviewUrl(null); }}
                                className="flex-1 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => processUpload('video')}
                                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                </div >
            )
            }

            {/* Progress Modal */}
            {
                isUploading && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col items-center gap-4 border border-white/10">
                            <div className="relative size-16 flex items-center justify-center">
                                <svg className="size-full -rotate-90">
                                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-slate-200 dark:text-slate-700" />
                                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-primary transition-all duration-300" strokeDasharray="176" strokeDashoffset={176 - (176 * uploadProgress) / 100} />
                                </svg>
                                <span className="absolute text-sm font-bold text-slate-900 dark:text-white">{uploadProgress}%</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mengupload...</h3>
                            <p className="text-sm text-slate-500 text-center">Mohon tunggu sebentar, kenangan indah sedang disimpan ke Awan.</p>
                        </div>
                    </div>
                )
            }

            <header className="sticky top-0 z-50 w-full border-b border-black/5 dark:border-white/10 bg-surface-light/80 dark:bg-background-dark/80 backdrop-blur-md">
                <div className="w-full max-w-[1440px] mx-auto px-6 md:px-10 lg:px-40 py-3 flex items-center justify-between relative">
                    <div className="flex items-center gap-4 z-10">
                        <div className="size-8 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-3xl">favorite</span>
                        </div>
                        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] dark:text-white text-slate-900">
                            {navItems.find((item) => item.href === pathname)?.name || "Our Space"}
                        </h2>
                    </div>

                    <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <nav className="flex items-center gap-8 lg:gap-12 bg-surface-light/50 dark:bg-background-dark/50 px-6 py-2 rounded-full backdrop-blur-sm border border-slate-200/50 dark:border-white/5">

                            {
                                navItems.map((item) => (
                                    item.children ? (
                                        <div key={item.name} className="relative">
                                            <button
                                                onClick={() => {
                                                    setActiveMenu(activeMenu === item.name ? null : item.name);
                                                }}
                                                className={clsx(
                                                    "flex items-center gap-1 text-sm leading-normal transition-all duration-300 font-medium",
                                                    activeMenu === item.name
                                                        ? "text-primary scale-105"
                                                        : "text-slate-600 dark:text-slate-300 hover:text-primary hover:scale-105"
                                                )}
                                            >
                                                {item.name}
                                                <span className={clsx(
                                                    "material-symbols-outlined text-[18px] transition-transform duration-200",
                                                    activeMenu === item.name ? "rotate-180" : ""
                                                )}>expand_more</span>
                                            </button>
                                            <div className={clsx(
                                                "absolute top-full right-0 pt-2 w-48 transition-all duration-200 transform origin-top-right",
                                                activeMenu === item.name
                                                    ? "opacity-100 visible translate-y-0"
                                                    : "opacity-0 invisible -translate-y-2 pointer-events-none"
                                            )}>
                                                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-slate-100 dark:border-white/10 overflow-hidden p-1">
                                                    {item.children.map((child) => (
                                                        <Link
                                                            key={child.href}
                                                            href={child.href}
                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
                                                            onClick={() => setActiveMenu(null)}
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">{child.icon}</span>
                                                            {child.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={clsx(
                                                "text-sm leading-normal transition-all duration-300",
                                                pathname === item.href
                                                    ? "font-bold text-primary scale-105"
                                                    : "font-medium text-slate-600 dark:text-slate-300 hover:text-primary hover:scale-105"
                                            )}
                                        >
                                            {item.name}
                                        </Link>
                                    )
                                ))
                            }

                        </nav>
                    </div>

                    <div className="flex items-center gap-4 z-10">
                        {/* Upload Buttons based on Path */}
                        {pathname === "/gallery" && (
                            <label className="flex items-center justify-center rounded-lg w-9 h-9 bg-primary hover:bg-primary/90 text-white transition-all shadow-lg shadow-primary/20 cursor-pointer active:scale-95" title="Upload Foto">
                                <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => onFileSelect(e, 'image')} />
                            </label>
                        )}
                        {pathname === "/video" && (
                            <label className="flex items-center justify-center rounded-lg w-9 h-9 bg-primary hover:bg-primary/90 text-white transition-all shadow-lg shadow-primary/20 cursor-pointer active:scale-95" title="Upload Vidio">
                                <span className="material-symbols-outlined text-[20px]">video_call</span>
                                <input type="file" accept="video/*" className="hidden" ref={videoInputRef} onChange={(e) => onFileSelect(e, 'video')} />
                            </label>
                        )}

                        <button
                            onClick={handleLogout}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-xs transition-colors shadow-lg shadow-green-500/20"
                            title="Keluar / Logout"
                        >
                            <span className="material-symbols-outlined text-lg">logout</span>
                            <span>Keluar</span>
                        </button>

                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-slate-900 dark:text-white z-20">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                    </div>
                </div >
            </header >

            {/* Mobile Menu Drawer - Moved Outside Header */}
            < div className={
                clsx(
                    "fixed inset-0 z-[100] md:hidden transition-all duration-300",
                    isMenuOpen ? "visible pointer-events-auto" : "invisible pointer-events-none"
                )
            } >
                {/* Backdrop */}
                < div
                    className={
                        clsx(
                            "absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300",
                            isMenuOpen ? "opacity-100" : "opacity-0"
                        )
                    }
                    onClick={() => setIsMenuOpen(false)
                    }
                />

                {/* Drawer */}
                <div className={clsx(
                    "absolute top-0 right-0 bottom-0 w-[280px] md:w-[320px] !bg-white dark:!bg-zinc-950 border-l border-gray-200 dark:border-white/10 shadow-2xl p-6 flex flex-col gap-6 transition-transform duration-300 ease-out z-[110] overflow-y-auto",
                    "text-slate-900 dark:text-white", // Default text color
                    isMenuOpen ? "translate-x-0" : "translate-x-full"
                )}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Menu</h3>
                        <button
                            onClick={() => setIsMenuOpen(false)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors text-slate-600 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-2">
                        {navItems.map((item) => (
                            item.children ? (
                                <div key={item.name} className="flex flex-col gap-1">
                                    <button
                                        onClick={() => setActiveMenu(activeMenu === item.name ? null : item.name)}
                                        className={clsx(
                                            "flex items-center justify-between px-4 py-3 rounded-xl text-base font-bold transition-all duration-200",
                                            activeMenu === item.name
                                                ? "bg-slate-100 dark:bg-white/10 text-primary"
                                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                        )}
                                    >
                                        <span className="uppercase tracking-wider text-xs">{item.name}</span>
                                        <span className={clsx(
                                            "material-symbols-outlined text-[20px] transition-transform duration-200",
                                            activeMenu === item.name ? "rotate-180" : ""
                                        )}>expand_more</span>
                                    </button>

                                    <div className={clsx(
                                        "flex flex-col gap-1 pl-4 overflow-hidden transition-all duration-300 ease-in-out",
                                        activeMenu === item.name ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
                                    )}>
                                        {item.children.map((child) => (
                                            <Link
                                                key={child.href}
                                                href={child.href}
                                                className={clsx(
                                                    "flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200",
                                                    pathname === child.href
                                                        ? "bg-primary text-white font-bold shadow-lg shadow-primary/30"
                                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                                                )}
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">{child.icon}</span>
                                                {child.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={clsx(
                                        "px-4 py-3.5 rounded-xl text-base font-medium transition-all duration-200",
                                        pathname === item.href
                                            ? "bg-primary text-white font-bold shadow-lg shadow-primary/30"
                                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 active:bg-slate-200 dark:active:bg-white/10"
                                    )}
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {item.name}
                                </Link>
                            )
                        ))}
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/10">
                        <button
                            onClick={() => { setIsMenuOpen(false); handleLogout(); }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm transition-colors"
                        >
                            <span className="material-symbols-outlined text-lg">logout</span>
                            Keluar
                        </button>
                    </div>
                </div>
            </div >
        </>
    );
}

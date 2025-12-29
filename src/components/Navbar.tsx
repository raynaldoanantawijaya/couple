"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

export default function Navbar() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Video Preview State
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
    const [videoDuration, setVideoDuration] = useState(0);
    const [coverTime, setCoverTime] = useState(0);
    const [showVideoModal, setShowVideoModal] = useState(false);

    if (pathname === "/") return null;

    const navItems = [
        { name: "Beranda", href: "/beranda" },
        { name: "Galeri", href: "/gallery" },
        { name: "Vidio", href: "/video" },
        { name: "Visi Misi", href: "/visi-misi" },
        { name: "Tabungan", href: "/tabungan" },
        { name: "Project", href: "/project" },
    ];

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        if (!e.target.files?.[0]) return;
        const file = e.target.files[0];

        if (type === 'video') {
            const url = URL.createObjectURL(file);
            setVideoFile(file);
            setVideoPreviewUrl(url);
            setCoverTime(0); // Reset time
            setShowVideoModal(true);
            // Reset input value so same file can be selected again if cancelled
            e.target.value = "";
        } else {
            // Direct upload for images
            processUpload(file, 'image');
        }
    };

    const processUpload = async (file: File, type: 'image' | 'video', timestamp: number = 0) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "our_space_upload");
        formData.append("tags", type === 'image' ? 'gallery' : 'video');

        setIsUploading(true);
        setUploadProgress(0);
        setShowVideoModal(false); // Close modal if open

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/dtpskj8gv/${type}/upload`);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            setIsUploading(false);
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);

                // Construct Thumbnail URL with offset if video
                const thumbnailParams = type === 'video'
                    ? `so_${timestamp},w_400,h_250,c_fill`
                    : `w_400,h_250,c_fill`;

                const imageUrl = type === 'image'
                    ? data.secure_url
                    : `https://res.cloudinary.com/dtpskj8gv/video/upload/${thumbnailParams}/${data.public_id}.jpg`;

                const newItem = {
                    title: "Uploaded " + (type === 'image' ? 'Foto' : 'Vidio'),
                    date: new Date().toLocaleDateString(),
                    tag: "Upload",
                    img: imageUrl,
                    videoUrl: type === 'video' ? data.secure_url : undefined,
                    duration: type === 'video' ? formatDuration(videoDuration || 0) : undefined // Use preview duration if available
                };

                const storageKey = type === 'image' ? 'uploaded_gallery_items' : 'uploaded_video_items';
                const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
                localStorage.setItem(storageKey, JSON.stringify([newItem, ...existing]));

                alert(`Upload berhasil!`);
                window.location.reload();
            } else {
                console.error("Upload failed", xhr.responseText);
                alert("Upload gagal.");
            }
        };

        xhr.onerror = () => {
            setIsUploading(false);
            alert("Terjadi kesalahan jaringan.");
        };

        xhr.send(formData);
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    return (
        <>
            {/* Video Cover Selection Modal */}
            {showVideoModal && videoPreviewUrl && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 border border-white/10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pilih Cover Vidio</h3>

                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden grid place-items-center">
                            <video
                                src={videoPreviewUrl}
                                className="w-full h-full object-contain"
                                onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                                key={videoPreviewUrl} // Force reload if url changes
                                ref={(el) => { if (el) el.currentTime = coverTime; }} // Sync current time
                                muted // Mute for preview
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs text-slate-500 font-medium">
                                <span>{formatDuration(coverTime)}</span>
                                <span>{formatDuration(videoDuration)}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max={videoDuration || 100}
                                step="0.1"
                                value={coverTime}
                                onChange={(e) => setCoverTime(parseFloat(e.target.value))}
                                className="w-full accent-primary h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                            />
                            <p className="text-xs text-center text-slate-400">Geser slider untuk memilih tampilan cover yang pas</p>
                        </div>

                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={() => { setShowVideoModal(false); setVideoPreviewUrl(null); }}
                                className="flex-1 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => videoFile && processUpload(videoFile, 'video', coverTime)}
                                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
                            >
                                Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Modal */}
            {isUploading && (
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
                        <p className="text-sm text-slate-500 text-center">Mohon tunggu sebentar, kenangan indah sedang disimpan.</p>
                    </div>
                </div>
            )}

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
                            {navItems.map((item) => (
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
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4 z-10">
                        {/* Upload Buttons based on Path */}
                        {pathname === "/gallery" && (
                            <label className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all shadow-lg shadow-primary/20 cursor-pointer active:scale-95">
                                <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
                                <span className="hidden sm:inline">Upload Foto</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelect(e, 'image')} />
                            </label>
                        )}
                        {pathname === "/video" && (
                            <label className="flex items-center justify-center gap-2 rounded-lg h-9 px-4 bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all shadow-lg shadow-primary/20 cursor-pointer active:scale-95">
                                <span className="material-symbols-outlined text-[20px]">video_call</span>
                                <span className="hidden sm:inline">Upload Vidio</span>
                                <input type="file" accept="video/*" className="hidden" onChange={(e) => onFileSelect(e, 'video')} />
                            </label>
                        )}

                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-slate-900 dark:text-white z-20">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                    </div>
                </div>
                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="md:hidden px-6 py-4 bg-surface-light dark:bg-background-dark border-b border-white/10 flex flex-col gap-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={clsx(
                                    pathname === item.href ? "text-primary font-bold" : "hover:text-primary dark:text-slate-300"
                                )}
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>
                )}
            </header>
        </>
    );
}

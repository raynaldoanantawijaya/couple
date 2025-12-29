"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function VisiMisiPage() {
    const [visi, setVisi] = useState("");
    const [misi, setMisi] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const docRef = doc(db, "content", "visi_misi");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setVisi(data.visi || "");
                    setMisi(data.misi || "");
                } else {
                    // Set default values if no data exists
                    setVisi("Kami percaya bahwa hubungan yang sehat adalah tentang pertumbuhan. Tumbuh sebagai individu, namun selalu kembali ke satu sama lain sebagai rumah. Visi kami adalah menciptakan kehidupan yang penuh makna, saling menginspirasi dalam karir, spiritualitas, dan kebahagiaan sederhana.");
                    setMisi("Pilar-pilar yang menjaga hubungan kami tetap kokoh. Selalu menyediakan waktu 15 menit setiap malam untuk 'Deep Talk' tanpa gadget. Menyelesaikan konflik dengan kepala dingin sebelum tidur. Menjadi supporter utama karir pasangan. Merayakan pencapaian kecil dan memberikan bahu saat masa sulit. Merencanakan satu perjalanan besar setiap tahun untuk menciptakan kenangan baru dan keluar dari zona nyaman. Saling mengingatkan untuk beribadah dan menjaga kesehatan mental dengan hobi masing-masing.");
                }
            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, "content", "visi_misi"), {
                visi,
                misi
            });
            alert("Visi & Misi berhasil disimpan!");
        } catch (error) {
            console.error("Error saving data: ", error);
            alert("Gagal menyimpan data.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white overflow-x-hidden min-h-screen flex flex-col">

            <main className="flex-grow w-full max-w-[1440px] mx-auto flex flex-col items-center">
                <section className="w-full px-4 md:px-10 lg:px-40 py-8 md:py-12">
                    <div className="relative w-full min-h-[300px] flex flex-col items-center justify-center rounded-2xl overflow-hidden bg-cover bg-center shadow-2xl"
                        style={{ backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(34, 16, 22, 0.9) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuD8xrHpmhfXCo1oZqSBz7ikLdQg0-D96wM7mpIotB66K28Wubizy8kMXgLlEeA-YB0w38tKRzofoBkvatWS6CC7N6CqxEtKYiinr2nSASjSG4_zjijtVhZxHbq_0DeSglrxm2uMuNyubMOv3soXxfd6FUDjgpbe5etVsGSaMGk9K9aWkUH3njDMbUArmNhRkhNdAYYR1TuDB4ZplGrMFpO0RhtxF7PlQYEzeoRNlSWANKwawnfk4IT-_3Jfp6smjRc0vgybPkmi5_o")' }}>
                        <div className="relative z-10 flex flex-col gap-4 text-center max-w-3xl px-4 animate-fade-in-up">
                            <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 w-fit mx-auto">
                                <span className="material-symbols-outlined text-primary text-sm">stars</span>
                                <span className="text-xs font-semibold text-white uppercase tracking-wider">Manifesto Cinta</span>
                            </div>
                            <h1 className="text-white text-4xl md:text-6xl font-black leading-tight tracking-tight drop-shadow-lg">
                                Visi &amp; Misi <span className="text-primary">Cinta Kita</span>
                            </h1>
                            <p className="text-slate-200 text-lg md:text-xl font-light leading-relaxed max-w-2xl mx-auto">
                                &quot;Membangun rumah bukan hanya dari batu bata, tapi dari kepercayaan, tawa, dan impian yang kita rajut bersama setiap hari.&quot;
                            </p>
                        </div>
                    </div>
                </section>

                <section className="w-full px-6 md:px-10 lg:px-40 py-12 md:py-16 -mt-10 md:-mt-16 relative z-20">
                    <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                        {/* Visi Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-8">
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-xl rounded-2xl p-6 md:p-8 flex flex-col h-full">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">Pengisian Visi</h2>
                                <textarea
                                    className="w-full flex-grow p-4 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-background-dark/50 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-primary focus:border-primary transition-colors resize-y text-base leading-relaxed min-h-[12rem]"
                                    placeholder="Tuliskan visi Anda di sini..."
                                    value={visi}
                                    onChange={(e) => setVisi(e.target.value)}
                                />
                            </div>
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-xl rounded-2xl p-6 md:p-8 flex flex-col items-start h-full">
                                <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-primary text-3xl">volunteer_activism</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Rangkuman Visi</h2>
                                <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed flex-grow whitespace-pre-wrap">
                                    {visi || "Belum ada visi yang ditulis."}
                                </p>
                                <div className="h-1 w-20 bg-primary/50 rounded-full mt-4"></div>
                            </div>
                        </div>

                        {/* Misi Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-8">
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-xl rounded-2xl p-6 md:p-8 flex flex-col h-full">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">Pengisian Misi</h2>
                                <textarea
                                    className="w-full flex-grow p-4 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-background-dark/50 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-primary focus:border-primary transition-colors resize-y text-base leading-relaxed min-h-[16rem]"
                                    placeholder="Tuliskan misi Anda di sini..."
                                    value={misi}
                                    onChange={(e) => setMisi(e.target.value)}
                                />
                            </div>
                            <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-xl rounded-2xl p-6 md:p-8 flex flex-col items-start h-full">
                                <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-primary text-3xl">rocket_launch</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Rangkuman Misi</h2>
                                <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed flex-grow whitespace-pre-wrap">
                                    {misi || "Belum ada misi yang ditulis."}
                                </p>
                                <div className="h-1 w-20 bg-primary/50 rounded-full mt-4"></div>
                            </div>
                        </div>

                        <div className="w-full pt-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                                className="group flex items-center justify-center gap-2 h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all shadow-[0_0_20px_rgba(236,19,91,0.3)] hover:shadow-[0_0_30px_rgba(236,19,91,0.5)] w-full md:w-fit mx-auto disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span className={`material-symbols-outlined text-[20px] ${isSaving ? 'animate-spin' : 'group-hover:scale-110'} transition-transform`}>
                                    {isSaving ? 'sync' : 'save'}
                                </span>
                                <span>{isSaving ? 'Saving...' : 'Save All'}</span>
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

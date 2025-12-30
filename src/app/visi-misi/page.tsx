"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function VisiMisiPage() {
    const [visi, setVisi] = useState("");
    const [misi, setMisi] = useState<string[]>([]);

    // Edit Buffer State
    const [editVisi, setEditVisi] = useState("");
    const [editMisi, setEditMisi] = useState<string[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const docRef = doc(db, "content", "visi_misi");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setVisi(Array.isArray(data.visi) ? data.visi.join(". ") : (data.visi || ""));

                    if (Array.isArray(data.misi)) {
                        setMisi(data.misi);
                    } else if (data.misi) {
                        // Legacy support: split string by periods or newlines
                        const raw = data.misi as string;
                        const split = raw.split(/\.|\n/).map(s => s.trim()).filter(s => s.length > 5);
                        setMisi(split.length > 0 ? split : [raw]);
                    } else {
                        setMisi([]);
                    }
                } else {
                    setVisi("Membangun hubungan yang bertumbuh...");
                    setMisi([
                        "Selalu menyediakan waktu 15 menit setiap malam untuk 'Deep Talk' tanpa gadget.",
                        "Menyelesaikan konflik dengan kepala dingin sebelum tidur.",
                        "Menjadi supporter utama karir pasangan.",
                        "Merayakan pencapaian kecil dan memberikan bahu saat masa sulit.",
                        "Merencanakan satu perjalanan besar setiap tahun."
                    ]);
                }
            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const openModal = () => {
        setEditVisi(visi);
        setEditMisi([...misi]); // Copy array
        setIsModalOpen(true);
    };

    const handleAddMisi = () => {
        setEditMisi([...editMisi, ""]);
    };

    const handleRemoveMisi = (index: number) => {
        const newMisi = [...editMisi];
        newMisi.splice(index, 1);
        setEditMisi(newMisi);
    };

    const handleMisiChange = (index: number, value: string) => {
        const newMisi = [...editMisi];
        newMisi[index] = value;
        setEditMisi(newMisi);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Filter out empty lines
            const finalMisi = editMisi.map(s => s.trim()).filter(s => s.length > 0);

            await setDoc(doc(db, "content", "visi_misi"), {
                visi: editVisi,
                misi: finalMisi
            });
            setVisi(editVisi);
            setMisi(finalMisi);
            setIsModalOpen(false);
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

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface-light dark:bg-surface-dark w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-surface-light dark:bg-background-dark">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">edit_note</span>
                                Edit Visi & Misi
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-8 flex-1">
                            {/* Visi Input */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-lg">volunteer_activism</span>
                                    Visi Relationship
                                </label>
                                <textarea
                                    className="w-full p-4 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-primary focus:border-primary transition-colors min-h-[120px] resize-y"
                                    placeholder="Tuliskan visi Anda di sini..."
                                    value={editVisi}
                                    onChange={(e) => setEditVisi(e.target.value)}
                                />
                            </div>

                            {/* Misi Input (Dynamic List) */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-lg">rocket_launch</span>
                                        Misi Relationship (Poin)
                                    </label>
                                    <button onClick={handleAddMisi} className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                        <span className="material-symbols-outlined text-base">add</span>
                                        Tambah Poin
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {editMisi.map((item, index) => (
                                        <div key={index} className="flex items-start gap-2 animate-fade-in-up">
                                            <div className="size-8 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-full text-xs font-bold text-slate-400 mt-1 flex-shrink-0">
                                                {index + 1}
                                            </div>
                                            <textarea
                                                className="flex-grow p-3 text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-primary focus:border-primary transition-colors min-h-[60px] resize-none"
                                                placeholder={`Misi poin ke-${index + 1}...`}
                                                value={item}
                                                onChange={(e) => handleMisiChange(index, e.target.value)}
                                            />
                                            <button
                                                onClick={() => handleRemoveMisi(index)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors mt-1"
                                                title="Hapus poin ini"
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                    {editMisi.length === 0 && (
                                        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                                            <p className="text-sm text-slate-400">Belum ada poin misi.</p>
                                            <button onClick={handleAddMisi} className="mt-2 text-sm font-bold text-primary hover:underline">Tambah Poin Sekarang</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-background-dark/50 flex justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? (<span className="material-symbols-outlined animate-spin text-sm">sync</span>) : (<span className="material-symbols-outlined text-sm">save</span>)}
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-grow w-full max-w-[1440px] mx-auto flex flex-col items-center">
                <section className="w-full px-4 md:px-10 lg:px-40 py-8 md:py-12">
                    <div className="relative w-full min-h-[300px] flex flex-col items-center justify-center rounded-2xl overflow-hidden bg-cover bg-center shadow-2xl group"
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

                        {/* Floating Edit Button */}
                        <button
                            onClick={openModal}
                            className="absolute top-6 right-6 z-20 size-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all shadow-lg group-hover:scale-110 active:scale-95"
                            title="Edit Visi Misi"
                        >
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                </section>

                <section className="w-full px-6 md:px-10 lg:px-40 py-12 md:py-16 -mt-10 md:-mt-16 relative z-20">
                    <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                        {/* Visi Section */}
                        <div className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-xl rounded-2xl p-8 md:p-10 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-primary text-4xl">volunteer_activism</span>
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">Visi Relationship</h2>
                            <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed whitespace-pre-wrap max-w-4xl italic">
                                &quot;{visi || (isLoading ? "Memuat visi..." : "Belum ada visi yang ditulis.")}&quot;
                            </p>
                        </div>

                        {/* Misi Section - GRID LAYOUT */}
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4 px-2">
                                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-2xl">rocket_launch</span>
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Misi Relationship</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {isLoading ? (
                                    [1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse"></div>)
                                ) : misi.length > 0 ? (
                                    misi.map((item, index) => (
                                        <div key={index} className="bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-white/5 shadow-lg hover:shadow-xl transition-shadow rounded-2xl p-6 flex flex-col relative group">
                                            <div className="absolute top-4 right-5 text-4xl font-black text-slate-200 dark:text-white/10 pointer-events-none select-none">
                                                {index + 1}
                                            </div>
                                            <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed relative z-10 pr-8">
                                                {item}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl">
                                        <p className="text-slate-400">Belum ada misi yang ditulis.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </section>
            </main>
        </div>
    );
}

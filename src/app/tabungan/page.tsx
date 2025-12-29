"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Transaction {
    id: string;
    amount: number;
    description: string;
    contributor: "Kamu" | "Pasangan";
    date: Date;
    type: "in" | "out";
    goalId: string; // Linked to a specific goal
}

interface SavingsGoal {
    id: string;
    title: string;
    targetAmount: number;
    icon: string;
    color: string; // hex or tailwind class
    description?: string;
}

export default function TabunganPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Selected Goal for Filtering (null = Show All)
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

    // Modals
    const [showAddTxModal, setShowAddTxModal] = useState(false);
    const [showAddGoalModal, setShowAddGoalModal] = useState(false);

    // Form States - Transaction
    const [txAmount, setTxAmount] = useState("");
    const [txDesc, setTxDesc] = useState("");
    const [txContributor, setTxContributor] = useState<"Kamu" | "Pasangan">("Kamu");
    const [txGoalId, setTxGoalId] = useState("");

    // Form States - Goal
    const [goalTitle, setGoalTitle] = useState("");
    const [goalTarget, setGoalTarget] = useState("");
    const [goalIcon, setGoalIcon] = useState("savings");

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // 1. Subscribe to Goals
        const qGoals = query(collection(db, "savings_goals"));
        const unsubGoals = onSnapshot(qGoals, (snapshot) => {
            const fetchedGoals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SavingsGoal[];
            setGoals(fetchedGoals);

            // If we have goals but none selected, maybe select the first one? Or keep null for "summary".
            // Let's keep null for "Summary View".
        });

        // 2. Subscribe to Transactions
        const qTrans = query(collection(db, "savings_transactions"), orderBy("date", "desc"));
        const unsubTrans = onSnapshot(qTrans, (snapshot) => {
            const trans = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate() || new Date()
            })) as Transaction[];
            setTransactions(trans);
            setIsLoading(false);
        });

        return () => {
            unsubGoals();
            unsubTrans();
        };
    }, []);

    // Derived Stats
    const stats = useMemo(() => {
        // Filter transactions if a goal is selected
        const relevantTrans = selectedGoalId
            ? transactions.filter(t => t.goalId === selectedGoalId)
            : transactions;

        const totalSaved = relevantTrans.reduce((acc, curr) => acc + curr.amount, 0);

        let targetAmount = 0;
        if (selectedGoalId) {
            targetAmount = goals.find(g => g.id === selectedGoalId)?.targetAmount || 0;
        } else {
            targetAmount = goals.reduce((acc, curr) => acc + curr.targetAmount, 0);
        }

        const progress = targetAmount > 0 ? Math.min(Math.round((totalSaved / targetAmount) * 100), 100) : 0;
        const remaining = Math.max(targetAmount - totalSaved, 0);

        return { totalSaved, targetAmount, progress, remaining, relevantTrans };
    }, [transactions, goals, selectedGoalId]);

    // Handle Adding New Goal
    const handleAddGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "savings_goals"), {
                title: goalTitle,
                targetAmount: parseInt(goalTarget.replace(/\D/g, "")),
                icon: goalIcon,
                color: "primary", // Default for now
                createdAt: Timestamp.now()
            });
            setShowAddGoalModal(false);
            setGoalTitle("");
            setGoalTarget("");
            setGoalIcon("savings");
            alert("Pos tabungan baru berhasil dibuat!");
        } catch (error) {
            console.error(error);
            alert("Gagal membuat pos tabungan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Adding Transaction
    const handleAddTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!txAmount || !txDesc || !txGoalId) return;
        setIsSubmitting(true);

        try {
            await addDoc(collection(db, "savings_transactions"), {
                amount: parseInt(txAmount.replace(/\D/g, "")),
                description: txDesc,
                contributor: txContributor,
                goalId: txGoalId,
                date: Timestamp.now(),
                type: "in"
            });
            setShowAddTxModal(false);
            setTxAmount("");
            setTxDesc("");
            // Leave contributor and goalId as is for convenience
            alert("Uang berhasil ditabung!");
        } catch (error) {
            console.error(error);
            alert("Gagal menyimpan transaksi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!confirm("Hapus riwayat ini? Saldo akan berkurang.")) return;
        try {
            await deleteDoc(doc(db, "savings_transactions", id));
        } catch (e) {
            console.error(e);
        }
    };

    // Helper: Delete Goal
    const handleDeleteGoal = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Hapus pos tabungan ini?")) return;
        try {
            await deleteDoc(doc(db, "savings_goals", id));
        } catch (error) {
            console.error(error);
            alert("Gagal menghapus pos.");
        }
    };

    // Helper: Calculate progress for a specific goal card
    const getGoalProgress = (goalId: string, target: number) => {
        const goalSaved = transactions
            .filter(t => t.goalId === goalId)
            .reduce((acc, curr) => acc + curr.amount, 0);
        const percent = target > 0 ? Math.min(Math.round((goalSaved / target) * 100), 100) : 0;
        return { saved: goalSaved, percent };
    };

    const formatRupiah = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
    const handleNumInput = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => setter(e.target.value.replace(/\D/g, ""));

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col">
            <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 md:px-10 lg:px-40 py-8 md:py-12 flex flex-col gap-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Dompet Impian Kita</h1>
                        <p className="text-slate-500 dark:text-[#c992a4]">Kelola berbagai pos tabungan untuk masa depan.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowAddGoalModal(true)}
                            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/10 font-bold text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                            + Pos Baru
                        </button>
                        <button
                            onClick={() => {
                                // If inside a specific goal view, pre-select that goal
                                if (selectedGoalId) setTxGoalId(selectedGoalId);
                                setShowAddTxModal(true);
                            }}
                            className="px-6 py-2 rounded-lg bg-primary text-white font-bold text-sm hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
                        >
                            + Nabung Sekarang
                        </button>
                    </div>
                </div>

                {/* Main Summary Card (Consolidated or Specific Goal) */}
                <div className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-end justify-between">
                        <div className="w-full md:w-auto">
                            <h2 className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">
                                {selectedGoalId ? `Tabungan ${goals.find(g => g.id === selectedGoalId)?.title}` : "Total Aset Tabungan"}
                            </h2>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white">
                                    {formatRupiah(stats.totalSaved)}
                                </span>
                                <span className="text-slate-400 text-lg font-medium">
                                    / {formatRupiah(stats.targetAmount)}
                                </span>
                            </div>
                            <div className="mt-4 w-full max-w-md">
                                <div className="flex justify-between text-xs font-bold mb-1.5">
                                    <span>Progress</span>
                                    <span className={stats.progress >= 100 ? "text-green-500" : "text-primary"}>{stats.progress}%</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${stats.progress >= 100 ? "bg-green-500" : "bg-primary"}`}
                                        style={{ width: `${stats.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Motivation / Stat Chips */}
                        <div className="flex gap-4">
                            <div className="px-4 py-3 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 flex flex-col items-center">
                                <span className="text-xs text-green-600 dark:text-green-400 font-bold">Goal Tercapai</span>
                                <span className="text-xl font-black text-slate-900 dark:text-white">
                                    {goals.filter(g => getGoalProgress(g.id, g.targetAmount).percent >= 100).length}
                                </span>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 flex flex-col items-center">
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">Total Pos</span>
                                <span className="text-xl font-black text-slate-900 dark:text-white">{goals.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs / Filter for Goals */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setSelectedGoalId(null)}
                        className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedGoalId === null
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200"
                            }`}
                    >
                        Semua Pos
                    </button>
                    {goals.map(goal => (
                        <button
                            key={goal.id}
                            onClick={() => setSelectedGoalId(goal.id)}
                            className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${selectedGoalId === goal.id
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200"
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm">{goal.icon}</span>
                            {goal.title}
                        </button>
                    ))}
                </div>

                {/* Content Area: Grid of Goals or Specific Activity */}
                {!selectedGoalId ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {goals.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">savings</span>
                                <p>Belum ada pos tabungan. Buat sekarang!</p>
                            </div>
                        ) : (
                            goals.map(goal => {
                                const p = getGoalProgress(goal.id, goal.targetAmount);
                                return (
                                    <div
                                        key={goal.id}
                                        onClick={() => setSelectedGoalId(goal.id)}
                                        className="group bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-6 rounded-2xl hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        <button
                                            onClick={(e) => handleDeleteGoal(e, goal.id)}
                                            className="absolute top-2 right-2 z-10 size-8 rounded-full bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                            title="Hapus Pos"
                                        >
                                            <span className="material-symbols-outlined text-lg">close</span>
                                        </button>

                                        <div className="flex justify-between items-start mb-4 pr-8">
                                            <div className="size-10 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined">{goal.icon}</span>
                                            </div>
                                            <span className="text-xs font-bold bg-slate-100 dark:bg-black/30 px-2 py-1 rounded text-slate-500">
                                                {p.percent}%
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{goal.title}</h3>
                                        <p className="text-slate-500 text-sm mb-4">Target: {formatRupiah(goal.targetAmount)}</p>

                                        <div className="w-full bg-slate-100 dark:bg-black/20 h-2 rounded-full overflow-hidden">
                                            <div className="bg-primary h-full rounded-full" style={{ width: `${p.percent}%` }}></div>
                                        </div>
                                        <p className="text-xs text-right mt-2 font-mono text-slate-400">
                                            {formatRupiah(p.saved)}
                                        </p>
                                    </div>
                                )
                            })
                        )}

                        {/* Add Goal Card Button */}
                        <button
                            onClick={() => setShowAddGoalModal(true)}
                            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-primary hover:bg-primary/5 transition-all text-slate-400 hover:text-primary"
                        >
                            <div className="size-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl">add</span>
                            </div>
                            <span className="font-bold text-sm">Buat Pos Baru</span>
                        </button>
                    </div>
                ) : (
                    // Detail View for Selected Goal
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                        <div className="lg:col-span-2">
                            <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Riwayat Transaksi</h3>
                                    <span className="text-xs text-slate-400">{stats.relevantTrans.length} Item</span>
                                </div>
                                <div className="p-2 max-h-[500px] overflow-y-auto">
                                    {stats.relevantTrans.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-sm italic">Belum ada transaksi di pos ini.</div>
                                    ) : (
                                        stats.relevantTrans.map(t => (
                                            <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors group">
                                                <div className={`shrink-0 size-10 rounded-full flex items-center justify-center ${t.contributor === 'Kamu' ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}>
                                                    <span className="material-symbols-outlined text-lg">
                                                        {t.contributor === 'Kamu' ? 'person' : 'favorite'}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{t.description}</p>
                                                    <p className="text-xs text-slate-500">{t.date.toLocaleDateString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-green-600 dark:text-green-400">+{formatRupiah(t.amount)}</p>
                                                    <button onClick={() => handleDeleteTransaction(t.id)} className="text-xs text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Hapus</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                                <h4 className="font-bold text-lg mb-2">Info Pos</h4>
                                <p className="text-indigo-100 text-sm mb-4">Tabungan ini dibuat untuk mencapai target {goals.find(g => g.id === selectedGoalId)?.title}.</p>
                                <div className="flex justify-between items-center text-sm border-t border-white/20 pt-4">
                                    <span className="opacity-80">Sisa Target</span>
                                    <span className="font-bold text-xl">{formatRupiah(stats.remaining)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Add Goal Modal */}
            {showAddGoalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Buat Pos Tabungan Baru</h3>
                        </div>
                        <form onSubmit={handleAddGoal} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nama Pos</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: Dana Nikah, Liburan, Gadget"
                                    value={goalTitle}
                                    onChange={e => setGoalTitle(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Target Uang (Rp)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="0"
                                    value={goalTarget ? parseInt(goalTarget).toLocaleString("id-ID") : ""}
                                    onChange={e => handleNumInput(e, setGoalTarget)}
                                    className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Ikon</label>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {["savings", "favorite", "flight", "home", "directions_car", "laptop_mac", "shopping_bag", "child_friendly"].map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setGoalIcon(icon)}
                                            className={`size-10 shrink-0 rounded-full flex items-center justify-center border transition-all ${goalIcon === icon
                                                ? "bg-primary text-white border-primary"
                                                : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-xl">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowAddGoalModal(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 font-bold bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors">
                                    {isSubmitting ? "Wujudkan..." : "Buat Pos"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Transaction Modal */}
            {showAddTxModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Tambah Tabungan</h3>
                        </div>
                        <form onSubmit={handleAddTransaction} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Pilih Pos Tujuan</label>
                                <select
                                    required
                                    value={txGoalId}
                                    onChange={e => setTxGoalId(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none"
                                >
                                    <option value="" disabled>-- Pilih Pos --</option>
                                    {goals.map(g => (
                                        <option key={g.id} value={g.id}>{g.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Jumlah (Rp)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="0"
                                    value={txAmount ? parseInt(txAmount).toLocaleString("id-ID") : ""}
                                    onChange={e => handleNumInput(e, setTxAmount)}
                                    className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Keterangan</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Contoh: Gaji, THR"
                                    value={txDesc}
                                    onChange={e => setTxDesc(e.target.value)}
                                    className="w-full p-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Kontributor</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTxContributor("Kamu")}
                                        className={`flex-1 py-2 rounded-lg font-bold text-sm border transition-colors ${txContributor === "Kamu" ? "bg-primary text-white border-primary" : "bg-transparent text-slate-500 border-slate-200"}`}
                                    >
                                        Kamu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTxContributor("Pasangan")}
                                        className={`flex-1 py-2 rounded-lg font-bold text-sm border transition-colors ${txContributor === "Pasangan" ? "bg-sky-500 text-white border-sky-500" : "bg-transparent text-slate-500 border-slate-200"}`}
                                    >
                                        Pasangan
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setShowAddTxModal(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 font-bold bg-primary text-white rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors">
                                    {isSubmitting ? "Menabung..." : "Simpan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

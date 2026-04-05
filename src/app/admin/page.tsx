"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

interface Trainer {
  id: number;
  name: string;
  role: string;
  active: number;
}

interface ScheduleSlot {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  trainer_id: number;
  trainer_name: string;
}

interface HourEntry {
  id: number;
  trainer_id: number;
  trainer_name: string;
  date: string;
  start_time: string;
  end_time: string;
  type: string;
  substitute_for_name: string | null;
  schedule_id: number | null;
  remark: string;
  status: string;
  reject_reason: string;
}

interface Expense {
  id: number;
  trainer_id: number;
  trainer_name: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  status: string;
  reject_reason: string;
}

type Tab = "dashboard" | "onkosten" | "rooster" | "trainers";

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [hours, setHours] = useState<HourEntry[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectType, setRejectType] = useState<"hour" | "expense">("hour");

  // Trainer form
  const [newTrainer, setNewTrainer] = useState({ name: "", pin: "" });

  // Schedule form
  const [schedForm, setSchedForm] = useState({
    day_of_week: "1",
    start_time: "",
    end_time: "",
    location: "",
    trainer_id: "",
  });

  const loadTrainers = useCallback(async () => {
    const res = await fetch("/api/trainers");
    setTrainers(await res.json());
  }, []);

  const loadSchedule = useCallback(async () => {
    const res = await fetch("/api/schedule");
    setSchedule(await res.json());
  }, []);

  const loadHours = useCallback(async () => {
    const res = await fetch(`/api/hours?month=${month}`);
    setHours(await res.json());
  }, [month]);

  const loadExpenses = useCallback(async () => {
    const res = await fetch(`/api/expenses?month=${month}`);
    setExpenses(await res.json());
  }, [month]);

  useEffect(() => {
    const stored = sessionStorage.getItem("vbsk_user");
    if (!stored) { router.push("/"); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role !== "admin") { router.push("/trainer"); return; }

    loadTrainers();
    loadSchedule();
  }, [router, loadTrainers, loadSchedule]);

  useEffect(() => {
    loadHours();
    loadExpenses();
  }, [loadHours, loadExpenses]);

  async function approveHour(id: number) {
    await fetch("/api/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "goedgekeurd" }),
    });
    loadHours();
  }

  async function rejectItem() {
    if (!rejectId) return;
    const endpoint = rejectType === "hour" ? "/api/hours" : "/api/expenses";
    await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rejectId, status: "afgewezen", reject_reason: rejectReason }),
    });
    setRejectId(null);
    setRejectReason("");
    if (rejectType === "hour") loadHours();
    else loadExpenses();
  }

  async function approveExpense(id: number) {
    await fetch("/api/expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "goedgekeurd" }),
    });
    loadExpenses();
  }

  async function addTrainer(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/trainers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTrainer),
    });
    setNewTrainer({ name: "", pin: "" });
    loadTrainers();
  }

  async function toggleTrainer(id: number, active: number) {
    await fetch("/api/trainers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: active ? 0 : 1 }),
    });
    loadTrainers();
  }

  async function addScheduleSlot(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...schedForm,
        day_of_week: Number(schedForm.day_of_week),
        trainer_id: Number(schedForm.trainer_id),
      }),
    });
    setSchedForm({ day_of_week: "1", start_time: "", end_time: "", location: "", trainer_id: "" });
    loadSchedule();
  }

  async function deleteScheduleSlot(id: number) {
    await fetch("/api/schedule", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadSchedule();
  }

  function logout() {
    sessionStorage.removeItem("vbsk_user");
    router.push("/");
  }

  // Group hours by trainer
  const hoursByTrainer = hours.reduce(
    (acc, h) => {
      if (!acc[h.trainer_name]) acc[h.trainer_name] = [];
      acc[h.trainer_name].push(h);
      return acc;
    },
    {} as Record<string, HourEntry[]>
  );

  const activeTrainers = trainers.filter((t) => t.active && t.role === "trainer");

  const statusColors: Record<string, string> = {
    ingediend: "bg-yellow-100 text-yellow-800",
    goedgekeurd: "bg-green-100 text-green-800",
    afgewezen: "bg-red-100 text-red-800",
  };

  // Detect anomalies: check if hour entry matches schedule
  function getAnomaly(h: HourEntry): string | null {
    if (h.type === "inval") return "Inval";
    if (!h.schedule_id) return "Extra les";
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">VBSK Admin</h1>
          <p className="text-sm text-gray-500">Urenregistratie beheer</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Uitloggen
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {(["dashboard", "onkosten", "rooster", "trainers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {{ dashboard: "Dashboard", onkosten: "Onkosten", rooster: "Rooster", trainers: "Trainers" }[t]}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              Overzicht {month}
            </h2>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          {Object.keys(hoursByTrainer).length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
              Geen uren ingediend voor deze maand
            </div>
          ) : (
            Object.entries(hoursByTrainer).map(([trainerName, entries]) => {
              const trainer = trainers.find((t) => t.name === trainerName);
              return (
                <div key={trainerName} className="bg-white rounded-xl border mb-4">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-gray-900">{trainerName}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {entries.length} {entries.length === 1 ? "invoer" : "invoeren"}
                      </span>
                      {trainer && (
                        <a
                          href={`/api/export?trainer_id=${trainer.id}&month=${month}`}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition"
                        >
                          Excel
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="divide-y">
                    {entries.map((h) => {
                      const anomaly = getAnomaly(h);
                      return (
                        <div key={h.id} className="p-4 flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {h.date} &middot; {h.start_time}-{h.end_time}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[h.status]}`}>
                                {h.status}
                              </span>
                              {anomaly && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium">
                                  {anomaly}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {h.type === "inval"
                                ? `Inval voor ${h.substitute_for_name}`
                                : "Regulier"}
                              {h.remark && ` — ${h.remark}`}
                            </p>
                            {h.status === "afgewezen" && h.reject_reason && (
                              <p className="text-xs text-red-600 mt-0.5">
                                Reden: {h.reject_reason}
                              </p>
                            )}
                          </div>
                          {h.status === "ingediend" && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => approveHour(h.id)}
                                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                              >
                                Goedkeuren
                              </button>
                              <button
                                onClick={() => { setRejectId(h.id); setRejectType("hour"); }}
                                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition"
                              >
                                Afwijzen
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Reject modal */}
          {rejectId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                <h3 className="font-semibold text-gray-900 mb-3">{rejectType === "hour" ? "Uren" : "Onkosten"} afwijzen</h3>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reden van afwijzing..."
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={rejectItem}
                    className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700"
                  >
                    Afwijzen
                  </button>
                  <button
                    onClick={() => { setRejectId(null); setRejectReason(""); }}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Annuleer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Onkosten Tab */}
      {tab === "onkosten" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Onkosten {month}</h2>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          {expenses.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
              Geen onkosten ingediend voor deze maand
            </div>
          ) : (
            (() => {
              const byTrainer = expenses.reduce((acc, e) => {
                if (!acc[e.trainer_name]) acc[e.trainer_name] = [];
                acc[e.trainer_name].push(e);
                return acc;
              }, {} as Record<string, Expense[]>);

              return Object.entries(byTrainer).map(([name, entries]) => (
                <div key={name} className="bg-white rounded-xl border mb-4">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <span className="text-sm text-gray-500">
                      Totaal: &euro;{entries.reduce((s, e) => s + e.amount, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="divide-y">
                    {entries.map((exp) => (
                      <div key={exp.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {exp.date} &middot; &euro;{exp.amount.toFixed(2)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[exp.status]}`}>
                              {exp.status}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                              {exp.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{exp.description}</p>
                          {exp.status === "afgewezen" && exp.reject_reason && (
                            <p className="text-xs text-red-600 mt-0.5">Reden: {exp.reject_reason}</p>
                          )}
                        </div>
                        {exp.status === "ingediend" && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => approveExpense(exp.id)}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                            >
                              Goedkeuren
                            </button>
                            <button
                              onClick={() => { setRejectId(exp.id); setRejectType("expense"); }}
                              className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition"
                            >
                              Afwijzen
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      )}

      {/* Rooster Tab */}
      {tab === "rooster" && (
        <div>
          <div className="bg-white rounded-xl border mb-4">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Weekrooster</h2>
            </div>
            <div className="divide-y">
              {schedule.map((slot) => (
                <div key={slot.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {DAYS[slot.day_of_week]} {slot.start_time}-{slot.end_time}
                    </p>
                    <p className="text-xs text-gray-500">
                      {slot.trainer_name} &middot; {slot.location}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteScheduleSlot(slot.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Verwijderen
                  </button>
                </div>
              ))}
              {schedule.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">Geen roosterslots</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Slot toevoegen</h3>
            <form onSubmit={addScheduleSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Dag</label>
                  <select
                    value={schedForm.day_of_week}
                    onChange={(e) => setSchedForm({ ...schedForm, day_of_week: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Trainer</label>
                  <select
                    value={schedForm.trainer_id}
                    onChange={(e) => setSchedForm({ ...schedForm, trainer_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Kies trainer...</option>
                    {activeTrainers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Begintijd</label>
                  <input
                    type="time"
                    value={schedForm.start_time}
                    onChange={(e) => setSchedForm({ ...schedForm, start_time: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Eindtijd</label>
                  <input
                    type="time"
                    value={schedForm.end_time}
                    onChange={(e) => setSchedForm({ ...schedForm, end_time: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Locatie</label>
                <input
                  type="text"
                  value={schedForm.location}
                  onChange={(e) => setSchedForm({ ...schedForm, location: e.target.value })}
                  placeholder="bijv. Sporthal Noord"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 transition"
              >
                Toevoegen
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Trainers Tab */}
      {tab === "trainers" && (
        <div>
          <div className="bg-white rounded-xl border mb-4">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Trainers</h2>
            </div>
            <div className="divide-y">
              {trainers
                .filter((t) => t.role === "trainer")
                .map((t) => (
                  <div key={t.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className={`font-medium text-sm ${!t.active ? "text-gray-400 line-through" : ""}`}>
                        {t.name}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleTrainer(t.id, t.active)}
                      className={`text-xs px-3 py-1 rounded-lg ${
                        t.active
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      } transition`}
                    >
                      {t.active ? "Deactiveren" : "Activeren"}
                    </button>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Trainer toevoegen</h3>
            <form onSubmit={addTrainer} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Naam</label>
                <input
                  type="text"
                  value={newTrainer.name}
                  onChange={(e) => setNewTrainer({ ...newTrainer, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Pincode (4 cijfers)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={newTrainer.pin}
                  onChange={(e) =>
                    setNewTrainer({ ...newTrainer, pin: e.target.value.replace(/\D/g, "") })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 transition"
              >
                Toevoegen
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

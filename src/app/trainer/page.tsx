"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

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
  date: string;
  start_time: string;
  end_time: string;
  type: string;
  substitute_for_name: string | null;
  remark: string;
  status: string;
  reject_reason: string;
}

interface Expense {
  id: number;
  date: string;
  amount: number;
  category: string;
  description: string;
  status: string;
  reject_reason: string;
}

interface Trainer {
  id: number;
  name: string;
}

export default function TrainerPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; name: string; role: string } | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [hours, setHours] = useState<HourEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    start_time: "",
    end_time: "",
    type: "regulier",
    substitute_for_id: "",
    schedule_id: "",
    remark: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    category: "benzine",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadHours = useCallback(async (userId: number) => {
    const res = await fetch(`/api/hours?trainer_id=${userId}`);
    setHours(await res.json());
  }, []);

  const loadExpenses = useCallback(async (userId: number) => {
    const res = await fetch(`/api/expenses?trainer_id=${userId}`);
    setExpenses(await res.json());
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("vbsk_user");
    if (!stored) { router.push("/"); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role === "admin") { router.push("/admin"); return; }
    setUser(parsed);

    fetch("/api/schedule").then((r) => r.json()).then(setSchedule);
    fetch("/api/trainers").then((r) => r.json()).then((data: Trainer[]) => setTrainers(data));
    loadHours(parsed.id);
    loadExpenses(parsed.id);
  }, [router, loadHours, loadExpenses]);

  function selectSlot(slot: ScheduleSlot) {
    const today = new Date();
    const diff = (slot.day_of_week - today.getDay() + 7) % 7;
    const next = new Date(today);
    next.setDate(today.getDate() + (diff === 0 ? 0 : diff));
    const dateStr = next.toISOString().split("T")[0];

    setForm({
      date: dateStr,
      start_time: slot.start_time,
      end_time: slot.end_time,
      type: slot.trainer_id === user?.id ? "regulier" : "inval",
      substitute_for_id: slot.trainer_id !== user?.id ? String(slot.trainer_id) : "",
      schedule_id: String(slot.id),
      remark: "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    await fetch("/api/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainer_id: user.id,
        ...form,
        substitute_for_id: form.substitute_for_id ? Number(form.substitute_for_id) : null,
        schedule_id: form.schedule_id ? Number(form.schedule_id) : null,
      }),
    });

    setShowForm(false);
    setForm({
      date: new Date().toISOString().split("T")[0],
      start_time: "",
      end_time: "",
      type: "regulier",
      substitute_for_id: "",
      schedule_id: "",
      remark: "",
    });
    setSubmitting(false);
    loadHours(user.id);
  }

  async function handleExpenseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainer_id: user.id,
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
      }),
    });

    setShowExpenseForm(false);
    setExpenseForm({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      category: "benzine",
      description: "",
    });
    setSubmitting(false);
    loadExpenses(user.id);
  }

  function logout() {
    sessionStorage.removeItem("vbsk_user");
    router.push("/");
  }

  if (!user) return null;

  const statusColors: Record<string, string> = {
    ingediend: "bg-yellow-100 text-yellow-800",
    goedgekeurd: "bg-green-100 text-green-800",
    afgewezen: "bg-red-100 text-red-800",
  };

  const categoryLabels: Record<string, string> = {
    benzine: "Benzine",
    materiaal: "Materiaal",
    parkeren: "Parkeren",
    overig: "Overig",
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hoi, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-gray-500">VBSK Urenregistratie</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Uitloggen
        </button>
      </div>

      {/* Weekrooster */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Weekrooster</h2>
        <div className="space-y-2">
          {schedule.map((slot) => (
            <button
              key={slot.id}
              onClick={() => selectSlot(slot)}
              className={`w-full text-left p-3 rounded-lg border transition hover:border-red-300 hover:bg-red-50 ${
                slot.trainer_id === user.id ? "border-red-200 bg-red-50/50" : "border-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">
                  {DAYS[slot.day_of_week]} {slot.start_time}-{slot.end_time}
                </span>
                <span className="text-xs text-gray-500">{slot.location}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {slot.trainer_name}
                {slot.trainer_id === user.id && (
                  <span className="ml-1 text-red-600 font-medium">(jouw les)</span>
                )}
              </p>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-red-400 hover:text-red-600 transition"
        >
          + Handmatig tijdslot toevoegen
        </button>
      </div>

      {/* Invoerformulier uren */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Uren invoeren</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Datum</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Begintijd</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Eindtijd</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="regulier">Regulier</option>
                <option value="inval">Inval</option>
              </select>
            </div>
            {form.type === "inval" && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">Inval voor</label>
                <select
                  value={form.substitute_for_id}
                  onChange={(e) => setForm({ ...form, substitute_for_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Selecteer trainer...</option>
                  {trainers
                    .filter((t) => t.id !== user.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Opmerking (optioneel)</label>
              <textarea
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {submitting ? "Opslaan..." : "Indienen"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Annuleer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ingediende uren */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Mijn uren</h2>
        {hours.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Nog geen uren ingediend</p>
        ) : (
          <div className="space-y-2">
            {hours.map((h) => (
              <div key={h.id} className="p-3 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{h.date} &middot; {h.start_time}-{h.end_time}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {h.type === "inval" ? `Inval voor ${h.substitute_for_name}` : "Regulier"}
                      {h.remark && ` — ${h.remark}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[h.status] || ""}`}>
                    {h.status}
                  </span>
                </div>
                {h.status === "afgewezen" && h.reject_reason && (
                  <p className="text-xs text-red-600 mt-1">Reden: {h.reject_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Onkosten sectie */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Onkosten</h2>
          <button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
          >
            + Toevoegen
          </button>
        </div>

        {showExpenseForm && (
          <form onSubmit={handleExpenseSubmit} className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Datum</label>
              <input
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Bedrag (&euro;)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Categorie</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="benzine">Benzine</option>
                  <option value="materiaal">Materiaal</option>
                  <option value="parkeren">Parkeren</option>
                  <option value="overig">Overig</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Omschrijving</label>
              <input
                type="text"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="bijv. Reiskosten heen en terug"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {submitting ? "Opslaan..." : "Indienen"}
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Annuleer
              </button>
            </div>
          </form>
        )}

        {expenses.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Nog geen onkosten ingediend</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((exp) => (
              <div key={exp.id} className="p-3 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">
                      {exp.date} &middot; &euro;{exp.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {categoryLabels[exp.category] || exp.category} — {exp.description}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[exp.status] || ""}`}>
                    {exp.status}
                  </span>
                </div>
                {exp.status === "afgewezen" && exp.reject_reason && (
                  <p className="text-xs text-red-600 mt-1">Reden: {exp.reject_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

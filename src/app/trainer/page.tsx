"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

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

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
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

  // Build set of days-of-week where this trainer has scheduled slots
  const myScheduleDays = useMemo(() => {
    if (!user) return new Set<number>();
    return new Set(schedule.filter((s) => s.trainer_id === user.id).map((s) => s.day_of_week));
  }, [schedule, user]);

  // Build map of dates with submitted hours
  const hoursByDate = useMemo(() => {
    const map: Record<string, HourEntry[]> = {};
    for (const h of hours) {
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push(h);
    }
    return map;
  }, [hours]);

  // Get slots for a specific date
  function getSlotsForDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const dow = d.getDay();
    return schedule.filter((s) => s.day_of_week === dow);
  }

  function selectDateSlot(dateStr: string, slot: ScheduleSlot) {
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

  function openManualForm(dateStr: string) {
    setForm({
      date: dateStr,
      start_time: "",
      end_time: "",
      type: "regulier",
      substitute_for_id: "",
      schedule_id: "",
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

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
    setSelectedDate(null);
  }

  function logout() {
    sessionStorage.removeItem("vbsk_user");
    router.push("/");
  }

  if (!user) return null;

  const days = getMonthDays(calYear, calMonth);
  const todayStr = formatDate(new Date());

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

  const selectedSlots = selectedDate ? getSlotsForDate(selectedDate) : [];
  const selectedHours = selectedDate ? (hoursByDate[selectedDate] || []) : [];

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

      {/* Maandkalender */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-semibold text-gray-900">
            {MONTH_NAMES[calMonth]} {calYear}
          </h2>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;

            const dateStr = formatDate(day);
            const dow = day.getDay();
            const isWorkDay = myScheduleDays.has(dow);
            const hasHours = !!hoursByDate[dateStr];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition
                  ${isSelected ? "ring-2 ring-red-500" : ""}
                  ${isToday ? "font-bold" : ""}
                  ${isWorkDay && !hasHours ? "bg-red-50 text-red-700 hover:bg-red-100" : ""}
                  ${hasHours ? "bg-red-600 text-white hover:bg-red-700" : ""}
                  ${!isWorkDay && !hasHours ? "text-gray-400 hover:bg-gray-50" : ""}
                `}
              >
                {day.getDate()}
                {isWorkDay && !hasHours && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-red-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-600" />
            <span className="text-xs text-gray-500">Uren ingediend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
            <span className="text-xs text-gray-500">Werkdag (rooster)</span>
          </div>
        </div>
      </div>

      {/* Geselecteerde dag detail */}
      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("nl-NL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>

          {/* Roosterslots voor deze dag */}
          {selectedSlots.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Rooster</p>
              <div className="space-y-1.5">
                {selectedSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => selectDateSlot(selectedDate, slot)}
                    className={`w-full text-left p-2.5 rounded-lg border transition hover:border-red-300 hover:bg-red-50 ${
                      slot.trainer_id === user.id ? "border-red-200 bg-red-50/50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">
                        {slot.start_time}-{slot.end_time}
                      </span>
                      <span className="text-xs text-gray-500">{slot.trainer_name}</span>
                    </div>
                    {slot.trainer_id === user.id && (
                      <span className="text-xs text-red-600 font-medium">Jouw les</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ingediende uren voor deze dag */}
          {selectedHours.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Ingediend</p>
              <div className="space-y-1.5">
                {selectedHours.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{h.start_time}-{h.end_time}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[h.status] || ""}`}>
                        {h.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {h.type === "inval" ? `Inval voor ${h.substitute_for_name}` : "Regulier"}
                      {h.remark && ` — ${h.remark}`}
                    </p>
                    {h.status === "afgewezen" && h.reject_reason && (
                      <p className="text-xs text-red-600 mt-0.5">Reden: {h.reject_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => openManualForm(selectedDate)}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-red-400 hover:text-red-600 transition"
          >
            + Uren toevoegen voor deze dag
          </button>
        </div>
      )}

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

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type Lang, tr } from "@/lib/translations";

const DAY_LABELS_NL = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES_NL = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];
const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
  const [lang, setLang] = useState<Lang>("nl");
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

  const _ = useCallback((key: Parameters<typeof tr>[0]) => tr(key, lang), [lang]);

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

    // Restore language preference
    const savedLang = localStorage.getItem("vbsk_lang");
    if (savedLang === "en" || savedLang === "nl") setLang(savedLang);

    fetch("/api/schedule").then((r) => r.json()).then(setSchedule);
    fetch("/api/trainers").then((r) => r.json()).then((data: Trainer[]) => setTrainers(data));
    loadHours(parsed.id);
    loadExpenses(parsed.id);
  }, [router, loadHours, loadExpenses]);

  function toggleLang() {
    const next = lang === "nl" ? "en" : "nl";
    setLang(next);
    localStorage.setItem("vbsk_lang", next);
  }

  const myScheduleDays = useMemo(() => {
    if (!user) return new Set<number>();
    return new Set(schedule.filter((s) => s.trainer_id === user.id).map((s) => s.day_of_week));
  }, [schedule, user]);

  const hoursByDate = useMemo(() => {
    const map: Record<string, HourEntry[]> = {};
    for (const h of hours) {
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push(h);
    }
    return map;
  }, [hours]);

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

  // Translated helpers
  function statusLabel(status: string) {
    if (status === "ingediend") return _("ingediend");
    if (status === "goedgekeurd") return _("goedgekeurd");
    if (status === "afgewezen") return _("afgewezen");
    return status;
  }

  function catLabel(cat: string) {
    const map: Record<string, Parameters<typeof tr>[0]> = {
      benzine: "cat_benzine",
      materiaal: "cat_materiaal",
      parkeren: "cat_parkeren",
      overig: "cat_overig",
    };
    return map[cat] ? _(map[cat]) : cat;
  }

  if (!user) return null;

  const dayLabels = lang === "nl" ? DAY_LABELS_NL : DAY_LABELS_EN;
  const monthNames = lang === "nl" ? MONTH_NAMES_NL : MONTH_NAMES_EN;
  const days = getMonthDays(calYear, calMonth);
  const todayStr = formatDate(new Date());

  const statusColors: Record<string, string> = {
    ingediend: "bg-yellow-100 text-yellow-800",
    goedgekeurd: "bg-green-100 text-green-800",
    afgewezen: "bg-red-100 text-red-800",
  };

  const selectedSlots = selectedDate ? getSlotsForDate(selectedDate) : [];
  const selectedHours = selectedDate ? (hoursByDate[selectedDate] || []) : [];

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{_("greeting")}, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-gray-500">{_("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="text-xs font-medium bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition"
            title={lang === "nl" ? "Switch to English" : "Schakel naar Nederlands"}
          >
            {lang === "nl" ? "EN" : "NL"}
          </button>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
            {_("logout")}
          </button>
        </div>
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
            {monthNames[calMonth]} {calYear}
          </h2>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayLabels.map((d) => (
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
            <span className="text-xs text-gray-500">{_("legend_submitted")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
            <span className="text-xs text-gray-500">{_("legend_workday")}</span>
          </div>
        </div>
      </div>

      {/* Geselecteerde dag detail */}
      {selectedDate && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString(lang === "nl" ? "nl-NL" : "en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>

          {/* Roosterslots */}
          {selectedSlots.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">{_("schedule_label")}</p>
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
                      <span className="text-xs text-red-600 font-medium">{_("your_class")}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ingediende uren */}
          {selectedHours.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">{_("submitted_label")}</p>
              <div className="space-y-1.5">
                {selectedHours.map((h) => (
                  <div key={h.id} className="p-2.5 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{h.start_time}-{h.end_time}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[h.status] || ""}`}>
                          {statusLabel(h.status)}
                        </span>
                        <button
                          onClick={async () => {
                            if (!confirm(_("confirm_delete_hours"))) return;
                            await fetch("/api/hours", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: h.id }),
                            });
                            loadHours(user.id);
                          }}
                          className="text-xs text-red-500 hover:text-red-700 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {h.type === "inval" ? `${_("inval_voor")} ${h.substitute_for_name}` : _("regulier")}
                      {h.remark && ` — ${h.remark}`}
                    </p>
                    {h.status === "afgewezen" && h.reject_reason && (
                      <p className="text-xs text-red-600 mt-0.5">{_("reason")}: {h.reject_reason}</p>
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
            {_("add_hours")}
          </button>
        </div>
      )}

      {/* Invoerformulier uren */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">{_("form_title")}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{_("form_date")}</label>
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
                <label className="block text-sm text-gray-600 mb-1">{_("form_start")}</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{_("form_end")}</label>
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
              <label className="block text-sm text-gray-600 mb-1">{_("form_type")}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="regulier">{_("form_type_regulier")}</option>
                <option value="inval">{_("form_type_inval")}</option>
              </select>
            </div>
            {form.type === "inval" && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">{_("form_inval_for")}</label>
                <select
                  value={form.substitute_for_id}
                  onChange={(e) => setForm({ ...form, substitute_for_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">{_("form_select_trainer")}</option>
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
              <label className="block text-sm text-gray-600 mb-1">{_("form_remark")}</label>
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
                {submitting ? _("form_saving") : _("form_submit")}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                {_("form_cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Onkosten sectie */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">{_("expenses_title")}</h2>
          <button
            onClick={() => setShowExpenseForm(!showExpenseForm)}
            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
          >
            {_("expenses_add")}
          </button>
        </div>

        {showExpenseForm && (
          <form onSubmit={handleExpenseSubmit} className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm text-gray-600 mb-1">{_("expense_date")}</label>
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
                <label className="block text-sm text-gray-600 mb-1">{_("expense_amount")} (&euro;)</label>
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
                <label className="block text-sm text-gray-600 mb-1">{_("expense_category")}</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="benzine">{_("cat_benzine")}</option>
                  <option value="materiaal">{_("cat_materiaal")}</option>
                  <option value="parkeren">{_("cat_parkeren")}</option>
                  <option value="overig">{_("cat_overig")}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">{_("expense_description")}</label>
              <input
                type="text"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder={_("expense_placeholder")}
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
                {submitting ? _("form_saving") : _("form_submit")}
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                {_("form_cancel")}
              </button>
            </div>
          </form>
        )}

        {expenses.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">{_("expenses_empty")}</p>
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
                      {catLabel(exp.category)} — {exp.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[exp.status] || ""}`}>
                      {statusLabel(exp.status)}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm(_("confirm_delete_expense"))) return;
                        await fetch("/api/expenses", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: exp.id }),
                        });
                        loadExpenses(user.id);
                      }}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                {exp.status === "afgewezen" && exp.reject_reason && (
                  <p className="text-xs text-red-600 mt-1">{_("reason")}: {exp.reject_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

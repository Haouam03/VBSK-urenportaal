"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { type Lang, tr } from "@/lib/translations";

export default function LoginPage() {
  const [trainers, setTrainers] = useState<{ id: number; name: string }[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Lang>("nl");
  const router = useRouter();

  const _ = useCallback((key: Parameters<typeof tr>[0]) => tr(key, lang), [lang]);

  useEffect(() => {
    const user = sessionStorage.getItem("vbsk_user");
    if (user) {
      const parsed = JSON.parse(user);
      router.push(parsed.role === "admin" ? "/admin" : "/trainer");
      return;
    }
    const savedLang = localStorage.getItem("vbsk_lang");
    if (savedLang === "en" || savedLang === "nl") setLang(savedLang);
    fetch("/api/trainers")
      .then((r) => r.json())
      .then((data) => setTrainers(data.filter((t: { active: number }) => t.active)));
  }, [router]);

  function toggleLang() {
    const next = lang === "nl" ? "en" : "nl";
    setLang(next);
    localStorage.setItem("vbsk_lang", next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selectedName, pin }),
    });

    if (!res.ok) {
      setError(_("login_error"));
      setLoading(false);
      return;
    }

    const user = await res.json();
    sessionStorage.setItem("vbsk_user", JSON.stringify(user));
    router.push(user.role === "admin" ? "/admin" : "/trainer");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Language toggle */}
          <div className="flex justify-end mb-2">
            <button
              onClick={toggleLang}
              className="text-xs font-medium bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition"
              title={lang === "nl" ? "Switch to English" : "Schakel naar Nederlands"}
            >
              {lang === "nl" ? "EN" : "NL"}
            </button>
          </div>

          <div className="text-center mb-8">
            <img
              src="/vbsk-logo.png"
              alt="VBSK Albert Cuyp"
              className="h-20 mx-auto mb-3 object-contain"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                el.parentElement!.querySelector(".fallback")!.classList.remove("hidden");
              }}
            />
            <div className="fallback hidden">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl font-bold">V</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{_("login_title")}</h1>
            <p className="text-gray-500 mt-1">{_("login_subtitle")}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {lang === "nl" ? "Naam" : "Name"}
              </label>
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="">{_("login_select_trainer")}</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{_("login_pin")}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder={lang === "nl" ? "4-cijferige pin" : "4-digit pin"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-center text-2xl tracking-[0.5em] focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white rounded-lg py-2.5 font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? _("login_button") + "..." : _("login_button")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

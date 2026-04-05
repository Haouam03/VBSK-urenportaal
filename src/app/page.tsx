"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [trainers, setTrainers] = useState<{ id: number; name: string }[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    const user = sessionStorage.getItem("vbsk_user");
    if (user) {
      const parsed = JSON.parse(user);
      router.push(parsed.role === "admin" ? "/admin" : "/trainer");
      return;
    }
    fetch("/api/trainers")
      .then((r) => r.json())
      .then((data) => setTrainers(data.filter((t: { active: number }) => t.active)));
  }, [router]);

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
      setError("Ongeldige naam of pincode");
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
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">V</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">VBSK Amsterdam</h1>
            <p className="text-gray-500 mt-1">Urenregistratie</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Naam</label>
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              >
                <option value="">Selecteer je naam...</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="4-cijferige pin"
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
              {loading ? "Inloggen..." : "Inloggen"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

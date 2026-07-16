"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/frontend/firebase/client";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string }>({
    ok: false,
    message: "",
  });
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState({ ok: false, message: "Please enter a valid email address." });
      return;
    }
    setPending(true);
    try {
      await addDoc(collection(db, "waitlist"), {
        email: value,
        createdAt: serverTimestamp(),
      });
      setState({ ok: true, message: "You're on the list. We'll be in touch!" });
      setEmail("");
    } catch {
      setState({ ok: false, message: "Something went wrong. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-64 px-4 py-2.5 rounded-xl glass focus:border-violet-500/60 focus:outline-none text-sm placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-ghost px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Joining…" : "Join waitlist"}
        </button>
      </div>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

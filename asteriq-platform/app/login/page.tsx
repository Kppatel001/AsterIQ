"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, setAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    default:
      return "Login failed. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setAuthCookie();
      router.push("/dashboard");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      setError(friendlyError(code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm fade-up">
        <div className="glass-strong rounded-3xl p-8 card-hover">
          <Link href="/">
            <Logo />
          </Link>
          <h1 className="mt-8 text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Log in to keep building.
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/60 focus:outline-none text-sm placeholder:text-zinc-500"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/60 focus:outline-none text-sm placeholder:text-zinc-500"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded-xl"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
          <p className="mt-4 text-sm text-zinc-400">
            No account?{" "}
            <Link href="/signup" className="text-violet-400 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

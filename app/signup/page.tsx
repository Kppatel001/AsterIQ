"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, setAuthCookie } from "@/frontend/firebase/client";
import { Logo } from "@/frontend/brand";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in.";
    case "auth/weak-password":
      return "Password is too weak — use at least 8 characters.";
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    default:
      return "Signup failed. Please try again.";
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: fullName });
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        fullName,
        createdAt: serverTimestamp(),
      });
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
        <h1 className="mt-8 text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Build and deploy your first app in minutes.
        </p>
        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-violet-500/60 focus:outline-none text-sm placeholder:text-zinc-500"
          />
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
            minLength={8}
            placeholder="Password (min 8 characters)"
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
            {loading ? "Creating account…" : "Sign up free"}
          </button>
        </form>
        <p className="mt-4 text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-400 hover:underline">
            Log in
          </Link>
        </p>
        </div>
      </div>
    </main>
  );
}

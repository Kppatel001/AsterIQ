import Link from "next/link";
import { Logo, APP_NAME } from "@/frontend/brand";
import { WaitlistForm } from "./waitlist-form";

const features = [
  {
    icon: "⚡",
    title: "Prompt to app",
    desc: "Describe what you want in English, Hindi, or Hinglish. Watch a working app stream in live, line by line.",
  },
  {
    icon: "👁",
    title: "Instant live preview",
    desc: "Every generation renders immediately in a secure sandbox. No build steps, no waiting, no setup.",
  },
  {
    icon: "💬",
    title: "Iterate by chatting",
    desc: "\"Make the header blue.\" \"Add dark mode.\" Refine your app the way you'd brief a developer.",
  },
  {
    icon: "🚀",
    title: "One-click deploy",
    desc: "Push your app to GitHub and get a live URL on the internet in one click. Share it with anyone.",
  },
  {
    icon: "🔒",
    title: "Secure by default",
    desc: "Your projects live in Firestore behind per-user security rules. Only you can see your work.",
  },
  {
    icon: "🇮🇳",
    title: "Built for India",
    desc: "Hinglish prompts, GST calculators, tiffin services, kirana stores — templates that fit real Indian businesses.",
  },
];

const steps = [
  { n: "01", title: "Describe", desc: "Type your idea in plain language — no code, no jargon." },
  { n: "02", title: "Watch it build", desc: "AI writes the full app while you watch it appear live." },
  { n: "03", title: "Deploy", desc: "One click puts it on the internet with a shareable link." },
];

const templates = [
  "Habit Tracker",
  "GST Calculator",
  "Tiffin Service Site",
  "Quiz App",
  "Portfolio",
  "Kirana Store",
  "Expense Splitter",
  "Wedding Invite",
  "Attendance Register",
];

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6">
      <nav className="flex items-center justify-between py-6">
        <Logo />
        <div className="flex gap-3">
          <Link
            href="/login"
            className="btn-ghost px-4 py-2 text-sm rounded-xl"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="btn-primary px-4 py-2 text-sm rounded-xl"
          >
            Start building
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center pt-20 pb-16">
        <div className="fade-up inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-zinc-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          AI Builder + GitHub deployment — live now
        </div>
        <h1 className="fade-up text-5xl md:text-[56px] font-extrabold tracking-tight leading-[1.1]">
          Describe your idea.
          <br />
          <span className="gradient-text">AI builds everything.</span>
        </h1>
        <p className="fade-up-1 mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
          India&apos;s AI no-code platform. Type what you want — a habit
          tracker, a shop website, a quiz app — and get a working application
          deployed to the internet in minutes.
        </p>

        {/* Prompt-style CTA */}
        <div className="fade-up-2 mt-10 max-w-2xl mx-auto">
          <div className="glass-strong rounded-2xl p-2 flex items-center gap-2 card-hover">
            <span className="pl-3 text-zinc-500 text-sm hidden sm:block">✦</span>
            <div className="flex-1 text-left px-2 py-2.5 text-zinc-500 text-sm truncate">
              Build me a habit tracker with streaks and a weekly chart…
            </div>
            <Link
              href="/signup"
              className="btn-primary px-5 py-2.5 rounded-xl text-sm whitespace-nowrap"
            >
              Generate App
            </Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Free to start · No credit card · Deploy with one click
          </p>
        </div>

        <div className="fade-up-3 mt-8">
          <WaitlistForm />
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <h2 className="text-3xl md:text-[36px] font-bold text-center">
          Idea to internet in <span className="gradient-text">3 steps</span>
        </h2>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div key={s.n} className="glass rounded-2xl p-6 card-hover">
              <span className="gradient-text text-sm font-bold">{s.n}</span>
              <h3 className="mt-2 font-semibold text-xl">{s.title}</h3>
              <p className="mt-2 text-zinc-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <h2 className="text-3xl md:text-[36px] font-bold text-center">
          Everything you need to <span className="gradient-text">ship</span>
        </h2>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 card-hover">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-lg">
                {f.icon}
              </div>
              <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Templates */}
      <section className="py-16 text-center">
        <h2 className="text-3xl md:text-[36px] font-bold">
          Start from an <span className="gradient-text">idea</span>
        </h2>
        <p className="mt-3 text-zinc-400">Type any of these into the builder and watch it appear.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {templates.map((t) => (
            <Link
              key={t}
              href="/signup"
              className="glass rounded-full px-5 py-2.5 text-sm text-zinc-300 hover:text-white card-hover"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 text-center">
        <div className="glass-strong rounded-3xl p-12 card-hover">
          <h2 className="text-3xl md:text-[36px] font-bold">
            Your first app is <span className="gradient-text">one prompt away</span>
          </h2>
          <p className="mt-3 text-zinc-400">Build free. Deploy free. Own your code.</p>
          <Link
            href="/signup"
            className="btn-primary inline-block mt-8 px-8 py-3.5 rounded-2xl text-lg"
          >
            Start building free
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-zinc-500">
        Made in India 🇮🇳 · © {new Date().getFullYear()} {APP_NAME} AI
      </footer>
    </main>
  );
}

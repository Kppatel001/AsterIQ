"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/frontend/brand";

const LIBRARY: { category: string; icon: string; prompts: string[] }[] = [
  {
    category: "Business Websites",
    icon: "🏪",
    prompts: [
      "A landing page for my tiffin service with menu, weekly plans, pricing in ₹, and a WhatsApp order button",
      "A website for my kirana store with product categories, today's offers, and home delivery info",
      "A salon booking page with services, prices, time slots, and a booking form",
      "A coaching class website with courses, batch timings, faculty section, and admission enquiry form",
    ],
  },
  {
    category: "Tools & Calculators",
    icon: "🧮",
    prompts: [
      "A GST calculator for shopkeepers with CGST/SGST split and invoice total",
      "An EMI calculator with loan amount, interest rate, tenure sliders and a payment breakdown chart",
      "An expense splitter for roommates that tracks who paid what and who owes whom",
      "A SIP returns calculator with monthly investment, expected return, and growth chart",
    ],
  },
  {
    category: "Productivity Apps",
    icon: "✅",
    prompts: [
      "A habit tracker with streaks, daily check-ins, and a weekly progress chart",
      "A kanban board with To Do, Doing, Done columns and drag-and-drop cards",
      "A pomodoro timer with work/break cycles, session history, and sound alerts",
      "A daily planner with time blocks, priorities, and a completion score",
    ],
  },
  {
    category: "Fun & Games",
    icon: "🎮",
    prompts: [
      "A quiz app about Indian general knowledge with score, timer, and leaderboard",
      "A memory card matching game with emojis, moves counter, and best score",
      "A typing speed test with WPM, accuracy, and Indian city names as words",
      "A snake game with increasing speed and high score",
    ],
  },
  {
    category: "Events & Personal",
    icon: "🎉",
    prompts: [
      "A wedding invitation page with couple names, venue map section, events schedule, and RSVP form",
      "A birthday countdown page with confetti animation and photo gallery",
      "A personal portfolio with about, skills, projects, and contact sections in dark mode",
      "A resume builder that lets me fill sections and print a clean A4 resume",
    ],
  },
  {
    category: "Clone Famous Styles",
    icon: "🪞",
    prompts: [
      "An Airbnb-style stays listing page with property cards, filters, date picker, and a booking modal",
      "A Notion-style workspace with a sidebar, nested pages, and editable blocks of text and to-dos",
      "An Uber-style ride booking screen with pickup/drop inputs, map placeholder, car options, and fare estimate",
      "A Stripe-style product landing page with clean typography, gradient hero, code snippet section, and pricing",
    ],
  },
  {
    category: "Dashboards",
    icon: "📊",
    prompts: [
      "A premium fintech dashboard with balance cards, spending chart, recent transactions, and dark theme",
      "A sales dashboard with revenue KPIs, monthly trend chart, top products table",
      "A student attendance dashboard with class-wise percentages and defaulter list",
      "A gym member dashboard with workout log, weight progress chart, and diet checklist",
    ],
  },
];

export default function PromptsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 pb-20">
      <nav className="flex items-center justify-between py-6">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/dashboard" className="btn-ghost px-4 py-2 rounded-xl text-sm">
          ← Dashboard
        </Link>
      </nav>

      <header className="text-center pt-10 pb-12 fade-up">
        <h1 className="text-4xl md:text-5xl font-extrabold">
          Prompt <span className="gradient-text">Library</span>
        </h1>
        <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
          Copy any prompt, paste it into your builder, and watch the app appear.
          Edit freely — these are starting points.
        </p>
      </header>

      <div className="space-y-10">
        {LIBRARY.map((section) => (
          <section key={section.category} className="fade-up-1">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>{section.icon}</span> {section.category}
            </h2>
            <div className="mt-4 grid md:grid-cols-2 gap-3">
              {section.prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => copy(p)}
                  className="glass rounded-2xl p-4 text-left text-sm text-zinc-300 leading-relaxed card-hover relative"
                >
                  {p}
                  <span
                    className={`absolute top-3 right-3 text-xs ${
                      copied === p ? "text-emerald-400" : "text-zinc-600"
                    }`}
                  >
                    {copied === p ? "✓ Copied" : "Copy"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

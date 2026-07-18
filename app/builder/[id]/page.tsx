"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { auth, db, clearAuthCookie } from "@/frontend/firebase/client";
import { BuilderClient, type Msg } from "./builder-client";

export default function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<{
    id: string;
    name: string;
    code: string;
    files?: Record<string, string>;
    businessPlan?: string;
    buildPlan?: string;
  } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    "loading"
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        clearAuthCookie();
        router.push("/login");
        return;
      }
      setUser(u);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "projects", id));
        if (!snap.exists()) {
          setStatus("notfound");
          return;
        }
        const data = snap.data();
        setProject({
          id: snap.id,
          name: data.name,
          code: data.code || "",
          files: data.files || {},
          businessPlan: data.businessPlan || "",
          buildPlan: data.buildPlan || "",
        });

        const msgSnap = await getDocs(
          query(
            collection(db, "projects", id, "messages"),
            orderBy("createdAt", "asc")
          )
        );
        setMessages(
          msgSnap.docs.map((d) => ({
            role: d.data().role as "user" | "assistant",
            content: d.data().content as string,
          }))
        );
        setStatus("ready");
      } catch {
        // Firestore rules deny reads of projects you don't own
        setStatus("notfound");
      }
    })();
  }, [user, id]);

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        Loading project…
      </main>
    );
  }

  if (status === "notfound" || !project) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm">
        <p className="text-zinc-400">Project not found.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-orange-400 hover:underline"
        >
          ← Back to dashboard
        </button>
      </main>
    );
  }

  return <BuilderClient project={project} initialMessages={messages} />;
}

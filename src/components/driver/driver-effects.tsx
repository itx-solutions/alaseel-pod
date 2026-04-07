"use client";

import { useEffect } from "react";
import { syncQueuedPods } from "@/lib/offline-queue";

export function DriverEffects() {
  useEffect(() => {
    const onOnline = () => {
      void syncQueuedPods();
    };
    window.addEventListener("online", onOnline);
    void syncQueuedPods();
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}

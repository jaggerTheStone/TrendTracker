"use client";

import { useSyncExternalStore } from "react";
import type { Period } from "./types";

export type ThemeSetting = "system" | "light" | "dark";

export interface Settings {
  theme: ThemeSetting;
  period: Period;
}

import { SETTINGS_KEY as KEY } from "./theme-script";
const DEFAULTS: Settings = { theme: "system", period: "day" };

let current: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (current) return current;
  try {
    current = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>) };
  } catch {
    current = DEFAULTS;
  }
  return current;
}

function applyTheme(theme: ThemeSetting) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode: the setting lasts for this visit.
  }
  applyTheme(current.theme);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (read().theme === "system") applyTheme("system");
  };
  media.addEventListener("change", onSystem);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystem);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("tf-theme") as Theme | null;
    const initial: Theme =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("tf-theme", theme);
  }, [theme, ready]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t.themeToLight : t.themeToDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center gap-1.5 rounded-full border border-brand-foreground/30 bg-brand-foreground/5 px-2 py-1 text-xs font-medium text-brand-foreground/90 transition-colors hover:bg-brand-foreground/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
    >
      <span aria-hidden="true" className="text-sm">{isDark ? "☀" : "☾"}</span>
      {isDark ? t.themeLight : t.themeDark}
    </button>
  );
}

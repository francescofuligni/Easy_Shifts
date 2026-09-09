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
      className="inline-flex items-center gap-2 rounded-full border border-brand-foreground/50 bg-brand-foreground/10 px-3 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      {isDark ? t.themeLight : t.themeDark}
    </button>
  );
}

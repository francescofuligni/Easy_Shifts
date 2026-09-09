import { useI18n, type Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "it", label: "IT" },
  { value: "en", label: "EN" },
];

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.langLabel}
      className="inline-flex items-center gap-1 rounded-full border border-brand-foreground/50 bg-brand-foreground/10 p-1"
    >
      {OPTIONS.map((o) => {
        const active = lang === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(o.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-brand-foreground hover:bg-brand-foreground/20"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

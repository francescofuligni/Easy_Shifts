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
      className="inline-flex items-center rounded-full border border-brand-foreground/30 bg-brand-foreground/5 p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = lang === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(o.value)}
            className={`rounded-full px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent ${
              active
                ? "bg-brand-foreground/20 text-brand-foreground"
                : "text-brand-foreground/70 hover:text-brand-foreground hover:bg-brand-foreground/10"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

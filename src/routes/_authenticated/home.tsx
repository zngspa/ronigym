import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Users, ListChecks, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "דף ראשי — מאמן" },
      { name: "description", content: "גישה מהירה לשיעורים ונוכחות, חניכים, תוכניות אימון ותשלומים" },
      { property: "og:title", content: "דף ראשי — מאמן" },
      { property: "og:description", content: "גישה מהירה לשיעורים ונוכחות, חניכים, תוכניות אימון ותשלומים" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const tiles = [
  { to: "/lessons", label: "שיעורים ונוכחות", icon: CalendarCheck, className: "bg-primary text-primary-foreground" },
  { to: "/students", label: "חניכים", icon: Users, className: "bg-emerald-600 text-white" },
  { to: "/workouts", label: "תוכניות אימון", icon: ListChecks, className: "bg-amber-500 text-white" },
  { to: "/payments", label: "תשלומים", icon: Wallet, className: "bg-violet-600 text-white" },
] as const;

function HomePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold">ברוך הבא</h1>
        <p className="text-sm text-muted-foreground mt-1">בחר קטגוריה כדי להתחיל</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-5">
        {tiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`${t.className} rounded-2xl shadow-sm active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-3 aspect-square md:aspect-[4/3] p-4 text-center`}
          >
            <t.icon className="h-10 w-10 md:h-12 md:w-12" />
            <span className="font-bold text-base md:text-xl leading-tight">{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/")({
  head: () => pageHead("ZNG Israel — ניהול אימוני כושר", "ניהול חניכים, שיעורים, תוכניות אימון ותשלומים ב־ZNG Israel."),
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});

import { useEffect, useState } from "react";
import { israelToday } from "@/lib/medical-approval-status";

export function useIsraelToday() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setToday(israelToday());
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
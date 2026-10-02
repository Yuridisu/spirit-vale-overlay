import { useEffect, useState } from "preact/hooks";

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/** The computer's local time, for a game running fullscreen over the taskbar clock. */
export function ClockElement() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return <div class="clock-value">{clockFormat.format(now)}</div>;
}

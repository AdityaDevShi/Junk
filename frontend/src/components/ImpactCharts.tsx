import { useEffect, useState } from "react";
import type { Issue } from "../types";
import { categoryLabel } from "./badges";

// Smooth count-up for numbers.
function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function Donut({ pct }: { pct: number }) {
  const [mounted, setMounted] = useState(false);
  const shown = useCountUp(pct);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);
  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = mounted ? C * (1 - pct / 100) : C;
  return (
    <div className="donut">
      <svg viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={R} className="donut-track" />
        <circle
          cx="65"
          cy="65"
          r={R}
          className="donut-fill"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="donut-center">
        <strong>{Math.round(shown)}%</strong>
        <span>resolved</span>
      </div>
    </div>
  );
}

function Kpi({ value, label }: { value: number; label: string }) {
  const v = useCountUp(value);
  return (
    <div className="kpi">
      <strong>{Math.round(v)}</strong>
      <span>{label}</span>
    </div>
  );
}

export function ImpactCharts({ issues }: { issues: Issue[] }) {
  const total = issues.length;
  const resolved = issues.filter((i) => i.status === "resolved").length;
  const open = total - resolved;
  const rate = total ? Math.round((resolved / total) * 100) : 0;

  const byCat = Object.entries(
    issues.reduce<Record<string, number>>((m, i) => {
      m[i.category] = (m[i.category] || 0) + 1;
      return m;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  const top = Math.max(1, ...byCat.map(([, n]) => n));
  const divisions = top <= 5 ? top : 4;
  // Y-axis ticks, top → bottom.
  const ticks = Array.from({ length: divisions + 1 }, (_, i) =>
    Math.round((top * (divisions - i)) / divisions)
  );

  const [grow, setGrow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrow(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="card impact-card">
      <h2>City snapshot</h2>
      <p className="muted small">Live overview of your area</p>

      <div className="impact-top">
        <Donut pct={rate} />
        <div className="kpis">
          <Kpi value={total} label="Total reports" />
          <Kpi value={open} label="Still open" />
          <Kpi value={resolved} label="Resolved" />
        </div>
      </div>

      <h3 className="bars-title">Reports by category</h3>
      {byCat.length === 0 ? (
        <p className="muted small">No data yet.</p>
      ) : (
        <div className="chart">
          <div className="y-axis">
            {ticks.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
          <div className="plot">
            <div className="plot-area">
              <div className="gridlines">
                {ticks.map((_, i) => (
                  <div className="gridline" key={i} />
                ))}
              </div>
              <div className="bars-row">
                {byCat.map(([cat, n], idx) => (
                  <div className="bar-col" key={cat}>
                    <div
                      className="bar-fill"
                      title={`${n}`}
                      style={{
                        height: grow ? `${(n / top) * 100}%` : "0%",
                        transitionDelay: `${idx * 70}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="x-labels">
              {byCat.map(([cat]) => (
                <span key={cat}>{categoryLabel(cat)}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

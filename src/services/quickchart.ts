import type { ChartBar } from "../renderers/slide.types";

const BASE = "https://quickchart.io/chart";

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

// Horizontal bar chart — used by text_chart layout
export async function getBarChartImage(bars: ChartBar[]): Promise<string | null> {
  if (!bars || bars.length === 0) return null;
  const shades = ["#111111", "#374151", "#4B5563", "#6B7280", "#9CA3AF", "#D1D5DB"];
  const config = {
    type: "horizontalBar",
    data: {
      labels: bars.map(b => b.label),
      datasets: [{
        data: bars.map(b => b.value),
        backgroundColor: bars.map((_, i) => shades[i % shades.length] ?? "#111111"),
        borderWidth: 0,
      }],
    },
    options: {
      legend: { display: false },
      plugins: {
        datalabels: {
          color: "#fff",
          anchor: "end",
          align: "start",
          formatter: (v: number) => `${v}%`,
          font: { weight: "bold", size: 11 },
        },
      },
      scales: {
        xAxes: [{
          ticks: { min: 0, max: 100, fontColor: "#9CA3AF", fontSize: 10 },
          gridLines: { color: "#F3F4F6" },
        }],
        yAxes: [{
          ticks: { fontColor: "#374151", fontSize: 11 },
          gridLines: { display: false },
        }],
      },
      layout: { padding: { right: 16, top: 8, bottom: 8, left: 8 } },
    },
  };
  const h = Math.max(bars.length * 54, 180);
  const url = `${BASE}?w=500&h=${h}&backgroundColor=white&c=${encodeURIComponent(JSON.stringify(config))}`;
  return fetchBase64(url);
}

// Single doughnut chart — called once per metric, results stored as array on the slide
export async function getDonutChartImage(value: string): Promise<string | null> {
  const pct = Math.min(Math.max(parseFloat(value.replace(/[^0-9.]/g, "")) || 0, 0), 100);
  const config = {
    type: "doughnut",
    data: {
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: ["#111111", "#F3F4F6"],
        borderWidth: 0,
      }],
    },
    options: {
      cutoutPercentage: 74,
      plugins: {
        datalabels: { display: false },
        doughnutlabel: {
          labels: [{
            text: value,
            font: { size: 20, weight: "bold" },
            color: "#111111",
          }],
        },
      },
    },
  };
  const url = `${BASE}?w=200&h=200&backgroundColor=white&c=${encodeURIComponent(JSON.stringify(config))}`;
  return fetchBase64(url);
}

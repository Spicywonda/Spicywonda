// scripts/pacman-svg.mjs
const THEMES = Object.freeze({
  light: {
    background: "#ffffff",
    border: "#d0d7de",
    empty: "#ebedf0",
    levels: ["#ebedf0", "#9ec5e5", "#5b9bd1", "#2f6fa8", "#1f4f7a"],
    label: "#57606a",
    pacman: "#e8ad24",
    redGhost: "#c9475b",
    blueGhost: "#357fa8",
    eye: "#ffffff",
    pupil: "#172033"
  },
  dark: {
    background: "#0d1117",
    border: "#30363d",
    empty: "#161b22",
    levels: ["#161b22", "#17324a", "#245b84", "#347fba", "#58a6db"],
    label: "#8b949e",
    pacman: "#f2c14e",
    redGhost: "#e05a6f",
    blueGhost: "#58a6db",
    eye: "#f8fafc",
    pupil: "#0d1117"
  }
});

const MAX_SVG_BYTES = 350_000;
// Generated assets need no links, embedded resources, active events or entities.
// This is a guard for this renderer's output, not a general-purpose SVG sanitizer.
const UNSAFE_SVG = /<script\b|<foreignObject\b|<set\b|<!|<\?|javascript:|url\s*\(|@import|\b(?:href|src|on[a-z]+)\s*=|attributeName\s*=\s*["']on/i;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function point(week, weekday, x0, y0, pitch, cell) {
  return [x0 + week * pitch + cell / 2, y0 + weekday * pitch + cell / 2];
}

function routePath(columns, x0, y0, pitch, cell) {
  const points = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    if (weekday % 2 === 0) {
      for (let week = 0; week < columns; week += 1) points.push(point(week, weekday, x0, y0, pitch, cell));
    } else {
      for (let week = columns - 1; week >= 0; week -= 1) points.push(point(week, weekday, x0, y0, pitch, cell));
    }
  }
  const [startX, startY] = points[0];
  const [endX, endY] = points.at(-1);
  points.push([endX + pitch, endY], [endX + pitch, endY + pitch],
    [startX - pitch, endY + pitch], [startX - pitch, startY]);
  return points.map(([x, y], index) => (index === 0 ? "M" : "L") + x + " " + y).join(" ") + " Z";
}

function monthLabels(weeks, x0, pitch) {
  let previous = "";
  const labels = [];
  for (let index = 0; index < weeks.length; index += 1) {
    const date = new Date(weeks[index].firstDay + "T00:00:00Z");
    const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date);
    if (month !== previous) {
      labels.push({ x: x0 + index * pitch, month });
      previous = month;
    }
  }
  return labels.filter((label, index) => !labels[index + 1] || labels[index + 1].x - label.x >= 3 * pitch)
    .map(({ x, month }) => '<text x="' + x + '" y="25">' + month + "</text>").join("");
}

function ghost(color, theme, path, begin) {
  return [
    '<g class="runner">',
    '<path d="M-8 8V0A8 8 0 0 1 8 0V8L5 5 2 8-1 5-4 8-8 5Z" fill="' + color + '"/>',
    '<circle cx="-3" cy="-1" r="2.4" fill="' + theme.eye + '"/>',
    '<circle cx="3" cy="-1" r="2.4" fill="' + theme.eye + '"/>',
    '<circle cx="-2.3" cy="-.6" r="1" fill="' + theme.pupil + '"/>',
    '<circle cx="3.7" cy="-.6" r="1" fill="' + theme.pupil + '"/>',
    '<animateMotion path="' + path + '" dur="28s" begin="' + begin + '" repeatCount="indefinite"/>',
    "</g>"
  ].join("");
}

export function validateSvg(svg) {
  if (typeof svg !== "string" || !svg.startsWith("<svg")) throw new Error("Invalid SVG document");
  if (Buffer.byteLength(svg) > MAX_SVG_BYTES) throw new Error("SVG is too large");
  if (UNSAFE_SVG.test(svg)) throw new Error("Unsafe SVG content");
  return svg;
}

export function renderPacmanSvg({ calendar, theme }) {
  const colors = THEMES[theme];
  if (!colors) throw new Error("Unknown SVG theme");
  if (!calendar || !Array.isArray(calendar.weeks) || calendar.weeks.length === 0) {
    throw new Error("Normalized contribution calendar is required");
  }

  const cell = 10;
  const gap = 4;
  const pitch = cell + gap;
  const x0 = 66;
  const y0 = 40;
  const columns = calendar.weeks.length;
  const width = Math.max(760, x0 + columns * pitch + 28);
  const height = 190;
  const path = routePath(columns, x0, y0, pitch, cell);

  const cells = calendar.weeks.flatMap((week, weekIndex) => {
    const byWeekday = new Map(week.days.map((day) => [day.weekday, day]));
    return Array.from({ length: 7 }, (_, weekday) => {
      const day = byWeekday.get(weekday);
      const level = day?.level ?? 0;
      const count = day?.count ?? 0;
      const date = day?.date ?? "outside-range";
      const x = x0 + weekIndex * pitch;
      const y = y0 + weekday * pitch;
      const title = date === "outside-range" ? "Outside contribution range" : date + ": " + count + " contributions";
      const routeStep = weekday * columns + (weekday % 2 === 0 ? weekIndex : columns - 1 - weekIndex);
      const arrival = Math.max(.001, routeStep / (8 * columns + 10)).toFixed(5);
      const pellet = count === 0 ? "" : '<circle class="pellet" cx="' + (x + cell / 2) + '" cy="' +
        (y + cell / 2) + '" r="' + (1.6 + level * .5) + '" fill="' + colors.levels[level] + '">' +
        '<animate attributeName="opacity" values="1;0;0" keyTimes="0;' + arrival + ';1" calcMode="discrete" dur="28s" repeatCount="indefinite"/></circle>';
      return '<rect data-day="' + escapeXml(date) + '" data-count="' + count + '" x="' + x + '" y="' + y +
        '" width="' + cell + '" height="' + cell + '" rx="2" fill="' + colors.levels[level] +
        '" fill-opacity=".25"><title>' + escapeXml(title) + "</title></rect>" + pellet;
    });
  }).join("");

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-labelledby="title desc">',
    '<title id="title">Animated Pac-Man contribution graph</title>',
    '<desc id="desc">Pac-Man and two ghosts move across a grid representing public GitHub contribution levels.</desc>',
    "<style>",
    'text{font:11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:' + colors.label + "}",
    "@media (prefers-reduced-motion:reduce){.runner{display:none}.pellet{opacity:1!important}}",
    "</style>",
    '<rect x=".5" y=".5" width="' + (width - 1) + '" height="' + (height - 1) + '" rx="16" fill="' +
      colors.background + '" stroke="' + colors.border + '"/>',
    '<g aria-hidden="true">' + monthLabels(calendar.weeks, x0, pitch) + cells + "</g>",
    '<g class="runner">',
    '<path d="M0 0L9-5A10 10 0 1 0 9 5Z" fill="' + colors.pacman + '">',
    '<animate attributeName="d" values="M0 0L9-5A10 10 0 1 0 9 5Z;M0 0L10-1A10 10 0 1 0 10 1Z;M0 0L9-5A10 10 0 1 0 9 5Z" dur=".24s" repeatCount="indefinite"/>',
    "</path>",
    '<animateMotion path="' + path + '" dur="28s" repeatCount="indefinite" rotate="auto"/>',
    "</g>",
    ghost(colors.redGhost, colors, path, "-27s"),
    ghost(colors.blueGhost, colors, path, "-26s"),
    '<text x="' + x0 + '" y="174">' + calendar.totalContributions + " contributions in the displayed period</text>",
    "</svg>"
  ].join("");

  return validateSvg(svg);
}

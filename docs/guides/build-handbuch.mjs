/**
 * Regenerate the handbook exports from docs/HANDBUCH.md.
 *
 *   node docs/guides/build-handbuch.mjs
 *
 * Why: the HTML/PDF used to be one-off exports with no generator, so they
 * silently drifted away from the Markdown source and were left untracked.
 * Now all three formats are one source of truth and the exports are
 * reproducible (and therefore safe to version on GitHub).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("docs");
const SRC = path.join(ROOT, "HANDBUCH.md");
const HTML_OUT = path.join(ROOT, "HANDBUCH.html");
const PDF_OUT = path.join(ROOT, "HANDBUCH StreamCaster.pdf");

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s) {
  return escapeHtml(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const isBlockStart = (line) =>
    /^(#{1,3}\s|>\s|[-*]\s|\d+\.\s|\||---\s*$)/.test(line.trim());

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i++; continue; }

    if (/^---\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const parts = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inline(parts.join(" "))}</blockquote>`);
      continue;
    }

    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim());
        i++;
      }
      const cells = (row) => row.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells); // row 1 is the |---| separator
      out.push(
        "<table><thead><tr>" +
          head.map((c) => `<th>${inline(c)}</th>`).join("") +
          "</tr></thead><tbody>" +
          body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
          "</tbody></table>"
      );
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (i < lines.length) {
        const cur = lines[i];
        const trimmed = cur.trim();
        if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
          items.push(trimmed.replace(/^(?:[-*]|\d+\.)\s+/, ""));
        } else if (/^\s{2,}\S/.test(cur) && items.length) {
          items[items.length - 1] += " " + trimmed;
        } else break;
        i++;
      }
      out.push(`<${tag}>` + items.map((t) => `<li>${inline(t)}</li>`).join("") + `</${tag}>`);
      continue;
    }

    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

const CSS = `
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #1e293b; font-size: 10.5pt; line-height: 1.55; }
  h1 { font-size: 21pt; color: #0f172a; margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 2px solid #2563eb; }
  h2 { font-size: 14pt; color: #1d4ed8; margin: 20pt 0 8pt; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 14pt 0 6pt; }
  p { margin: 0 0 8pt; }
  blockquote { margin: 10pt 0; padding: 8pt 12pt; background: #eff6ff;
    border-left: 3px solid #2563eb; color: #334155; break-inside: avoid; }
  hr { border: 0; border-top: 1px solid #cbd5e1; margin: 18pt 0; }
  ul, ol { margin: 0 0 10pt; padding-left: 18pt; }
  li { margin: 3pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0 14pt; font-size: 9pt; }
  th, td { border: 0.5px solid #cbd5e1; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #eff6ff; color: #1e3a8a; font-weight: 600; }
  tr { break-inside: avoid; }
  code { background: #f1f5f9; padding: 1pt 3pt; border-radius: 3px; font-family: Consolas, monospace; font-size: 9pt; }
  a { color: #1d4ed8; text-decoration: none; }
  strong { font-weight: 600; color: #0f172a; }
  .footer { margin-top: 22pt; padding-top: 8pt; border-top: 1px solid #cbd5e1;
    font-size: 8.5pt; color: #64748b; }
`;

const body = renderMarkdown(fs.readFileSync(SRC, "utf8"));
const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StreamCaster — Handbuch</title>
<style>${CSS}</style>
</head>
<body>
${body}
<p class="footer">Erzeugt aus <code>docs/HANDBUCH.md</code> · StreamCaster · Projektzustand: STATUS.md</p>
</body>
</html>
`;

fs.writeFileSync(HTML_OUT, html, "utf8");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: PDF_OUT, format: "A4", printBackground: true, margin: {
    top: "18mm", right: "16mm", bottom: "20mm", left: "16mm",
  } });
} finally {
  await browser.close();
}

console.log(`handbook exports rebuilt: ${path.relative(process.cwd(), HTML_OUT)} + ${path.relative(process.cwd(), PDF_OUT)}`);

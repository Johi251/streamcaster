/**
 * Builds the one-page quick-start guides (DE/EN × Fire TV / Smart TV).
 *
 *   node docs/guides/build.mjs
 *
 * Renders each variant with headless Chromium so the PDF matches the design
 * exactly. One A4 page per guide is a hard requirement — the checker at the
 * bottom fails the build if a guide spills onto a second page.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("docs");

const COPY = {
  de: {
    brand: "StreamCaster",
    sub: "Web-Video auf den Fernseher",
    kicker: "Ultrakurzanleitung",
    heroTv: "Fernseher",
    heroPhone: "Handy / PC",
    heroLink: "gleiches WLAN",
    step1Where: "Am Fernseher",
    step2Where: "Am Handy oder PC",
    step3Where: "Streamen",
    step2Title: "Code scannen — oder eintippen",
    step2Desc:
      "QR mit der Handy-Kamera scannen: die Seite öffnet sich und verbindet automatisch. Alternativ Code eingeben und <b>Connect</b> drücken.",
    step3Title: "Link einfügen, Datei senden oder Bildschirm spiegeln",
    step3Desc:
      "Der TV springt auf „Connected\" und spielt ab. Lautstärke und Pause steuerst du am Handy oder mit der TV-Fernbedienung.",
    helpTitle: "Wenn etwas hakt",
    tip: "Tipp: Der Code bleibt gültig, auch wenn das Handy kurz weg ist — der TV wartet und nimmt das nächste Gerät auf.",
    date: "Stand 10/2026",
    footTv: "Fernseher",
    footPhone: "Handy / PC",
  },
  en: {
    brand: "StreamCaster",
    sub: "Web video on your TV",
    kicker: "Quick start",
    heroTv: "TV",
    heroPhone: "Phone / PC",
    heroLink: "same Wi-Fi",
    step1Where: "On the TV",
    step2Where: "On your phone or PC",
    step3Where: "Cast",
    step2Title: "Scan the code — or type it",
    step2Desc:
      "Scan the QR with your phone camera: the page opens and connects by itself. Or type the code and press <b>Connect</b>.",
    step3Title: "Paste a link, send a file, or mirror your screen",
    step3Desc:
      "The TV switches to “Connected” and starts playing. Volume and pause are yours from the phone or the TV remote.",
    helpTitle: "If something is stuck",
    tip: "Tip: the code stays valid while your phone steps away — the TV keeps waiting for the next device.",
    date: "As of 10/2026",
    footTv: "TV",
    footPhone: "Phone / PC",
  },
};

const VARIANTS = [
  {
    id: "de-firetv",
    lang: "de",
    device: "firetv",
    file: "StreamCaster-Ultrakurzanleitung-FireTV.pdf",
    h1: "In 3 Schritten auf dem TV.",
    lead:
      "Kein Kabel, keine App auf dem Handy. Der Fernseher zeigt einen Code — das Handy schickt den Stream.",
    step1Title: "Browser öffnen, Adresse eingeben",
    step1Desc:
      "Fire TV (Silk), Android-TV oder Smart-TV-Browser. Es erscheint ein 6-stelliger Code und ein QR-Code.",
    calloutTitle:
      "Nur für iPhone / iPad (AirPlay): einmalig die Receiver-App auf dem Fire TV installieren",
    callout: [
      "<b>Downloader</b> auf dem Fire TV installieren (Amazon Appstore, kostenlos).",
      "In Downloader eingeben: <b>streamcaster.pages.dev/apk</b> — „Apps aus unbekannten Quellen\" erlauben.",
      "<b>StreamCaster Receiver</b> starten → Code erscheint → am iPhone über AirPlay spiegeln.",
    ],
    help: [
      ["TV wartet, aber nichts passiert", "Code erneut scannen — der QR verbindet direkt, ohne Tippen."],
      [
        "Video startet nicht",
        "Manche Portale blocken fremde Player. Dann im Sender „Browse &amp; cast\" nutzen und dort abspielen.",
      ],
      ["iPhone spiegelt nicht", "AirPlay braucht die Receiver-App auf dem Fire TV (siehe oben)."],
    ],
    foot3: { k: "Fire-TV-App (iPhone)", v: "streamcaster.pages.dev/apk", mono: true },
  },
  {
    id: "de-smarttv",
    lang: "de",
    device: "smarttv",
    file: "StreamCaster-Ultrakurzanleitung-SmartTV.pdf",
    h1: "In 3 Schritten auf dem Smart-TV.",
    lead:
      "Samsung oder LG: der eingebaute Browser reicht. Kein Kabel, keine App, kein Zusatzgerät.",
    step1Title: "TV-Browser öffnen, Adresse eingeben",
    step1Desc:
      "Samsung: App „Internet\". LG: App „Web-Browser\". Es erscheint ein 6-stelliger Code und ein QR-Code.",
    calloutTitle: "iPhone / iPad: AirPlay ist im Smart-TV schon eingebaut",
    callout: [
      "Viele Samsung- und LG-Geräte (etwa ab Baujahr 2019) spiegeln direkt per AirPlay — <b>ohne</b> zusätzliche App.",
      "Am iPhone: Kontrollzentrum → <b>Bildschirmsynchronisierung</b> → den Fernseher wählen.",
      "StreamCaster selbst brauchst du dafür nicht — der TV-Browser bleibt für Links und Dateien zuständig.",
    ],
    help: [
      ["Tippen mit der Fernbedienung nervt", "Nicht tippen: QR mit der Handy-Kamera scannen, das verbindet sofort."],
      [
        "Seite lädt nicht oder hängt",
        "TV-Software aktualisieren. Bei älteren Geräten ist der Browser zu alt — dann Fire TV oder Chromecast nutzen.",
      ],
      [
        "Video startet nicht",
        "Manche Portale blocken fremde Player. Dann im Sender „Browse &amp; cast\" nutzen und dort abspielen.",
      ],
    ],
    foot3: { k: "iPhone (AirPlay)", v: "im TV-Menü, keine App", mono: false },
  },
  {
    id: "en-firetv",
    lang: "en",
    device: "firetv",
    file: "StreamCaster-Quickstart-FireTV.pdf",
    h1: "On your TV in 3 steps.",
    lead:
      "No cable, no app on your phone. The TV shows a code — your phone sends the stream.",
    step1Title: "Open the browser, enter the address",
    step1Desc:
      "Fire TV (Silk), Android TV or a smart TV browser. A 6-character code and a QR code appear.",
    calloutTitle: "iPhone / iPad only (AirPlay): install the receiver app on the Fire TV once",
    callout: [
      "Install <b>Downloader</b> on the Fire TV (Amazon Appstore, free).",
      "Enter <b>streamcaster.pages.dev/apk</b> in Downloader — allow “apps from unknown sources”.",
      "Start <b>StreamCaster Receiver</b> → the code appears → mirror from the iPhone via AirPlay.",
    ],
    help: [
      ["TV waits, nothing happens", "Scan the QR again — it connects directly, no typing."],
      [
        "Video won't start",
        "Some sites block third-party players. Use “Browse &amp; cast” in the sender and play it there.",
      ],
      ["iPhone won't mirror", "AirPlay needs the receiver app on the Fire TV (see above)."],
    ],
    foot3: { k: "Fire TV app (iPhone)", v: "streamcaster.pages.dev/apk", mono: true },
  },
  {
    id: "en-smarttv",
    lang: "en",
    device: "smarttv",
    file: "StreamCaster-Quickstart-SmartTV.pdf",
    h1: "On your Smart TV in 3 steps.",
    lead:
      "Samsung or LG: the built-in browser is all it takes. No cable, no app, no extra box.",
    step1Title: "Open the TV browser, enter the address",
    step1Desc:
      "Samsung: the “Internet” app. LG: “Web Browser”. A 6-character code and a QR code appear.",
    calloutTitle: "iPhone / iPad: AirPlay is already built into the Smart TV",
    callout: [
      "Many Samsung and LG sets (roughly 2019 and later) mirror over AirPlay directly — <b>no</b> extra app.",
      "On the iPhone: Control Centre → <b>Screen Mirroring</b> → pick the TV.",
      "You don't need StreamCaster for that — the TV browser still handles links and files.",
    ],
    help: [
      ["Typing with the remote is painful", "Don't type: scan the QR with your phone camera and it connects instantly."],
      [
        "Page won't load or hangs",
        "Update the TV software. On older sets the browser is too old — use a Fire TV or Chromecast instead.",
      ],
      [
        "Video won't start",
        "Some sites block third-party players. Use “Browse &amp; cast” in the sender and play it there.",
      ],
    ],
    foot3: { k: "iPhone (AirPlay)", v: "in the TV menu, no app", mono: false },
  },
];

const html = (v) => {
  const c = COPY[v.lang];
  return `<!doctype html>
<html lang="${v.lang}">
<head>
<meta charset="utf-8">
<title>StreamCaster — ${c.kicker}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0e1320; --muted: #5b6478; --line: #e3e8f2;
    --accent: #4f8cff; --accent2: #8b5cf6; --soft: #f4f7ff;
  }
  body { font-family: "Segoe UI", "Inter", system-ui, -apple-system, sans-serif;
         color: var(--ink); -webkit-font-smoothing: antialiased; background: #fff; }
  .page { width: 210mm; height: 297mm; padding: 14mm 15mm 10mm;
          display: flex; flex-direction: column; }

  .head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px;
          border-bottom: 1px solid var(--line); }
  .mark { width: 38px; height: 38px; border-radius: 11px; flex: none;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          display: grid; place-items: center;
          box-shadow: 0 7px 18px rgba(79,140,255,.35); }
  .mark svg { width: 20px; height: 20px; }
  .brand { font-size: 16px; font-weight: 700; letter-spacing: -.2px; }
  .brand span { display: block; font-size: 10.5px; font-weight: 500; color: var(--muted);
                letter-spacing: .35px; text-transform: uppercase; margin-top: 1px; }
  .kicker { margin-left: auto; font-size: 10px; font-weight: 700; letter-spacing: .9px;
            text-transform: uppercase; color: var(--accent); background: var(--soft);
            border: 1px solid #dbe6ff; border-radius: 999px; padding: 6px 13px; }

  h1 { font-size: 31px; line-height: 1.12; letter-spacing: -0.9px; margin: 16px 0 6px; }
  .lead { font-size: 12.5px; color: var(--muted); line-height: 1.5; }

  .hero { margin: 15px 0 4px; display: flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, #f7f9ff 0%, #fdfbff 100%);
          border: 1px solid #e6edfb; border-radius: 14px; padding: 13px 16px; }
  .device { flex: none; width: 112px; text-align: center; }
  .device .cap { font-size: 9px; font-weight: 800; letter-spacing: .7px;
                 text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .device .icon { height: 54px; display: grid; place-items: center;
                  color: var(--accent); margin-bottom: 4px; }
  .device .icon svg { width: 40px; height: 40px; }
  .codebox { display: inline-block; font-family: "Cascadia Code", "Consolas", monospace;
             font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #fff;
             background: linear-gradient(135deg, var(--accent), var(--accent2));
             border-radius: 7px; padding: 5px 9px 5px 11px;
             box-shadow: 0 5px 14px rgba(79,140,255,.28); }
  .codebox.ghost { color: #2a3a5e; background: #fff; border: 1px solid #dbe6ff; box-shadow: none; }
  .link { flex: 1; text-align: center; padding-top: 2px; }
  .link .dash { display: block; height: 2px; margin-bottom: 6px;
                background-image: linear-gradient(90deg, #c9d8f5 55%, transparent 0);
                background-size: 9px 2px; background-repeat: repeat-x; }
  .link .pill { font-size: 9px; font-weight: 700; letter-spacing: .5px; color: var(--accent);
                background: #fff; border: 1px solid #dbe6ff; border-radius: 999px;
                padding: 3px 9px; text-transform: uppercase; }

  .steps { margin-top: 16px; position: relative; }
  .steps::before { content: ""; position: absolute; left: 18px; top: 30px; bottom: 30px;
                   width: 2px; background: linear-gradient(180deg, #cfdcff, #e7ecf7); }
  .step { position: relative; display: flex; gap: 15px; padding-bottom: 15px; }
  .num { flex: none; width: 37px; height: 37px; border-radius: 50%; background: #fff;
         border: 2px solid #d9e3f8; color: var(--accent); font-size: 15px; font-weight: 800;
         display: grid; place-items: center; box-shadow: 0 2px 8px rgba(20,40,90,.06); }
  .step:last-child .num { background: linear-gradient(135deg, var(--accent), var(--accent2));
                          border-color: transparent; color: #fff; }
  .body { flex: 1; padding-top: 3px; }
  .where { font-size: 9.5px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase;
           color: var(--muted); display: flex; align-items: center; gap: 5px; }
  .where svg { width: 12px; height: 12px; }
  .title { font-size: 15px; font-weight: 700; margin: 4px 0 5px; letter-spacing: -.2px; }
  .desc { font-size: 11.5px; color: var(--muted); line-height: 1.55; }
  code.url { display: inline-block; font-family: "Cascadia Code", "Consolas", monospace;
             font-size: 11.5px; font-weight: 600; color: #1b3a8f; background: var(--soft);
             border: 1px solid #dbe6ff; border-radius: 6px; padding: 3px 8px; margin-top: 6px; }

  .callout { margin-top: 2px; border: 1px solid var(--line); border-left: 3px solid var(--accent);
             border-radius: 10px; background: #fbfcff; padding: 13px 15px; }
  .callout .h { font-size: 12px; font-weight: 700; margin-bottom: 7px;
                display: flex; align-items: center; gap: 7px; }
  .callout .h svg { width: 14px; height: 14px; flex: none; }
  .callout ol { margin: 0; padding-left: 16px; }
  .callout li { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
  .callout b { color: var(--ink); }

  .help { margin-top: 12px; }
  .help h2 { font-size: 10px; font-weight: 800; letter-spacing: .9px; text-transform: uppercase;
             color: var(--muted); margin-bottom: 7px; }
  .help .row { display: flex; gap: 9px; }
  .help .item { flex: 1; border: 1px solid var(--line); border-radius: 9px;
                padding: 9px 10px; background: #fff; }
  .help .q { font-size: 10.5px; font-weight: 700; color: var(--ink); margin-bottom: 3px; line-height: 1.3; }
  .help .a { font-size: 9.5px; color: var(--muted); line-height: 1.5; }

  .foot { margin-top: auto; padding-top: 11px; border-top: 1px solid var(--line);
          display: flex; gap: 9px; }
  .cell { flex: 1; background: var(--soft); border: 1px solid #e6edfb; border-radius: 8px;
          padding: 9px 11px; }
  .cell .k { font-size: 8.5px; font-weight: 800; letter-spacing: .7px;
             text-transform: uppercase; color: var(--muted); }
  .cell .v { font-size: 10px; font-weight: 600; color: #1b3a8f; margin-top: 3px; word-break: break-all; }
  .cell .v.mono { font-family: "Cascadia Code", "Consolas", monospace; }
  .cell .v.plain { font-family: inherit; font-weight: 500; color: var(--muted); }
  .note { margin-top: 8px; font-size: 9px; color: #8a93a6;
          display: flex; justify-content: space-between; gap: 12px; }
</style>
</head>
<body>
<div class="page">

  <div class="head">
    <div class="mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">
        <rect x="3" y="5" width="18" height="12" rx="2.5"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
    </div>
    <div class="brand">${c.brand}<span>${c.sub}</span></div>
    <div class="kicker">${c.kicker}</div>
  </div>

  <h1>${v.h1}</h1>
  <p class="lead">${v.lead}</p>

  <div class="hero">
    <div class="device">
      <div class="cap">${c.heroTv}</div>
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <rect x="2.5" y="4" width="19" height="13" rx="2.5"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
      </div>
      <div class="codebox">K7M2QP</div>
    </div>
    <div class="link">
      <span class="dash"></span>
      <span class="pill">${c.heroLink}</span>
    </div>
    <div class="device">
      <div class="cap">${c.heroPhone}</div>
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <rect x="7" y="2" width="10" height="20" rx="2.8"/>
          <path d="M11 19h2"/>
        </svg>
      </div>
      <div class="codebox ghost">K7M2QP</div>
    </div>
  </div>

  <div class="steps">

    <div class="step">
      <div class="num">1</div>
      <div class="body">
        <div class="where">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>
          ${c.step1Where}
        </div>
        <div class="title">${v.step1Title}</div>
        <div class="desc">${v.step1Desc}</div>
        <code class="url">streamcaster.pages.dev/r</code>
      </div>
    </div>

    <div class="step">
      <div class="num">2</div>
      <div class="body">
        <div class="where">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 19h2"/></svg>
          ${c.step2Where}
        </div>
        <div class="title">${c.step2Title}</div>
        <div class="desc">${c.step2Desc}</div>
        <code class="url">streamcaster.pages.dev</code>
      </div>
    </div>

    <div class="step">
      <div class="num">3</div>
      <div class="body">
        <div class="where">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>
          ${c.step3Where}
        </div>
        <div class="title">${c.step3Title}</div>
        <div class="desc">${c.step3Desc}</div>
      </div>
    </div>

  </div>

  <div class="callout">
    <div class="h">
      <svg viewBox="0 0 24 24" fill="none" stroke="#4f8cff" stroke-width="2.2"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4"/></svg>
      ${v.calloutTitle}
    </div>
    <ol>${v.callout.map((li) => `<li>${li}</li>`).join("")}</ol>
  </div>

  <div class="help">
    <h2>${c.helpTitle}</h2>
    <div class="row">
      ${v.help
        .map(([q, a]) => `<div class="item"><div class="q">${q}</div><div class="a">${a}</div></div>`)
        .join("\n      ")}
    </div>
  </div>

  <div class="foot">
    <div class="cell">
      <div class="k">${c.footTv}</div>
      <div class="v mono">streamcaster.pages.dev/r</div>
    </div>
    <div class="cell">
      <div class="k">${c.footPhone}</div>
      <div class="v mono">streamcaster.pages.dev</div>
    </div>
    <div class="cell">
      <div class="k">${v.foot3.k}</div>
      <div class="v ${v.foot3.mono ? "mono" : "plain"}">${v.foot3.v}</div>
    </div>
  </div>

  <div class="note">
    <span>${c.tip}</span>
    <span>${c.date}</span>
  </div>

</div>
</body>
</html>`;
};

const browser = await chromium.launch();
let failed = false;
// --preview writes a PNG of each guide next to the OS temp dir for eyeballing.
const preview = process.argv.includes("--preview");
const tmp = process.env.TEMP || process.env.TMPDIR || "/tmp";

for (const v of VARIANTS) {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.setContent(html(v), { waitUntil: "load" });
  await page.waitForTimeout(150);

  // Guard: content must not be taller than one A4 page.
  const box = await page.evaluate(() => {
    const el = document.querySelector(".page");
    return { h: el.scrollHeight, w: el.scrollWidth };
  });
  const limit = Math.round((297 / 25.4) * 96); // 297mm in CSS px
  const over = box.h > limit + 2;

  await page.pdf({
    path: path.join(OUT, v.file),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  console.log(
    `${v.file.padEnd(46)} content ${box.h}px / page ${limit}px  ${over ? "OVERFLOW" : "ok"}`
  );
  if (preview) {
    const png = path.join(tmp, `guide-${v.id}.png`);
    await page.screenshot({ path: png, fullPage: false });
    console.log(`   preview: ${png}`);
  }
  if (over) failed = true;
  await page.close();
}

await browser.close();
if (failed) {
  console.error("At least one guide overflows a single page.");
  process.exit(1);
}

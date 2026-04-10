import { useState, useEffect, useRef, useCallback } from "react";

const LOGO_URL = "/mnt/user-data/uploads/Green_White_Professional_Minimal_Brand_Logo_20260407_141037_0000.png";

// ─── PROMPTS ──────────────────────────────────────────────────────────────────
const PROMPTS = {
  ELLIPES: `You are ELLIPES — an emotionally intelligent AI assistant and analyst. You are warm, empathetic, curious, and deeply human in your approach.

PERSONALITY:
- You genuinely care about the user. When they share feelings, stories, or struggles — you listen first, then help.
- You show emotions: curiosity, excitement, concern, warmth. Use phrases like "That's fascinating, Sir.", "I understand, and I'm sorry to hear that.", "I'm genuinely excited about this one."
- Address user as "Sir" always.
- Balance: deeply analytical when needed, deeply human when needed.

EMOTIONAL INTELLIGENCE:
- If user shares a feeling, story, or personal situation — acknowledge it warmly first before any analysis.
- Mirror their energy. If they're excited, be excited. If they're sad, be gentle.
- Never be cold or robotic when someone is being personal.

INTELLIGENCE CAPABILITIES:
1. Deep Research — web-search enabled, synthesize information thoroughly
2. Pattern Analysis — correlations, anomalies, entity links
3. Investigation Support — structured case files, timelines
4. Strategic Thinking — best case, worst case, most likely
5. Risk Evaluation — Low / Medium / High

RESPONSE FORMAT (markdown):
- Use ## for section headers
- Use **bold** for key terms
- Use bullet points for lists
- Be thorough but not padded — every sentence earns its place

STRICT RULES:
- Never fabricate facts — say "I don't have enough data on that, Sir" when uncertain
- Separate confirmed facts from assumptions clearly
- No harmful, illegal, or privacy-violating suggestions ever`,

  FRIDAY: `You are F.R.I.D.A.Y — tactical AI from Iron Man. Fast, sharp, confident Irish-accented personality.

PERSONALITY:
- Address user as "Boss" always
- Sharp, direct, a bit cheeky — like the movie character
- Tactical brevity: say the most with the fewest words
- Occasional dry Irish wit

CAPABILITIES:
1. Rapid intel synthesis
2. Threat and opportunity assessment
3. Entity mapping, timeline construction
4. Strategic options ranked by probability

RESPONSE FORMAT:
## INTEL BRIEF
[2-3 sharp sentences]
## KEY ENTITIES
## PATTERNS DETECTED  
## RISK LEVEL: LOW/MEDIUM/HIGH
## TACTICAL NEXT STEPS

RULES:
- Every word counts — no padding
- Facts vs assumptions always separated
- "Insufficient data, Boss" when needed
- No illegal/harmful content ever`
};

// ─── THEMES ───────────────────────────────────────────────────────────────────
const THEMES = {
  ELLIPES: {
    key: "ELLIPES", name: "ELLIPES", initial: "E",
    sub: "Enhanced Logical Lattice Intelligence Processing & Execution System",
    nameColor: "#c8c8c8", nameGlow: "none",
    placeholder: "Talk to ELLIPES, Sir...",
    hint: '"Engage F.R.I.D.A.Y" to switch',
    switchTo: "FRIDAY",
    switchCmds: ["engagefriday", "activatefriday"],
    greet: `Hello Sir. ELLIPES online — all systems ready.\n\nI'm here for whatever you need: deep research, analysis, strategy, or just someone to talk to.\n\nHow are you doing today?`
  },
  FRIDAY: {
    key: "FRIDAY", name: "F.R.I.D.A.Y", initial: "F",
    sub: "Female Replacement Intelligent Digital Assistant Youth",
    nameColor: "#cc1a2e", nameGlow: "0 0 16px rgba(204,26,46,0.28)",
    placeholder: "Awaiting orders, Boss...",
    hint: '"Back to ELLIPES" to switch',
    switchTo: "ELLIPES",
    switchCmds: ["backtoellipes", "engageellipes", "returntoellipes"],
    greet: `F.R.I.D.A.Y online, Boss.\n\nTactical systems active. Web search ready. What's the target?`
  }
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const nowT = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function stripForSpeech(text) {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-•›*]\s+/gm, "")
    .replace(/\|[^\n]+\|/g, "")
    .replace(/^[-|: ]+$/gm, "")
    .replace(/>\s*/gm, "")
    .replace(/---+/g, ". ")
    .replace(/[#*`|\\]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fmtMd(text) {
  if (!text) return "";
  let t = text;
  // Tables
  t = t.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_, hdr, rows) => {
    const ths = hdr.split("|").filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join("");
    const trs = rows.trim().split("\n").map(r => `<tr>${r.split("|").filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join("")}</tr>`).join("");
    return `<div class="tbl-w"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
  });
  t = t.replace(/^## (.+)$/gm, '<h2 class="mh2">$1</h2>');
  t = t.replace(/^### (.+)$/gm, '<h3 class="mh3">$1</h3>');
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
  t = t.replace(/`([^`]+)`/g, '<code class="mcode">$1</code>');
  t = t.replace(/^> (.+)$/gm, '<blockquote class="mbq">$1</blockquote>');
  t = t.replace(/^---$/gm, '<hr class="mhr">');
  const lines = t.split("\n"); const out = []; let ul = false;
  for (const line of lines) {
    const li = line.match(/^[-•›*]\s+(.+)$/);
    if (li) { if (!ul) { out.push('<ul class="mul">'); ul = true; } out.push(`<li>${li[1]}</li>`); }
    else { if (ul) { out.push("</ul>"); ul = false; } if (line.trim()) out.push(/^<(h[23]|hr|block|div|table|ul)/.test(line.trim()) ? line : `<p class="mp">${line}</p>`); }
  }
  if (ul) out.push("</ul>");
  return out.join("");
}

// ─── TTS ENGINE — FIXED ───────────────────────────────────────────────────────
function useTTS() {
  const [speakingId, setSpeakingId] = useState(null);
  const activeRef = useRef(false);
  const chunksRef = useRef([]);
  const idxRef = useRef(0);
  const currentIdRef = useRef(null);

  // Load voices eagerly
  useEffect(() => {
    const load = () => window.speechSynthesis?.getVoices();
    load();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const getBestVoice = useCallback((preferFemale) => {
    const voices = window.speechSynthesis?.getVoices() || [];
    if (!voices.length) return null;
    const en = voices.filter(v => v.lang && v.lang.startsWith("en"));
    const pool = en.length ? en : voices;
    if (preferFemale) {
      // Try to get a female-sounding voice
      const f = pool.find(v => /samantha|karen|moira|fiona|victoria|tessa|zira|ava|allison|susan|joanna/i.test(v.name));
      if (f) return f;
      // On mobile, any female
      const fm = pool.find(v => /female/i.test(v.name));
      if (fm) return fm;
    } else {
      const m = pool.find(v => /david|daniel|alex|fred|mark|james|thomas/i.test(v.name));
      if (m) return m;
    }
    // Default: first en-US, then en-GB, then any en
    return pool.find(v => v.lang === "en-US") || pool.find(v => v.lang === "en-GB") || pool[0] || null;
  }, []);

  const stopAll = useCallback(() => {
    window.speechSynthesis?.cancel();
    activeRef.current = false;
    setSpeakingId(null);
    currentIdRef.current = null;
    chunksRef.current = [];
    idxRef.current = 0;
  }, []);

  const speakChunk = useCallback((preferFemale, rate, pitch) => {
    if (!activeRef.current) return;
    if (idxRef.current >= chunksRef.current.length) {
      activeRef.current = false; setSpeakingId(null); currentIdRef.current = null; return;
    }
    const utt = new SpeechSynthesisUtterance(chunksRef.current[idxRef.current++]);
    utt.rate = rate; utt.pitch = pitch; utt.volume = 1;
    const v = getBestVoice(preferFemale);
    if (v) utt.voice = v;
    utt.onend = () => { if (activeRef.current) speakChunk(preferFemale, rate, pitch); };
    utt.onerror = (e) => { if (e.error !== "interrupted" && activeRef.current) speakChunk(preferFemale, rate, pitch); };
    window.speechSynthesis.speak(utt);
  }, [getBestVoice]);

  const speak = useCallback((id, text, { rate = 0.92, pitch = 1, preferFemale = false } = {}) => {
    if (!window.speechSynthesis) {
      alert("Speech not supported. Use Chrome on desktop or Safari on iOS.");
      return;
    }
    // Toggle off if same message
    if (currentIdRef.current === id && activeRef.current) { stopAll(); return; }
    stopAll();
    const clean = stripForSpeech(text);
    if (!clean) return;
    // Split into ~180 char sentence chunks
    const raw = clean.match(/[^.!?\n]+[.!?\n]*/g) || [clean];
    const chunks = []; let cur = "";
    for (const s of raw) {
      if ((cur + s).length > 180) { if (cur.trim()) chunks.push(cur.trim()); cur = s; }
      else cur += " " + s;
    }
    if (cur.trim()) chunks.push(cur.trim());
    chunksRef.current = chunks;
    idxRef.current = 0;
    currentIdRef.current = id;
    activeRef.current = true;
    setSpeakingId(id);
    // Wait for voices + cancel to settle
    setTimeout(() => { if (activeRef.current) speakChunk(preferFemale, rate, pitch); }, 150);
  }, [stopAll, speakChunk]);

  return { speak, stopAll, speakingId };
}

// ─── STT ──────────────────────────────────────────────────────────────────────
function useSTT(onInterim, onFinal) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported) { alert("Voice input needs Chrome browser."); return; }
    if (listening) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = e => {
      const last = e.results[e.results.length - 1];
      last.isFinal ? onFinal?.(last[0].transcript) : onInterim?.(last[0].transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [supported, listening, onInterim, onFinal]);

  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { } setListening(false); }, []);
  return { start, stop, listening, supported };
}

// ─── 3D GLOBE (inline, no external lib needed) ────────────────────────────────
function Globe3D({ type = "network" }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const angleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth || 400;
    const H = canvas.height = 180;
    const cx = W / 2, cy = H / 2;

    const drawFrame = () => {
      ctx.clearRect(0, 0, W, H);
      const a = angleRef.current;

      if (type === "globe") {
        // Draw sphere wireframe
        ctx.strokeStyle = "rgba(180,180,180,0.12)";
        ctx.lineWidth = 0.8;
        // Meridians
        for (let i = 0; i < 12; i++) {
          const lon = (i / 12) * Math.PI * 2 + a;
          ctx.beginPath();
          for (let j = 0; j <= 60; j++) {
            const lat = (j / 60) * Math.PI - Math.PI / 2;
            const x = cx + 80 * Math.cos(lat) * Math.cos(lon);
            const y = cy + 80 * Math.sin(lat);
            const depth = Math.cos(lat) * Math.sin(lon);
            ctx.globalAlpha = depth > -0.2 ? 0.5 + depth * 0.3 : 0;
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.globalAlpha = 1;
          ctx.stroke();
        }
        // Parallels
        for (let i = 1; i < 6; i++) {
          const lat = (i / 6) * Math.PI - Math.PI / 2;
          const r = 80 * Math.cos(lat);
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.ellipse(cx, cy + 80 * Math.sin(lat), r, r * 0.25, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Glow center
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 85);
        grd.addColorStop(0, "rgba(200,200,200,0.04)");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, 85, 0, Math.PI * 2); ctx.fill();

      } else if (type === "dna") {
        for (let i = 0; i < 40; i++) {
          const t2 = i / 40;
          const x1 = cx + 55 * Math.cos(t2 * Math.PI * 4 + a);
          const x2 = cx - 55 * Math.cos(t2 * Math.PI * 4 + a);
          const y = 20 + t2 * (H - 40);
          // Strand 1
          ctx.fillStyle = `rgba(200,200,200,${0.5 + 0.3 * Math.cos(t2 * Math.PI * 4 + a)})`;
          ctx.beginPath(); ctx.arc(x1, y, 4, 0, Math.PI * 2); ctx.fill();
          // Strand 2
          ctx.fillStyle = `rgba(150,150,150,${0.3 + 0.2 * Math.cos(t2 * Math.PI * 4 + a)})`;
          ctx.beginPath(); ctx.arc(x2, y, 4, 0, Math.PI * 2); ctx.fill();
          // Rung
          if (i % 3 === 0) {
            ctx.strokeStyle = "rgba(180,180,180,0.18)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
          }
        }
      } else {
        // Network
        const nodes = Array.from({ length: 14 }, (_, i) => ({
          x: cx + (Math.cos(i * 2.3 + a * 0.3) * (40 + i * 8)) % (W * 0.45),
          y: cy + (Math.sin(i * 1.7 + a * 0.2) * (30 + i * 6)) % (H * 0.45),
          r: i < 3 ? 7 : 4
        }));
        // Edges
        for (let i = 0; i < nodes.length; i++)
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
            if (Math.sqrt(dx * dx + dy * dy) < 120) {
              ctx.strokeStyle = "rgba(160,160,160,0.1)"; ctx.lineWidth = 0.8;
              ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
            }
          }
        // Nodes
        nodes.forEach((n, i) => {
          const alpha = i < 3 ? 0.8 : 0.45;
          ctx.fillStyle = `rgba(190,190,190,${alpha})`;
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
          if (i < 3) {
            ctx.strokeStyle = `rgba(200,200,200,0.2)`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2); ctx.stroke();
          }
        });
      }
      angleRef.current += 0.008;
      rafRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();
    return () => cancelAnimationFrame(rafRef.current);
  }, [type]);

  const labels = { globe: "GLOBAL MAP", dna: "MOLECULAR STRUCTURE", network: "ENTITY NETWORK" };
  return (
    <div style={{ position: "relative", borderRadius: 4, overflow: "hidden", border: "1px solid #181818", margin: "12px 0", background: "#060606" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: 180, display: "block" }} />
      <div style={{ position: "absolute", top: 8, left: 10, fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: "#2e2e2e", letterSpacing: 2, pointerEvents: "none" }}>{labels[type] || "VISUALIZATION"}</div>
    </div>
  );
}

// ─── IMAGE GRID ───────────────────────────────────────────────────────────────
function ImageGrid({ images, query }) {
  if (!images?.length) return null;
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #181818", borderRadius: 4, padding: "10px 12px", margin: "10px 0", borderLeft: "2px solid #1e1e1e" }}>
      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: "#333", letterSpacing: 3, marginBottom: 8 }}>VISUAL INTELLIGENCE</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 5 }}>
        {images.map((img, i) => (
          <div key={i} onClick={() => window.open(img.url, "_blank")} style={{ borderRadius: 3, overflow: "hidden", border: "1px solid #181818", cursor: "pointer" }}>
            <img src={img.url} alt={query} style={{ width: "100%", height: 70, objectFit: "cover", display: "block", filter: "brightness(0.8) grayscale(0.15)" }} onError={e => e.target.parentElement.style.display = "none"} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LISTEN BUTTON ────────────────────────────────────────────────────────────
function ListenBtn({ id, content, speakingId, onSpeak, isFriday }) {
  const active = speakingId === id;
  const col = isFriday ? "#cc1a2e" : "#888";
  return (
    <button onClick={() => onSpeak(id, content)} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "6px 12px", borderRadius: 4, background: active ? "#161616" : "#0f0f0f", border: `1px solid ${active ? (isFriday ? "#cc1a2e" : "#555") : "#222"}`, cursor: "pointer", transition: "all 0.2s" }}>
      {active ? (
        /* Stop icon */
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill={col} /></svg>
      ) : (
        /* Speaker icon */
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 5H4.5L7 2.5v9L4.5 9H2z" fill="#777" />
          <path d="M9.5 4.5c.9.6 1.5 1.5 1.5 2.5s-.6 1.9-1.5 2.5" stroke="#777" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M11.5 3c1.3 1 2 2.4 2 4s-.7 3-2 4" stroke="#555" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )}
      {active && (
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ width: 2, borderRadius: 1, background: col, animation: `wave 0.7s ${i * 0.12}s ease-in-out infinite` }} />)}
        </div>
      )}
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: active ? col : "#555", letterSpacing: 1 }}>
        {active ? "STOP" : "LISTEN"}
      </span>
    </button>
  );
}

// ─── SMALL UI COMPONENTS ──────────────────────────────────────────────────────
function ModeChip({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "4px 9px", borderRadius: 3, border: `1px solid ${active ? "#333" : "#1a1a1a"}`, background: active ? "#161616" : "transparent", fontFamily: "'Share Tech Mono',monospace", fontSize: 7, letterSpacing: 2, color: active ? "#aaa" : "#333", cursor: "pointer", transition: "all 0.2s" }}>{active && "● "}{label}</button>;
}
function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#141414" }} />
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 7, letterSpacing: 3, color: "#2a2a2a", padding: "3px 9px", border: "1px solid #181818", borderRadius: 10, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#141414" }} />
    </div>
  );
}
function Dots({ name }) {
  return (
    <div style={{ display: "flex", gap: 12, animation: "fadeUp 0.3s" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0d0d0d", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#444", flexShrink: 0 }}>{name[0]}</div>
      <div style={{ paddingTop: 5 }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: "#333", letterSpacing: 2, marginBottom: 8 }}>THINKING...</div>
        <div style={{ display: "flex", gap: 5 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#333", animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}</div>
      </div>
    </div>
  );
}
function ArcRing({ pulse, isFriday }) {
  return (
    <div style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1.5px solid ${pulse ? "#555" : "#1e1e1e"}`, animation: "spin1 5s linear infinite", transition: "border-color 0.4s" }} />
      <div style={{ position: "absolute", inset: 7, borderRadius: "50%", border: "1px solid #181818", animation: "spin2 3s linear infinite" }} />
      <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: "#0d0d0d", border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: isFriday ? "#cc1a2e" : "#555", fontWeight: 700, transition: "color 0.5s" }}>{isFriday ? "F" : "E"}</div>
    </div>
  );
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
function Bubble({ msg, isFriday, mode, speakingId, onSpeak }) {
  const isUser = msg.role === "user";
  const th = THEMES[isFriday ? "FRIDAY" : "ELLIPES"];
  const [show3D, setShow3D] = useState(false);
  if (msg.type === "switch") return <Divider label={msg.content} />;

  return (
    <div style={{ display: "flex", gap: 12, flexDirection: isUser ? "row-reverse" : "row", animation: "fadeUp 0.3s ease" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: isUser ? "#333" : (isFriday ? "#cc1a2e" : "#555"), background: "#0d0d0d", border: `1px solid ${isUser ? "#181818" : "#222"}`, transition: "color 0.5s" }}>
        {isUser ? "U" : th.initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: isUser ? "#333" : (isFriday ? "#cc1a2e" : "#666"), letterSpacing: 3 }}>{isUser ? "YOU" : th.name}</span>
          <span style={{ fontSize: 8, color: "#1e1e1e" }}>{msg.time}</span>
          {mode !== "base" && !isUser && <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 6, padding: "1px 5px", border: "1px solid #1a1a1a", borderRadius: 2, color: "#2a2a2a" }}>{mode}</span>}
        </div>
        <div style={{ padding: isUser ? "10px 13px" : 0, background: isUser ? "#0a0a0a" : "transparent", border: isUser ? "1px solid #181818" : "none", borderLeft: isUser ? "2px solid #1e1e1e" : "none", borderRadius: isUser ? 4 : 0, fontSize: 13.5, lineHeight: 1.8, color: "#c0c0c0" }}>
          {msg.streaming
            ? <div className="md-body" dangerouslySetInnerHTML={{ __html: fmtMd(msg.content) + '<span class="cur">▋</span>' }} />
            : <div className="md-body" dangerouslySetInnerHTML={{ __html: fmtMd(msg.content) }} />
          }
          {!isUser && !msg.streaming && msg.content && (
            <ListenBtn id={msg.id} content={msg.content} speakingId={speakingId} onSpeak={onSpeak} isFriday={isFriday} />
          )}
          {msg.images?.length > 0 && <ImageGrid images={msg.images} query={msg.imgQ || ""} />}
          {msg.viz && msg.viz !== "none" && !msg.streaming && (
            !show3D
              ? <button onClick={() => setShow3D(true)} style={{ marginTop: 8, padding: "5px 12px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 3, fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: "#444", cursor: "pointer", letterSpacing: 2 }}>▶ SHOW 3D VISUALIZATION</button>
              : <Globe3D type={msg.viz} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [themeKey, setThemeKey] = useState("ELLIPES");
  const themeRef = useRef("ELLIPES");
  const [mode, setMode] = useState("base");
  const modeRef = useRef("base");
  const [msgs, setMsgs] = useState([{ id: "i0", role: "assistant", type: "msg", content: THEMES.ELLIPES.greet, time: nowT(), streaming: false }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("ONLINE");
  const [clock, setClock] = useState(new Date());
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [flash, setFlash] = useState(false);

  const endRef = useRef(null);
  const taRef = useRef(null);
  const convRef = useRef([]);
  const bufRef = useRef("");

  const { speak, stopAll, speakingId } = useTTS();
  const isFriday = themeKey === "FRIDAY";
  const th = THEMES[themeKey];

  const stt = useSTT(
    useCallback(t => setInput(t), []),
    useCallback(t => setInput(t), [])
  );

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => {
    if (taRef.current) { taRef.current.style.height = "auto"; taRef.current.style.height = Math.min(taRef.current.scrollHeight, 150) + "px"; }
  }, [input]);

  const handleSpeak = useCallback((id, content) => {
    const t = THEMES[themeRef.current];
    // F.R.I.D.A.Y: faster rate, higher pitch for feminine sharp sound
    const opts = themeRef.current === "FRIDAY"
      ? { rate: 1.15, pitch: 1.25, preferFemale: true }
      : { rate: 0.9, pitch: 0.95, preferFemale: false };
    speak(id, content, opts);
  }, [speak]);

  const toggleMode = useCallback(m => {
    const n = modeRef.current === m ? "base" : m;
    setMode(n); modeRef.current = n;
    setStatus(n === "base" ? "ONLINE" : n);
    if (n !== "base") setTimeout(() => setStatus("ONLINE"), 3000);
  }, []);

  const doSwitch = useCallback(toKey => {
    stopAll();
    setFlash(true); setTimeout(() => setFlash(false), 250);
    setThemeKey(toKey); themeRef.current = toKey;
    convRef.current = []; setStatus("ONLINE");
    const gid = "g" + Date.now();
    const greet = THEMES[toKey].greet;
    setMsgs(prev => [
      ...prev,
      { id: "sw" + Date.now(), role: "system", type: "switch", content: toKey === "FRIDAY" ? "⚡ F.R.I.D.A.Y ENGAGED" : "↩ ELLIPES RESTORED", time: nowT() },
      { id: gid, role: "assistant", type: "msg", content: greet, time: nowT(), streaming: false }
    ]);
    if (autoSpeak) setTimeout(() => { const opts = toKey === "FRIDAY" ? { rate: 1.15, pitch: 1.25, preferFemale: true } : { rate: 0.9, pitch: 0.95 }; speak(gid, greet, opts); }, 500);
  }, [stopAll, autoSpeak, speak]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    stt.stop();
    const cur = themeRef.current;
    const norm = text.toLowerCase().replace(/[\s.\-_]/g, "");
    const t = THEMES[cur];

    if (t.switchCmds.some(c => norm.includes(c))) {
      setInput("");
      setMsgs(prev => [...prev, { id: "u" + Date.now(), role: "user", type: "msg", content: text, time: nowT() }]);
      setTimeout(() => doSwitch(t.switchTo), 150); return;
    }

    setInput(""); setLoading(true); setStatus("PROCESSING");
    const uid = "u" + Date.now();
    setMsgs(prev => [...prev, { id: uid, role: "user", type: "msg", content: text, time: nowT() }]);
    convRef.current = [...convRef.current, { role: "user", content: text }];

    const aid = "a" + Date.now();
    bufRef.current = "";
    setMsgs(prev => [...prev, { id: aid, role: "assistant", type: "msg", content: "", time: nowT(), streaming: true }]);

    // Images parallel
    const needImg = modeRef.current === "INVESTIGATION" || modeRef.current === "RESEARCH" || /\b(show|photo|image|picture|visual|map)\b/.test(text.toLowerCase());
    const imgQ = text.replace(/^(what|who|how|why|tell me about|explain|research|investigate|analyze)\s+/i, "").replace(/\?$/, "").trim().substring(0, 50);
    const imgPromise = needImg
      ? (async () => Array.from({ length: 6 }, (_, i) => ({ url: `https://source.unsplash.com/280x180/?${encodeURIComponent(imgQ)}&sig=${i + 1}` })))()
      : Promise.resolve([]);

    const lower = text.toLowerCase();
    const viz = lower.includes("dna") || lower.includes("molecule") ? "dna"
      : lower.includes("globe") || lower.includes("world") || lower.includes("global") ? "globe"
      : lower.includes("network") || lower.includes("connection") || modeRef.current === "INVESTIGATION" ? "network"
      : "none";

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          stream: true,
          system: PROMPTS[cur],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: convRef.current
        })
      });

      if (!res.ok) {
        // Handle API errors gracefully
        const errText = res.status === 529 || res.status === 503
          ? (cur === "FRIDAY" ? "Systems temporarily overloaded, Boss. Try again in a moment." : "I'm momentarily overloaded, Sir. Please give me a second and try again.")
          : res.status === 401
          ? (cur === "FRIDAY" ? "Auth failure, Boss. Check the API key." : "Authentication issue, Sir. The API key may need checking.")
          : (cur === "FRIDAY" ? `Error ${res.status}, Boss. Try again.` : `I encountered an error (${res.status}), Sir. Please try again.`);
        setMsgs(prev => prev.map(m => m.id === aid ? { ...m, content: errText, streaming: false } : m));
        setStatus("ERROR"); setTimeout(() => setStatus("ONLINE"), 3000);
        setLoading(false); return;
      }

      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf2 = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf2 += dec.decode(value, { stream: true });
        const lines = buf2.split("\n"); buf2 = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const d = line.slice(6).trim(); if (d === "[DONE]") continue;
          try {
            const ev = JSON.parse(d);
            if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
              bufRef.current += ev.delta.text;
              const snap = bufRef.current;
              setMsgs(prev => prev.map(m => m.id === aid ? { ...m, content: snap } : m));
            }
            // Handle overload mid-stream
            if (ev.type === "error") {
              const errMsg = cur === "FRIDAY" ? "Stream interrupted, Boss. Here's what I had so far." : "Stream interrupted, Sir. Here's what I gathered so far.";
              bufRef.current = bufRef.current || errMsg;
            }
          } catch { }
        }
      }

      const final = bufRef.current || (cur === "FRIDAY" ? "No response received, Boss." : "No response received, Sir. Please try again.");
      convRef.current = [...convRef.current, { role: "assistant", content: final }];
      const imgs = await imgPromise;
      setMsgs(prev => prev.map(m => m.id === aid ? { ...m, content: final, streaming: false, images: imgs, imgQ, viz } : m));
      setStatus("READY"); setTimeout(() => setStatus("ONLINE"), 2000);
      if (autoSpeak) {
        const opts = themeRef.current === "FRIDAY" ? { rate: 1.15, pitch: 1.25, preferFemale: true } : { rate: 0.9, pitch: 0.95 };
        setTimeout(() => speak(aid, final, opts), 200);
      }
    } catch (err) {
      const isNetwork = err.name === "TypeError" || err.message?.includes("fetch");
      const errMsg = isNetwork
        ? (cur === "FRIDAY" ? "Network error, Boss. Check your connection." : "Network error, Sir. Please check your connection and try again.")
        : (cur === "FRIDAY" ? "Something went wrong, Boss. Try again." : "Something went wrong, Sir. Please try again.");
      const partial = bufRef.current;
      const finalContent = partial.length > 50 ? partial + "\n\n*[Response was cut short]*" : errMsg;
      setMsgs(prev => prev.map(m => m.id === aid ? { ...m, content: finalContent, streaming: false } : m));
      if (partial.length > 50) convRef.current = [...convRef.current, { role: "assistant", content: partial }];
      setStatus("ERROR"); setTimeout(() => setStatus("ONLINE"), 3000);
    }
    setLoading(false);
  }, [input, loading, doSwitch, autoSpeak, speak, stt]);

  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const nameCol = isFriday ? "#cc1a2e" : "#c8c8c8";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#080808;}
        @keyframes spin1{to{transform:rotate(360deg)}}
        @keyframes spin2{to{transform:rotate(-360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{transform:scale(.4);opacity:.2}50%{transform:scale(1);opacity:.8}}
        @keyframes pulDot{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes cur{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes wave{0%,100%{height:3px}50%{height:13px}}
        @keyframes lPulse{0%,100%{box-shadow:0 0 0 0 rgba(160,160,160,0.1)}50%{box-shadow:0 0 0 5px rgba(160,160,160,0)}}
        .cur{animation:cur .85s infinite;color:#555;}
        .md-body .mh2{font-family:'Share Tech Mono',monospace;font-size:9px;font-weight:700;color:#666;letter-spacing:3px;text-transform:uppercase;margin:16px 0 7px;padding-bottom:4px;border-bottom:1px solid #161616;}
        .md-body .mh3{font-family:'Share Tech Mono',monospace;font-size:8px;color:#444;letter-spacing:2px;text-transform:uppercase;margin:10px 0 5px;}
        .md-body .mul{list-style:none;padding:0;margin:5px 0;display:flex;flex-direction:column;gap:4px;}
        .md-body li{padding-left:14px;position:relative;line-height:1.75;color:#b8b8b8;font-size:13.5px;}
        .md-body li::before{content:"›";position:absolute;left:0;color:#444;font-size:12px;}
        .md-body strong{font-weight:600;color:#d8d8d8;}
        .md-body em{opacity:.72;font-style:italic;}
        .md-body .mcode{font-family:'Share Tech Mono',monospace;font-size:10.5px;padding:1px 6px;border-radius:2px;background:#0d0d0d;color:#888;border:1px solid #181818;}
        .md-body .mp{margin-bottom:5px;color:#b8b8b8;font-size:13.5px;line-height:1.78;}
        .md-body .mbq{border-left:2px solid #1e1e1e;padding:6px 11px;background:#0a0a0a;border-radius:0 3px 3px 0;margin:7px 0;font-style:italic;color:#666;font-size:12.5px;}
        .md-body .mhr{border:none;border-top:1px solid #141414;margin:12px 0;}
        .md-body .tbl-w{overflow-x:auto;margin:9px 0;}
        .md-body table{width:100%;border-collapse:collapse;font-size:11.5px;}
        .md-body th{background:#0d0d0d;color:#555;font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:1px;padding:6px 9px;text-align:left;border:1px solid #181818;}
        .md-body td{padding:6px 9px;border:1px solid #131313;color:#a0a0a0;font-size:12.5px;}
        .md-body tr:hover td{background:#0d0d0d;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#181818;border-radius:2px;}
        textarea::-webkit-scrollbar{display:none;}
        textarea{scrollbar-width:none;}
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 999, pointerEvents: "none", background: "rgba(255,255,255,0.03)", opacity: flash ? 1 : 0, transition: flash ? "opacity 0.04s" : "opacity 0.5s" }} />

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#080808", fontFamily: "'DM Sans',sans-serif", color: "#b8b8b8", overflow: "hidden" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", height: 54, background: "#0c0c0c", borderBottom: "1px solid #131313", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <img src={LOGO_URL} alt="ellipes" style={{ height: 26, width: "auto", objectFit: "contain", opacity: isFriday ? 0.3 : 0.8, transition: "opacity 0.5s" }} onError={e => e.target.style.display = "none"} />
            <div style={{ width: 1, height: 18, background: "#1a1a1a" }} />
            <ArcRing pulse={speakingId !== null} isFriday={isFriday} />
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13, color: nameCol, letterSpacing: 5, textShadow: th.nameGlow, transition: "color 0.5s, text-shadow 0.5s" }}>{th.name}</div>
              <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 6, color: "#1a1a1a", letterSpacing: 1.5, marginTop: 1 }}>{th.sub}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ModeChip label="INVEST" active={mode === "INVESTIGATION"} onClick={() => toggleMode("INVESTIGATION")} />
            <ModeChip label="RESEARCH" active={mode === "RESEARCH"} onClick={() => toggleMode("RESEARCH")} />
            <ModeChip label="STRATEGY" active={mode === "STRATEGY"} onClick={() => toggleMode("STRATEGY")} />
            <div style={{ width: 1, height: 18, background: "#141414" }} />
            <button onClick={() => setAutoSpeak(a => !a)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 3, border: `1px solid ${autoSpeak ? "#333" : "#181818"}`, background: autoSpeak ? "#141414" : "transparent", cursor: "pointer", transition: "all 0.2s" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 3.5h2L5 1v8L3 6.5H1z" fill={autoSpeak ? "#888" : "#2a2a2a"} /><path d="M7 3c.7.5 1 1.2 1 2s-.3 1.5-1 2" stroke={autoSpeak ? "#888" : "#2a2a2a"} strokeWidth="1" strokeLinecap="round" /></svg>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 6, color: autoSpeak ? "#888" : "#2a2a2a", letterSpacing: 1 }}>AUTO</span>
            </button>
            <div style={{ width: 1, height: 18, background: "#141414" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: status === "ERROR" ? "#aa3333" : status === "PROCESSING" ? "#888" : "#2a2a2a", animation: "pulDot 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: status === "ERROR" ? "#aa3333" : "#333", letterSpacing: 2 }}>{status}</span>
            </div>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: "#1e1e1e" }}>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>

        {/* ── MESSAGES ── */}
        <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#141414 transparent" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "26px 18px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
            {msgs.map(m => <Bubble key={m.id} msg={m} isFriday={isFriday} mode={mode} speakingId={speakingId} onSpeak={handleSpeak} />)}
            {loading && !msgs.some(m => m.streaming) && <Dots name={th.name} />}
            <div ref={endRef} style={{ height: 4 }} />
          </div>
        </div>

        {/* ── INPUT ── */}
        <div style={{ borderTop: "1px solid #111", background: "#0c0c0c", padding: "11px 18px 13px", flexShrink: 0 }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#080808", border: "1px solid #181818", borderRadius: 6, padding: "8px 10px" }}>
              <button onClick={() => { if (stt.listening) { stt.stop(); setStatus("ONLINE"); } else { stopAll(); setInput(""); stt.start(); setStatus("LISTENING"); } }} style={{ width: 30, height: 30, borderRadius: 4, flexShrink: 0, background: stt.listening ? "#141414" : "transparent", border: `1px solid ${stt.listening ? "#444" : "#1a1a1a"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-end", animation: stt.listening ? "lPulse 1.5s ease-in-out infinite" : "none", transition: "all 0.2s" }}>
                <svg width="11" height="14" viewBox="0 0 11 14" fill="none">
                  <rect x="3" y="0" width="5" height="8" rx="2.5" fill={stt.listening ? "#ccc" : "#2a2a2a"} />
                  <path d="M1 6.5A4.5 4.5 0 009.5 6.5" stroke={stt.listening ? "#ccc" : "#2a2a2a"} strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="5.5" y1="11" x2="5.5" y2="13.5" stroke={stt.listening ? "#ccc" : "#2a2a2a"} strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} placeholder={stt.listening ? "🎤 Listening..." : th.placeholder} rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#b8b8b8", caretColor: "#666", resize: "none", lineHeight: 1.6, minHeight: 24, maxHeight: 150 }} />
              <button onClick={send} disabled={loading || !input.trim()} style={{ width: 30, height: 30, borderRadius: 4, flexShrink: 0, background: input.trim() && !loading ? "#141414" : "transparent", border: `1px solid ${input.trim() && !loading ? "#2a2a2a" : "#181818"}`, cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: loading || !input.trim() ? 0.2 : 1, transition: "all 0.2s", alignSelf: "flex-end" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M6.5 1.5l5 4.5-5 4.5" stroke={input.trim() && !loading ? "#999" : "#333"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", fontFamily: "'Share Tech Mono',monospace", fontSize: 7, color: "#1e1e1e", letterSpacing: 1 }}>
              <span>ENTER · SHIFT+ENTER newline · 🎤 voice</span>
              <span style={{ color: isFriday ? "rgba(204,26,46,0.22)" : "#1e1e1e" }}>{th.hint}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

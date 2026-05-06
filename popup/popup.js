import { getProfile, getPainPointsGuide, getLlmConfig } from "../lib/storage.js";
import { analyze } from "../lib/llm.js";

const MODEL_OPTIONS = {
  gemini: [
    { value: "gemini-2.5-flash",      label: "Gemini 2.5 Flash (기본, 무료)" },
    { value: "gemini-2.5-pro",        label: "Gemini 2.5 Pro (무료)" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (빠름, 무료)" },
  ],
  claude: [
    { value: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6 (기본)" },
    { value: "claude-opus-4-7",           label: "Claude Opus 4.7 (고성능)" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (빠름)" },
  ],
  openai: [
    { value: "gpt-4o",      label: "GPT-4o (기본)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (빠름/저렴)" },
    { value: "o3-mini",     label: "o3-mini (추론 특화)" },
  ],
};

// 설정
const providerEl      = document.getElementById("provider");
const llmModelEl      = document.getElementById("llmModel");
const apiKeyEl        = document.getElementById("apiKey");
const toggleApiKeyBtn = document.getElementById("toggleApiKey");
const eyeOpen         = document.getElementById("eyeOpen");
const eyeClosed       = document.getElementById("eyeClosed");
const llmToast        = document.getElementById("llmToast");

// 프로필
const profileRawEl = document.getElementById("profileRaw");
const profileToast = document.getElementById("profileToast");

// 분석
const analyzeBtn = document.getElementById("analyzeBtn");
const resultEl   = document.getElementById("result");

// ── 초기 로드 ──────────────────────────────────────────────

async function init() {
  const [profile, llm] = await Promise.all([getProfile(), getLlmConfig()]);
  if (profile?.raw) profileRawEl.value = profile.raw;
  const provider = llm?.provider ?? "gemini";
  providerEl.value = provider;
  updateModelOptions(provider, llm?.model ?? "");
  apiKeyEl.value = llm?.apiKey ?? "";
}

// ── 패널 토글 ──────────────────────────────────────────────

function initToggle(headerId, bodyId, defaultOpen = true) {
  const header = document.getElementById(headerId);
  const body   = document.getElementById(bodyId);
  function setOpen(open) {
    header.classList.toggle("open", open);
    body.classList.toggle("hidden", !open);
  }
  setOpen(defaultOpen);
  header.addEventListener("click", () => setOpen(!header.classList.contains("open")));
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!header.classList.contains("open")); }
  });
}

initToggle("settingsToggle", "settingsBody", true);
initToggle("profileToggle",  "profileBody",  true);

// ── 설정 자동 저장 ─────────────────────────────────────────

function updateModelOptions(provider, savedModel) {
  const options = MODEL_OPTIONS[provider] ?? [];
  llmModelEl.innerHTML = options
    .map(o => `<option value="${o.value}"${o.value === savedModel ? " selected" : ""}>${o.label}</option>`)
    .join("");
  if (savedModel && !options.find(o => o.value === savedModel)) {
    llmModelEl.insertAdjacentHTML("afterbegin", `<option value="${savedModel}" selected>${savedModel}</option>`);
  }
}

async function saveLlmSettings() {
  await chrome.storage.local.set({
    llm: { provider: providerEl.value, model: llmModelEl.value, apiKey: apiKeyEl.value.trim() },
  });
  showToast(llmToast);
}

providerEl.addEventListener("change", () => { updateModelOptions(providerEl.value, ""); saveLlmSettings(); });
llmModelEl.addEventListener("change", saveLlmSettings);
apiKeyEl.addEventListener("change", saveLlmSettings);

// ── API 키 표시 토글 ───────────────────────────────────────

toggleApiKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyEl.type === "password";
  apiKeyEl.type = isPassword ? "text" : "password";
  eyeOpen.classList.toggle("hidden", isPassword);
  eyeClosed.classList.toggle("hidden", !isPassword);
  toggleApiKeyBtn.setAttribute("aria-pressed", String(isPassword));
});

// ── 프로필 자동 저장 (디바운스) ────────────────────────────

let profileTimer = null;
profileRawEl.addEventListener("input", () => {
  clearTimeout(profileTimer);
  profileTimer = setTimeout(async () => {
    const profile = await getProfile() ?? {};
    await chrome.storage.local.set({ profile: { ...profile, raw: profileRawEl.value.trim() } });
    showToast(profileToast);
  }, 800);
});

// ── 분석 ───────────────────────────────────────────────────

analyzeBtn.addEventListener("click", async () => {
  resultEl.innerHTML = "";
  resultEl.classList.add("hidden");

  try {
    const profile = await getProfile();
    const profileText = profile?.raw ?? "";
    if (!profileText) {
      showCard("warn", "프로필 필요", "프로필을 먼저 입력해 주세요.");
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { showCard("error", "오류", "현재 탭을 찾을 수 없습니다."); return; }

    const [llmConfig, guide] = await Promise.all([getLlmConfig(), getPainPointsGuide()]);

    setLoading(true);

    // 페이지 텍스트 추출
    let jobText;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 20000),
      });
      jobText = result;
    } catch {
      showCard("error", "추출 실패", "이 페이지에서는 텍스트를 추출할 수 없습니다.\n(chrome:// 페이지 등은 지원하지 않습니다.)");
      return;
    }

    // LLM 분석
    const result = await analyze({ profile: profileText, guide: guide ?? "", jobText, llmConfig });

    // 페이지에 결과 주입
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pbotInjectResults,
      args: [result],
    });

  } catch (err) {
    showCard("error", "오류", err.message);
  } finally {
    setLoading(false);
  }
});

// ── 유틸 ───────────────────────────────────────────────────

function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.textContent = on ? "분석 중..." : "이 페이지 분석";
}

function showToast(el) {
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2000);
}

function showCard(type, label, body) {
  const card = document.createElement("div");
  const modifier = { error: " card--error", warn: " card--warn", fit: " card--fit" }[type] ?? "";
  card.className = `card${modifier}`;
  card.innerHTML = `<div class="card-label">${label}</div><div class="card-body">${escapeHtml(body)}</div>`;
  resultEl.appendChild(card);
  resultEl.classList.remove("hidden");
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
}

// ── 페이지 주입 함수 (executeScript로 실행 — 외부 스코프 참조 불가) ──────

function pbotInjectResults({ matches, fitnessPercent, fitnessReason }) {
  const COLORS = [
    { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
    { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
    { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
    { bg: "#ede9fe", border: "#8b5cf6", text: "#4c1d95" },
    { bg: "#fce7f3", border: "#ec4899", text: "#831843" },
  ];

  document.querySelectorAll("[data-pbot-card]").forEach(el => el.remove());
  document.querySelectorAll(".pbot-hl").forEach(el => el.replaceWith(document.createTextNode(el.textContent)));
  document.getElementById("pbot-style")?.remove();
  document.getElementById("pbot-fitness")?.remove();

  const style = document.createElement("style");
  style.id = "pbot-style";
  style.textContent = `
    .pbot-hl { border-radius: 3px; padding: 1px 3px; font-weight: 600; }
    [data-pbot-card] {
      margin: 8px 0 !important; padding: 9px 13px !important;
      border-radius: 7px !important; border-left: 4px solid !important;
      font-size: 13px !important; line-height: 1.6 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07) !important;
    }
    [data-pbot-card] .pbot-label {
      font-size: 9px !important; font-weight: 700 !important;
      text-transform: uppercase !important; letter-spacing: 0.08em !important;
      margin-bottom: 4px !important; opacity: 0.7 !important;
    }
    [data-pbot-card] .pbot-msg { margin: 0 !important; }
    #pbot-fitness {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      background: #fff; border-radius: 12px; padding: 14px 18px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15); min-width: 220px; max-width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      border-top: 4px solid #2563eb;
    }
    #pbot-fitness-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
    #pbot-fitness-score { font-size: 22px; font-weight: 800; color: #2563eb; line-height: 1.1; }
    #pbot-fitness-label { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
    #pbot-fitness-reason { font-size: 12px; color: #374151; line-height: 1.6; }
    #pbot-fitness-close { background: none; border: none; cursor: pointer; font-size: 16px; color: #9ca3af; padding: 0; line-height: 1; flex-shrink: 0; }
  `;
  document.head.appendChild(style);

  const badge = document.createElement("div");
  badge.id = "pbot-fitness";
  badge.innerHTML = `
    <div id="pbot-fitness-header">
      <div>
        <div id="pbot-fitness-label">💡 Proposal Bot · 적합도</div>
        <div id="pbot-fitness-score">${fitnessPercent ?? "?"}%</div>
      </div>
      <button id="pbot-fitness-close" title="닫기">✕</button>
    </div>
    <div id="pbot-fitness-reason">${(fitnessReason ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
  `;
  document.body.appendChild(badge);
  document.getElementById("pbot-fitness-close").addEventListener("click", () => badge.remove());

  function esc(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function highlightInMessage(message, keyword, color) {
    const escaped = esc(message);
    const escapedKw = esc(keyword);
    const hlStyle = `background:${color.bg};color:${color.text};border-radius:3px;padding:0 2px;font-weight:600`;
    const withQuotes = `'${escapedKw}'`;
    if (escaped.includes(withQuotes))
      return escaped.replaceAll(withQuotes, `<span style="${hlStyle}">'${escapedKw}'</span>`);
    if (escaped.includes(escapedKw))
      return escaped.replaceAll(escapedKw, `<span style="${hlStyle}">${escapedKw}</span>`);
    return escaped;
  }

  function findBlockAncestor(el) {
    const BLOCKS = new Set(["P","LI","DT","DD","BLOCKQUOTE","H1","H2","H3","H4","H5","H6","TD","TH"]);
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      if (BLOCKS.has(cur.tagName)) return cur;
      cur = cur.parentElement;
    }
    return el.parentElement ?? document.body;
  }

  (matches ?? []).forEach((match, i) => {
    const color = COLORS[i % COLORS.length];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT","STYLE","NOSCRIPT","TEXTAREA"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest("[data-pbot-card]")) return NodeFilter.FILTER_REJECT;
        if (p.closest(".pbot-hl")) return NodeFilter.FILTER_REJECT;
        if (p.closest("#pbot-fitness")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      const idx = text.indexOf(match.keyword);
      if (idx === -1) continue;

      const before = document.createTextNode(text.slice(0, idx));
      const hl = document.createElement("span");
      hl.className = "pbot-hl";
      hl.style.cssText = `background:${color.bg};color:${color.text};`;
      hl.textContent = match.keyword;
      const after = document.createTextNode(text.slice(idx + match.keyword.length));

      const parent = node.parentNode;
      parent.insertBefore(before, node);
      parent.insertBefore(hl, node);
      parent.insertBefore(after, node);
      parent.removeChild(node);

      const block = findBlockAncestor(hl);
      const card = document.createElement("div");
      card.setAttribute("data-pbot-card", i);
      card.style.cssText = `border-left-color:${color.border} !important;background:${color.bg}40 !important;`;
      card.innerHTML = `
        <div class="pbot-label" style="color:${color.text}">💡 Proposal Bot</div>
        <div class="pbot-msg">${highlightInMessage(match.message ?? "", match.keyword, color)}</div>
      `;
      block.insertAdjacentElement("afterend", card);
      break;
    }
  });
}

init();

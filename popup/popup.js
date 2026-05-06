import { getProfile, getPainPointsGuide, getLlmConfig } from "../lib/storage.js";
import { analyze, DEFAULT_MODELS } from "../lib/llm.js";

const MODEL_OPTIONS = {
  gemini: [
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (빠름, 기본)" },
    { value: "gemini-2.5-flash",      label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro",        label: "Gemini 2.5 Pro (고성능)" },
  ],
  claude: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (빠름, 기본)" },
    { value: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6" },
    { value: "claude-opus-4-7",           label: "Claude Opus 4.7 (고성능)" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (빠름, 기본)" },
    { value: "gpt-4o",      label: "GPT-4o" },
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
const analyzeBtn      = document.getElementById("analyzeBtn");
const resultEl        = document.getElementById("result");
const progressOverlay = document.getElementById("progressOverlay");
const progressBar     = document.getElementById("progressBar");
const progressPct     = document.getElementById("progressPct");
const progressLabel   = document.getElementById("progressLabel");

// 도움말
document.getElementById("helpBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://github.com/kickbell/proposal-bot/wiki" });
});

// ── 초기 로드 ──────────────────────────────────────────────

async function init() {
  const [profile, llm] = await Promise.all([getProfile(), getLlmConfig()]);
  if (profile?.raw) profileRawEl.value = profile.raw;
  const provider = llm?.provider ?? "gemini";
  providerEl.value = provider;
  updateModelOptions(provider, llm?.model ?? DEFAULT_MODELS[provider]);
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

providerEl.addEventListener("change", () => { updateModelOptions(providerEl.value, DEFAULT_MODELS[providerEl.value]); saveLlmSettings(); });
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
    setProgress(0, "채용공고를 읽고 있어요...");

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

    setProgress(10, "AI에게 분석을 요청하고 있어요...");

    // LLM 분석 — 시간이 걸리는 구간을 타이머로 진행률 시뮬레이션
    let activeSim = startProgressSim(10, 90, 15000);
    let result;
    try {
      result = await analyze({
        profile: profileText,
        guide: guide ?? "",
        jobText,
        llmConfig,
        onRetry(nextModel, errMsg) {
          activeSim();
          setProgress(0, `${errMsg}<br>다른 모델로 재시도할게요.`);
          // 문구는 2초 표시, LLM 요청은 즉시 진행
          const startNext = () => { activeSim = startProgressSim(0, 90, 15000); };
          setTimeout(startNext, 2000);
          llmModelEl.value = nextModel;
          chrome.storage.local.set({ llm: { ...llmConfig, model: nextModel } });
        },
      });
    } finally {
      activeSim();
    }

    setProgress(95, "결과를 화면에 표시하고 있어요...");

    // 페이지에 결과 주입
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pbotInjectResults,
      args: [result],
    });

    // 팝업에 적합도 카드 표시
    showFitnessCard(result);

    setProgress(100, "분석 완료!");
    await new Promise(r => setTimeout(r, 500));

  } catch (err) {
    showCard("error", "오류", err.message);
  } finally {
    setLoading(false);
  }
});

// ── 유틸 ───────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 35; // r=35

function setProgress(pct, label) {
  const clamped = Math.max(0, Math.min(100, pct));
  progressBar.style.strokeDashoffset = CIRCUMFERENCE * (1 - clamped / 100);
  progressPct.textContent = Math.round(clamped);
  if (label !== undefined) progressLabel.innerHTML = label;
}

const PROGRESS_LABELS = [
  { from: 10, label: "AI에게 분석을 요청하고 있어요" },
  { from: 25, label: "채용공고의 아픈 지점을 찾고 있어요" },
  { from: 40, label: "열심히 분석 중이에요" },
  { from: 55, label: "경력과 기술스택을 매칭하고 있어요" },
  { from: 70, label: "적합도를 계산하고 있어요" },
  { from: 82, label: "거의 다 됐어요. 10초 안에 끝나요" },
];

function startProgressSim(from, to, durationMs) {
  const step = (to - from) / (durationMs / 100);
  let current = from;
  let lastLabelIdx = -1;
  let dotCount = 0;
  let currentBaseLabel = null;

  // 도트 애니메이션: 500ms마다 .→..→...→. 순환
  const dotId = setInterval(() => {
    if (!currentBaseLabel) return;
    dotCount = (dotCount % 6) + 1;
    progressLabel.innerHTML = currentBaseLabel + ".".repeat(dotCount);
  }, 250);

  const id = setInterval(() => {
    current = Math.min(to, current + step);
    const idx = PROGRESS_LABELS.findLastIndex(l => current >= l.from);
    if (idx !== lastLabelIdx) {
      lastLabelIdx = idx;
      dotCount = 0;
      currentBaseLabel = idx >= 0 ? PROGRESS_LABELS[idx].label : null;
      if (currentBaseLabel) setProgress(current, currentBaseLabel + ".");
      else setProgress(current);
    } else {
      setProgress(current);
    }
  }, 100);

  return () => { clearInterval(id); clearInterval(dotId); };
}

function setLoading(on) {
  analyzeBtn.disabled = on;
  progressOverlay.classList.toggle("hidden", !on);
  if (!on) setProgress(0, "");
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

const FITNESS_MESSAGES = {
  90: [
    "연봉 30% 올려달라고 할까요 😁?",
    "사직서 미리 작성해둘까요 🔥?",
    "이력서 손질하고 바로 지원하세요 🚀",
    "이 공고 당신을 위해 만든 것 같아요 🎯",
    "합격 후기 쓸 준비하세요 🏆",
    "면접 복장 미리 골라두세요 👔",
    "연락 먼저 올 수도 있어요 📞",
    "지원하지 않을 이유가 없어요 ✨",
    "지금 바로 지원하세요 ⚡",
    "이건 진짜예요, 놓치면 아까워요 💫",
  ],
  70: [
    "자소서에 힘 좀 주면 될 것 같아요 ✍️",
    "충분히 승산 있는 공고예요 💪",
    "서류는 통과할 것 같아요 📋",
    "어필 포인트만 잘 살리면 돼요 🎯",
    "좋은 기회예요, 놓치지 마세요 🍀",
    "경쟁력 있어요, 도전해보세요 🌟",
    "자신있게 지원해볼 만해요 😊",
    "잘 맞는 공고예요, 준비 잘 하면 돼요 📝",
    "가능성 충분해요 👍",
    "자소서로 나머지 갭을 채워봐요 💡",
  ],
  50: [
    "반반이에요, 도전해볼 만해요 🤔",
    "잘 쓴 자소서 하나가 역전할 수 있어요 ✏️",
    "강점에 집중해서 지원해보세요 🎯",
    "쉽진 않지만 불가능하진 않아요 💭",
    "포트폴리오로 갭을 메워봐요 💼",
    "어필이 당락을 가를 것 같아요 🎲",
    "준비 잘 하면 충분히 가능해요 🔑",
    "도전 자체가 경험이 될 거예요 🌱",
    "경험을 조금 더 살려보세요 📝",
    "부족한 부분을 잘 포장해보세요 🎁",
  ],
  30: [
    "패기로 밀어붙여 보는 건 어떨까요 💥",
    "열정이 스펙을 이기는 경우도 있어요 🔥",
    "약점보단 강점에 집중해 보세요 💪",
    "갭이 있어요, 솔직함으로 승부해봐요 🤝",
    "포트폴리오로 역전을 노려봐요 🎯",
    "지금 도전하면 좋은 경험이 될 거예요 📚",
    "어렵지만 불가능하진 않아요 🧗",
    "정직하게 성장 가능성을 어필해봐요 🌿",
    "쉽진 않겠지만 도전 자체가 경험이에요 🌱",
    "잘 준비하면 충분히 가능해요 🛠️",
  ],
  0: [
    "6개월 후에 다시 도전해봐요 📅",
    "무모한 도전이 인생을 바꾸기도 해요 🌈",
    "이 공고를 목표로 성장해봐요 🚀",
    "솔직히 쉽지 않아요, 하지만 못할 건 없죠 😅",
    "지금은 경험 삼아 도전해봐요 🎓",
    "일단 써보는 것도 나쁘지 않아요 ✏️",
    "준비가 더 필요한 공고예요 📖",
    "갭이 크지만 열정으로 승부해봐요 ❤️",
    "지금은 아니어도 언젠간 될 거예요 🌟",
    "패기로 밀어붙여 보세요 💥",
  ],
};

function fitnessTier(pct) {
  if (pct >= 90) return 90;
  if (pct >= 70) return 70;
  if (pct >= 50) return 50;
  if (pct >= 30) return 30;
  return 0;
}

function fitnessColor(pct) {
  if (pct >= 90) return { bg: "#ecfdf5", border: "#6ee7b7", score: "#059669" };
  if (pct >= 70) return { bg: "#f0fdfa", border: "#99f6e4", score: "#0d9488" };
  if (pct >= 50) return { bg: "#eff6ff", border: "#bfdbfe", score: "#2563eb" };
  if (pct >= 30) return { bg: "#fff7ed", border: "#fed7aa", score: "#ea580c" };
  return           { bg: "#fef2f2", border: "#fecaca", score: "#dc2626" };
}

function showFitnessCard({ fitnessPercent, fitnessReason }) {
  const pct = fitnessPercent ?? 0;
  const c = fitnessColor(pct);
  const msgs = FITNESS_MESSAGES[fitnessTier(pct)];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  const card = document.createElement("div");
  card.className = "card card--fitness";
  card.style.cssText = `background:${c.bg};border-color:${c.border};`;
  card.innerHTML = `
    <div class="card-fitness-msg" style="color:${c.score}">적합도 <span class="card-fitness-score">${pct}%</span>에요! ${escapeHtml(msg)}</div>
    <div class="card-fitness-reason">${escapeHtml(fitnessReason ?? "")}</div>
  `;
  resultEl.appendChild(card);
  resultEl.classList.remove("hidden");
}

// ── 페이지 주입 함수 (executeScript로 실행 — 외부 스코프 참조 불가) ──────

function pbotInjectResults({ matches }) {
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
  `;
  document.head.appendChild(style);

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

  let firstHl = null;

  (matches ?? []).forEach((match, i) => {
    const color = COLORS[i % COLORS.length];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT","STYLE","NOSCRIPT","TEXTAREA"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest("[data-pbot-card]")) return NodeFilter.FILTER_REJECT;
        if (p.closest(".pbot-hl")) return NodeFilter.FILTER_REJECT;
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

      if (i === 0) firstHl = hl;

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

  if (firstHl) {
    firstHl.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

init();

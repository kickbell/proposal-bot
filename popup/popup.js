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
const providerEl = document.getElementById("provider");
const llmModelEl = document.getElementById("llmModel");
const apiKeyEl = document.getElementById("apiKey");
const toggleApiKeyBtn = document.getElementById("toggleApiKey");
const eyeOpen = document.getElementById("eyeOpen");
const eyeClosed = document.getElementById("eyeClosed");
const llmToast = document.getElementById("llmToast");

// 프로필
const profileRawEl = document.getElementById("profileRaw");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const summarizeBtn = document.getElementById("summarizeBtn");
const summaryBox = document.getElementById("summaryBox");
const summaryTextEl = document.getElementById("summaryText");
const clearSummaryBtn = document.getElementById("clearSummaryBtn");
const profileToast = document.getElementById("profileToast");

// 분석
const analyzeBtn = document.getElementById("analyzeBtn");
const resultEl = document.getElementById("result");

// ── 초기 로드 ──────────────────────────────────────────────

async function init() {
  const [profile, llm] = await Promise.all([getProfile(), getLlmConfig()]);

  if (profile?.raw) profileRawEl.value = profile.raw;
  renderSummary(profile?.summary ?? null);

  const provider = llm?.provider ?? "gemini";
  providerEl.value = provider;
  updateModelOptions(provider, llm?.model ?? "");
  apiKeyEl.value = llm?.apiKey ?? "";
}

// ── 패널 토글 ──────────────────────────────────────────────

function initToggle(headerId, bodyId, defaultOpen = true) {
  const header = document.getElementById(headerId);
  const body = document.getElementById(bodyId);

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
initToggle("profileToggle", "profileBody", true);

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
    llm: {
      provider: providerEl.value,
      model: llmModelEl.value,
      apiKey: apiKeyEl.value.trim(),
    },
  });
  showToast(llmToast);
}

providerEl.addEventListener("change", () => {
  updateModelOptions(providerEl.value, "");
  saveLlmSettings();
});

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

// ── 프로필 ─────────────────────────────────────────────────

function renderSummary(summary) {
  if (summary) {
    summaryTextEl.textContent = summary;
    summaryBox.classList.remove("hidden");
  } else {
    summaryBox.classList.add("hidden");
  }
}

saveProfileBtn.addEventListener("click", async () => {
  const profile = await getProfile() ?? {};
  await chrome.storage.local.set({ profile: { ...profile, raw: profileRawEl.value.trim() } });
  showToast(profileToast);
});

summarizeBtn.addEventListener("click", async () => {
  const raw = profileRawEl.value.trim();
  if (!raw) { alert("프로필을 먼저 입력해 주세요."); return; }

  summarizeBtn.disabled = true;
  summarizeBtn.textContent = "요약 중...";
  try {
    throw new Error("LLM 요약은 다음 단계에서 구현됩니다.");
  } catch (err) {
    alert(err.message);
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = "프로필 요약하기";
  }
});

clearSummaryBtn.addEventListener("click", async () => {
  const profile = await getProfile() ?? {};
  delete profile.summary;
  await chrome.storage.local.set({ profile });
  renderSummary(null);
});

// ── 분석 ───────────────────────────────────────────────────

analyzeBtn.addEventListener("click", async () => {
  resultEl.innerHTML = "";
  resultEl.classList.add("hidden");
  setLoading(true);

  try {
    const profile = await getProfile();
    const profileForAnalysis = profile?.summary ?? profile?.raw ?? "";

    if (!profileForAnalysis) {
      showCard("warn", "프로필 필요", "프로필을 입력하고 저장한 뒤, '프로필 요약하기'를 눌러 주세요.");
      return;
    }
    if (!profile?.summary) {
      showCard("warn", "요약본 없음", "원본 프로필로 분석합니다. 토큰 절약을 위해 '프로필 요약하기'를 권장합니다.");
    }

    const llmConfig = await getLlmConfig();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { showCard("error", "오류", "현재 탭을 찾을 수 없습니다."); return; }

    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText.slice(0, 20000),
      });
    } catch {
      showCard("error", "추출 실패", "이 페이지에서는 텍스트를 추출할 수 없습니다.\n(chrome:// 페이지 등은 지원하지 않습니다.)");
      return;
    }

    const jobText = results?.[0]?.result ?? "";
    showCard("info", "추출 완료", `${jobText.length.toLocaleString()}자 추출됨`);

    const guide = await getPainPointsGuide();
    analyzeBtn.textContent = "LLM 분석 중...";

    let result;
    try {
      result = await analyze({ profile: profileForAnalysis, guide: guide ?? "", jobText, llmConfig });
    } catch (err) {
      showCard("error", "LLM 오류", err.message);
      return;
    }

    showCard("fit", `적합도 ${result.fitnessPercent ?? "?"}%`, "이 채용공고와의 매칭 적합도");

    if (result.painPoints?.length) {
      showCard("info", "회사의 아픈 지점",
        result.painPoints.map((p, i) => `${i + 1}. ${p}`).join("\n"));
    }
    if (result.proposals?.length) {
      showCard("info", "기술 제안 방향",
        result.proposals.map((p, i) => `${i + 1}. ${p}`).join("\n"));
    }
  } catch (err) {
    showCard("error", "오류", err.message);
  } finally {
    setLoading(false);
  }
});

// ── 유틸 ───────────────────────────────────────────────────

function showToast(el) {
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2000);
}

function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.textContent = on ? "분석 중..." : "이 페이지 분석";
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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

init();

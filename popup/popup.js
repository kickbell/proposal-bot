import { getProfile, getLlmConfig } from "../lib/storage.js";

const profileRawEl = document.getElementById("profileRaw");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const summarizeBtn = document.getElementById("summarizeBtn");
const summaryBox = document.getElementById("summaryBox");
const summaryTextEl = document.getElementById("summaryText");
const clearSummaryBtn = document.getElementById("clearSummaryBtn");
const profileToast = document.getElementById("profileToast");
const analyzeBtn = document.getElementById("analyzeBtn");
const optionsBtn = document.getElementById("optionsBtn");
const resultEl = document.getElementById("result");

// 프로필 로드 — 팝업 열릴 때 1회만 실행
async function loadProfile() {
  const profile = await getProfile();
  if (profile?.raw) profileRawEl.value = profile.raw;
  renderSummary(profile?.summary ?? null);
}

function renderSummary(summary) {
  if (summary) {
    summaryTextEl.textContent = summary;
    summaryBox.classList.remove("hidden");
  } else {
    summaryBox.classList.add("hidden");
  }
}

// 원본 저장 (요약본은 건드리지 않음)
saveProfileBtn.addEventListener("click", async () => {
  const profile = await getProfile() ?? {};
  await chrome.storage.local.set({ profile: { ...profile, raw: profileRawEl.value.trim() } });
  showToast();
});

// 요약하기 — LLM 연동 전 스텁
summarizeBtn.addEventListener("click", async () => {
  const raw = profileRawEl.value.trim();
  if (!raw) {
    alert("프로필을 먼저 입력해 주세요.");
    return;
  }

  summarizeBtn.disabled = true;
  summarizeBtn.textContent = "요약 중...";

  try {
    // TODO(다음 라운드): LLM API로 raw → summary 압축
    // 현재는 스텁 — 실제 호출 없이 안내만 표시
    throw new Error("LLM 요약은 다음 단계에서 구현됩니다.");
  } catch (err) {
    alert(err.message);
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = "프로필 요약하기";
  }
});

// 요약 삭제 → 재요약 유도
clearSummaryBtn.addEventListener("click", async () => {
  const profile = await getProfile() ?? {};
  delete profile.summary;
  await chrome.storage.local.set({ profile });
  renderSummary(null);
});

// 설정 페이지
optionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// 페이지 분석
analyzeBtn.addEventListener("click", async () => {
  resultEl.innerHTML = "";
  resultEl.classList.add("hidden");
  setLoading(true);

  try {
    const profile = await getProfile();

    // 요약본 있으면 캐시 사용, 없으면 원본으로 fallback
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
    if (!tab?.id) {
      showCard("error", "오류", "현재 탭을 찾을 수 없습니다.");
      return;
    }

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
    const preview = jobText.slice(0, 200).replace(/\n+/g, " ");

    showCard("info", "추출 완료", `${jobText.length.toLocaleString()}자 추출됨`);
    showCard("info", "미리보기", preview + (jobText.length > 200 ? "…" : ""));
    showCard("warn", "LLM 분석", "LLM 호출은 다음 단계에서 구현됩니다.\n(provider: " + (llmConfig?.provider ?? "gemini") + ")");
  } catch (err) {
    showCard("error", "오류", err.message);
  } finally {
    setLoading(false);
  }
});

function showToast() {
  profileToast.classList.remove("hidden");
  setTimeout(() => profileToast.classList.add("hidden"), 2000);
}

function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.textContent = on ? "분석 중..." : "이 페이지 분석";
}

function showCard(type, label, body) {
  const card = document.createElement("div");
  card.className = `card${type === "error" ? " card--error" : type === "warn" ? " card--warn" : ""}`;
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

loadProfile();

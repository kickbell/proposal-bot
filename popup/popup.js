import { getProfile, getPainPointsGuide, getLlmConfig } from "../lib/storage.js";

const analyzeBtn = document.getElementById("analyzeBtn");
const optionsBtn = document.getElementById("optionsBtn");
const resultEl = document.getElementById("result");

optionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

analyzeBtn.addEventListener("click", async () => {
  setLoading(true);
  resultEl.classList.add("hidden");
  resultEl.innerHTML = "";

  try {
    const [profile, guide, llmConfig] = await Promise.all([
      getProfile(),
      getPainPointsGuide(),
      getLlmConfig(),
    ]);

    if (!profile?.career && !profile?.stack) {
      showCard("warn", "설정 필요", "프로필이 비어 있습니다. 설정 페이지에서 경력과 기술스택을 먼저 입력해 주세요.");
      chrome.runtime.openOptionsPage();
      return;
    }

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
      showCard("error", "추출 실패", "이 페이지에서는 텍스트를 추출할 수 없습니다. (chrome:// 페이지 등은 지원하지 않습니다.)");
      return;
    }

    const jobText = results?.[0]?.result ?? "";
    const charCount = jobText.length;
    const preview = jobText.slice(0, 200).replace(/\n+/g, " ");

    showCard("info", "추출 완료", `${charCount.toLocaleString()}자 추출됨`);
    showCard("info", "미리보기", preview + (jobText.length > 200 ? "…" : ""));
    showCard("warn", "LLM 분석", "LLM 호출은 다음 단계에서 구현됩니다.\n(provider: " + (llmConfig?.provider ?? "미설정") + ")");
  } catch (err) {
    showCard("error", "오류", err.message);
  } finally {
    setLoading(false);
  }
});

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
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

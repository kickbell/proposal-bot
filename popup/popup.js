const statusEl = document.getElementById("status");
const pingButton = document.getElementById("pingButton");

if (pingButton && statusEl) {
  pingButton.addEventListener("click", async () => {
    statusEl.textContent = "백그라운드에 메시지 전송 중...";

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      statusEl.textContent = tab?.url
        ? `현재 탭: ${new URL(tab.url).hostname}`
        : "현재 탭 URL을 확인할 수 없습니다.";
    } catch (error) {
      statusEl.textContent = "탭 정보를 가져오지 못했습니다.";
      console.error(error);
    }
  });
}

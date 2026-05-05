chrome.runtime.onInstalled.addListener(() => {
  console.log("Proposal Bot installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ping") {
    sendResponse({ type: "pong" });
    return false;
  }
  // 다음 라운드: LLM 프록시 핸들러 추가 예정
});

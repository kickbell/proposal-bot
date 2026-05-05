// chrome.scripting.executeScript로 주입되는 함수 — module 문법 사용 불가
function extractPageText() {
  return document.body.innerText.slice(0, 20000);
}

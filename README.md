# Career Matchpoint

채용공고 페이지에서 회사의 "아픈 지점"을 LLM이 찾아내고, 사용자의 경력·도메인·기술스택과 매칭해서 기술 제안 방향과 적합도(%)를 제시하는 Chrome 확장 프로그램(MV3).

## 작동 방식

1. 사용자가 팝업에서 프로필(경력·기술스택), LLM provider, API 키를 입력 — 모두 `chrome.storage.local`에 자동 저장
2. 채용공고 페이지에서 확장 아이콘 클릭 → "채용공고 분석하기"
3. popup.js가 활성 탭에서 본문 텍스트 추출 (`chrome.scripting.executeScript`)
4. lib/llm.js가 선택된 provider(Claude/OpenAI/Gemini) API 호출 → JSON 응답 파싱
5. 결과를 페이지에 직접 주입:
   - 채용공고 본문에서 LLM이 추출한 keyword를 색상 하이라이트
   - 각 keyword 아래 매칭 카드 삽입 (지원자 경험과 연결한 제안 메시지)
   - 우하단 fixed 배지에 적합도(%) + 점수 근거(fitnessReason) 표시

## 파일 구조

```
career-matchpoint/
├── manifest.json            ← MV3, host_permissions(Anthropic/OpenAI/Google)
├── background.js            ← service worker (현재는 onInstalled 로그만)
├── popup/
│   ├── popup.html           ← 프로필/LLM 설정 패널, 분석 버튼, 진행률 오버레이
│   ├── popup.css            ← light theme, 360px 너비
│   └── popup.js             ← 모든 핵심 로직 (자동 저장, 분석 트리거, 페이지 주입)
├── lib/
│   ├── storage.js           ← getProfile/getPainPointsGuide/getLlmConfig 헬퍼
│   └── llm.js               ← provider별 어댑터, 시스템 프롬프트, 한글 에러 매핑
├── prompts/
│   └── pain-points-guide.default.md  ← 아픈 지점 분석 가이드 (참고용)
└── icons/                   ← 16/32/48/128 PNG
```

## 핵심 구현 위치

| 기능 | 파일:심볼 |
|---|---|
| LLM 분석 진입점 | lib/llm.js: `analyze({ profile, guide, jobText, llmConfig, onRetry })` |
| Provider 어댑터 | lib/llm.js: `callClaude / callOpenAI / callGemini` |
| 시스템 프롬프트 (아픈 지점 정의·규칙) | lib/llm.js: `SYSTEM_PROMPT` |
| 한글 에러 매핑 | lib/llm.js: `KOREAN_ERRORS`, `checkResponse` |
| 페이지 텍스트 추출 | popup/popup.js: analyzeBtn 핸들러 내 `executeScript({ func: () => document.body.innerText.slice(0, 20000) })` |
| 결과 페이지 주입 | popup/popup.js: `pbotInjectResults` (executeScript의 func로 전달) |
| 키워드 하이라이트 + 카드 삽입 | popup/popup.js: `pbotInjectResults` 내 `TreeWalker` + `findBlockAncestor` |
| 적합도 배지 (fixed 우하단) | popup/popup.js: `pbotInjectResults` 내 `#pbot-fitness` 생성 |
| 자동 저장 (LLM 설정) | popup/popup.js: provider/llmModel/apiKey의 `change` 이벤트 → `saveLlmSettings` |
| 자동 저장 (프로필) | popup/popup.js: `profileRaw` `input` 이벤트 + 800ms 디바운스 |
| 진행률 시뮬레이션 | popup/popup.js: `startProgressSim`, `setProgress` |
| 모델 자동 재시도 | lib/llm.js: `analyze`의 `onRetry` 콜백 |

## LLM 응답 포맷

```json
{
  "matches": [
    {
      "keyword": "채용공고 원문 문구 (5~25자)",
      "message": "'keyword' → 지원자의 ~경험을 강점으로 제안하세요."
    }
  ],
  "fitnessPercent": 75,
  "fitnessReason": "지원자의 어느 경험이 매칭되어 점수가 나왔는지 2~3문장"
}
```

- `keyword`는 반드시 채용공고 원문에서 그대로 복사한 문구 (TreeWalker 매칭용)
- `message`는 keyword를 작은따옴표로 감싸 강조, 지원자 프로필 내용을 직접 언급

## 지원 모델

| Provider | 모델 |
|---|---|
| Gemini | `gemini-2.5-flash-lite` (기본), `gemini-2.5-flash`, `gemini-2.5-pro` |
| Claude | `claude-haiku-4-5-20251001` (기본), `claude-sonnet-4-6`, `claude-opus-4-7` |
| OpenAI | `gpt-4o-mini` (기본), `gpt-4o`, `o3-mini` |

기본 모델은 popup/popup.js의 `MODEL_OPTIONS`와 lib/llm.js의 `DEFAULT_MODELS`에서 관리.

## 기술적 결정

- **분석 로직 위치**: popup.js (background.js 아님)
  - MV3 service worker는 유휴 시 종료되어 port 연결이 즉시 끊기는 문제가 있음
  - 분석 중 popup이 닫히면 작업이 중단되지만, 신뢰성·단순성 우선
- **content script 미등록**: 분석 시점에만 `chrome.scripting.executeScript`로 함수 주입 (지속 실행 불필요)
- **저장**: 모든 사용자 데이터(프로필, API 키)는 `chrome.storage.local`에만 저장 — 외부 서버 없음
- **하이라이트 충돌 방지**: TreeWalker `acceptNode`에서 이미 주입된 `[data-pbot-card]`, `.pbot-hl`, `#pbot-fitness` 영역은 스킵

## 검증 방법

1. **로드**: `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → 프로젝트 루트 선택
2. **설정**: 팝업 열기 → 프로필 입력 (자동 저장 확인) → LLM provider/모델/API 키 입력 (자동 저장 토스트 확인)
3. **분석**: 채용공고 페이지(예: wanted.co.kr 공고) → 팝업에서 "채용공고 분석하기"
   - 진행률 오버레이가 0% → 100%로 차오르는지
   - 페이지에 keyword 하이라이트 + 매칭 카드가 삽입되는지
   - 우하단에 적합도 배지가 뜨는지
4. **에러 케이스**:
   - chrome:// 페이지에서 분석 → "추출 실패" 카드
   - 잘못된 API 키 → 한글 에러 메시지 ("API 키가 유효하지 않습니다")
   - 무료 할당량 초과 → 다른 모델로 자동 재시도 (`onRetry`)

## 향후 개선 가능

- 분석 히스토리 저장 (현재는 매번 재요청)
- 프로필 요약 (token 절감)
- `prompts/pain-points-guide.default.md` 자동 로드 — 현재는 storage에 저장된 사용자 입력 가이드만 사용
- 백그라운드 처리 (MV3 service worker keepalive 패턴이 안정화되면)

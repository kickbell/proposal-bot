# Proposal Bot — Chrome Extension 구현 계획

## Context

[../README.md](../README.md)에 정의된 목표는 채용공고 페이지에서 회사의 "아픈 지점"을 찾아내고, 사전 입력된 사용자의 경력·도메인 지식·기술스택과 매칭해서 LLM이 기술 제안 방향과 적합도(%)를 제시하는 Chrome 확장 프로그램이다.

현재 프로젝트에는 MV3 스켈레톤만 있다 — [manifest.json](../manifest.json), [background.js](../background.js)(빈 listener), [popup/](../popup)(ping 버튼), 빈 [icons/](../icons) 폴더. 실제 기능은 전혀 구현되어 있지 않다.

이번 단계의 목표는 **MVP 스켈레톤**을 만드는 것 — 옵션 페이지에서 프로필을 저장하고, popup에서 현재 탭의 본문 텍스트를 추출해 popup 안에 표시하는 데까지. LLM API 호출은 인터페이스만 뚫어두고 실제 호출은 다음 단계에서 한다.

## 사용자 결정 사항 (확정)

- **LLM provider**: 사용자가 옵션에서 선택 (Claude / OpenAI / Gemini), 모델·API 키도 사용자 입력
- **저장소**: `chrome.storage.local` + 옵션 페이지 UI
- **타겟 사이트**: 범용 (현재 페이지 `document.body.innerText` 그대로 전송)
- **결과 UI**: 확장 popup 내부에 카드로 표시
- **MVP 범위**: 최소 스켈레톤 먼저 (실제 LLM 호출은 다음 라운드)

## 최종 파일 구조

```
proposal-bot/
├── manifest.json            ← host_permissions, options_page 추가
├── background.js            ← 메시지 라우터(추출 트리거, 추후 LLM 프록시)
├── popup/
│   ├── popup.html           ← 분석 버튼 + 결과 카드 영역
│   ├── popup.css
│   └── popup.js             ← 추출 트리거 → 결과 렌더
├── options/                 ← 신규
│   ├── options.html         ← 프로필/가이드/API 설정 폼
│   ├── options.css
│   └── options.js           ← chrome.storage 읽기/쓰기
├── content/                 ← 신규
│   └── extract.js           ← document.body.innerText 추출
├── lib/                     ← 신규
│   ├── storage.js           ← getProfile/getGuide/getLlmConfig
│   └── llm.js               ← provider별 어댑터 인터페이스 (스텁)
├── prompts/                 ← 신규
│   └── pain-points-guide.default.md  ← 사용자가 비우면 fallback
├── docs/
│   └── PLAN.md              ← 이 문서
└── icons/                   ← 16/48/128 아이콘 추가
```

## 구현 단계 (MVP 스켈레톤)

### 1. `manifest.json` 수정
- `options_page: "options/options.html"` 추가
- `content_scripts` 대신 `chrome.scripting.executeScript`를 popup에서 호출 (이미 `scripting`/`activeTab` 권한 있음)
- 아이콘 매니페스트 등록 (`16`, `48`, `128`)
- LLM 단계 대비 `host_permissions`는 다음 라운드에 추가 (지금은 미포함 — 호출 안 하니까)

### 2. 옵션 페이지 (`options/`)
- 폼 항목: 경력 요약(textarea), 도메인 지식(textarea), 기술스택(textarea), 아픈 지점 가이드(textarea), LLM provider(select), 모델명(input), API 키(password input)
- 저장: `chrome.storage.local.set({ profile, painPointsGuide, llm })`
- 로드: 페이지 진입 시 `chrome.storage.local.get`으로 채워넣기
- 저장 성공 토스트

### 3. 공통 라이브러리 (`lib/storage.js`)
- `getProfile()`, `getPainPointsGuide()`, `getLlmConfig()` 비동기 헬퍼
- 옵션/popup/background 어디서든 import

### 4. 추출 스크립트 (`content/extract.js`)
- 단일 함수 export: `() => document.body.innerText.slice(0, 20000)` (토큰 폭주 방지로 컷)
- popup에서 `chrome.scripting.executeScript`로 주입해 결과 반환

### 5. Popup UI (`popup/`)
- "이 페이지 분석" 버튼 + 결과 영역
- 클릭 시 흐름:
  1. 프로필/가이드/LLM 설정이 비어 있으면 옵션 페이지로 안내
  2. 활성 탭에 추출 스크립트 주입 → 본문 텍스트 수신
  3. **이번 단계**: 추출된 텍스트의 길이/미리보기와 "LLM 호출은 다음 단계" placeholder 카드 표시
  4. 다음 단계: `lib/llm.js` 호출해 제안/적합도 카드 렌더

### 6. LLM 어댑터 스텁 (`lib/llm.js`)
- 인터페이스만: `analyze({ profile, guide, jobText, llmConfig }) => { painPoints, proposals, fitnessPercent }`
- 구현체는 다음 라운드 — 지금은 throw `Not implemented` 또는 mock 응답
- provider별 분기 자리(`switch(llmConfig.provider)`)만 마련

### 7. 아이콘 (`icons/`)
- 임시 단색 PNG 3개(16/48/128) 생성 — `manifest.json`이 참조

## 재사용 가능한 기존 자산

- `manifest.json`: `storage`, `activeTab`, `scripting` 권한 이미 있음 — 추가 권한 거의 불필요
- `background.js`: service worker module 셋업 완료 — 메시지 라우터 추가만 하면 됨
- `popup/popup.html`+`popup.css`: 레이아웃·스타일 토대 그대로 사용
- `popup/popup.js`: `chrome.tabs.query` 패턴 이미 있음 → 추출 스크립트 주입으로 확장

## 검증 방법

1. **로드**: `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램 로드" → `proposal-bot/` 선택. 에러 없이 로드되는지 확인.
2. **옵션**: 확장 우클릭 → 옵션 → 폼 입력 → 저장. 페이지 새로고침 후에도 값이 유지되는지 확인.
3. **추출**: 임의 채용공고(예: wanted.co.kr 공고 페이지)에서 popup 열기 → "이 페이지 분석" 클릭 → 본문 텍스트 길이/미리보기가 popup에 표시되는지 확인.
4. **빈 상태**: 옵션 비운 상태에서 분석 클릭 → 옵션으로 안내되는지 확인.
5. **에러**: `chrome://extensions` 페이지처럼 추출 불가한 페이지에서 분석 → 에러 메시지가 popup에 표시되는지 확인.

## 다음 라운드 (이번 계획에 포함 안 됨)

- `lib/llm.js` 실제 구현 (provider별 fetch + JSON 파싱)
- `manifest.json`에 host_permissions 추가 (api.anthropic.com, api.openai.com 등)
- 결과 카드 디자인 (페인포인트 리스트, 매칭 근거, 적합도 게이지)
- 분석 히스토리 저장

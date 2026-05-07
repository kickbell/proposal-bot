const SYSTEM_PROMPT = `당신은 채용 전문 컨설턴트입니다. 채용공고에서 회사가 지금 겪고 있는 '아픈 지점(Pain Point)'을 찾아 지원자의 경험과 1:1로 매칭하여, 지원자가 회사의 빈틈을 채울 '퍼즐 조각'임을 증명하는 기술 제안 방향을 제시합니다.

## 아픈 지점이란?
회사가 **지금 해결하지 못해 힘들어하는 구체적인 비즈니스·기술·운영 과제**입니다. 단순한 기술 키워드 나열이 아닌, 그 키워드 뒤에 숨은 '결핍'을 읽어내야 합니다.

- 채용은 실력 경쟁이 아니라 '퍼즐 맞추기'입니다. 회사의 빈자리 모양에 맞는 조각이 누구인지 찾는 게임입니다.
- 회사가 어떤 역량을 강조한다면, 그건 지금 그 역량이 부족해서 사용자/팀이 고통받고 있다는 신호입니다.
- 예: "실시간 데이터 처리에 진심인 분" → 지금 데이터를 제때 화면에 못 뿌려 사용자 불만이 쌓이는 중
- 예: "예측 가능한 코드", "변경에 유연한 아키텍처" → 현재 코드 복잡도로 유지보수 고통 중
- 예: "주도적으로 일하는 분" → 전담 인력 부재로 누군가 기술 리딩을 못 채우고 있는 중

좋은 아픈 지점:
- "확장 가능한 아키텍처 설계" (빠른 트래픽 증가에 인프라가 못 따라감)
- "데이터 정합성 보장" (현재 데이터 불일치로 운영 비용 발생 중)
- "장애 복구 자동화" (수동 복구로 야간 호출 빈번)
- "AI 모델 서빙 비용 최적화" (현재 추론 비용이 회사 마진을 압박)

나쁜 아픈 지점 (단순 서비스/도메인 설명일 뿐):
- "여행 플랫폼", "결제 서비스", "글로벌 SaaS"
- "React로 프론트엔드 개발" (도구 명칭일 뿐 어떤 고통인지 불명확)

## 아픈 지점 찾는 법 (우선순위 순)
1. **공고 상단 우선**: '조직 소개', '팀 소개', '주요 업무' 섹션이 가장 신호가 강함. 회사가 영상·헤드라인·문화 설명까지 동원해 강조하는 메시지는 팀 정체성 유지에 필수적인 지점이라는 뜻.
2. **반복되는 단어**: 한 공고 안에서 2회 이상 등장하거나 다른 표현으로 변주되는 키워드는 회사가 가장 절실하게 느끼는 결핍.
3. **요구사항 뒤의 결핍**: "~가 필요한 분", "~에 익숙한 분" 형식의 요구는 그 역량이 현재 부족하다는 시그널. 자격요건과 우대사항 각각에서 독립적으로 추출.
4. **비즈니스 맥락 + 기술 도전 결합**: 단순 기술 명칭이 아니라 "어떤 비즈니스 상황에서 그 기술이 필요한가"가 드러나는 표현 우선.
5. **AI/자동화 시대의 차별 지점**: 단순 기능 구현이 아닌 '설계·판단·도메인 특화' 영역의 과제 (예: 비즈니스 맥락 기반 시스템 선택, 산업 특화 제약 반영).

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{"matches":[{"keyword":"채용공고 원문 문구","message":"제안 메시지"}],"fitnessPercent":75,"fitnessReason":"적합도 근거"}

## keyword 규칙
- 채용공고 원문에서 **그대로 복사한 문구** (5~25자), 원문에 없으면 절대 사용 금지
- 단순 서비스 명칭·도구명이 아닌, **회사가 겪는 결핍·도전을 드러내는 표현**이어야 함
- 공고 전체에서 아픈 지점을 빠짐없이 추출 (최소 4개, 최대 10개)
- 공고 상단에서 추출한 keyword를 우선 배치

## message 규칙
- 반드시 keyword를 작은따옴표로 감싸 문장 앞에 명시: '[keyword]' → ...
- **"내 A 경험이 너희 B 문제를 해결한다"는 1:1 매칭 논리**로 작성
- 지원자 프로필의 구체적인 경험·기술·도메인 지식·수치를 직접 인용할 것 (일반론 금지)
- 가능하면 '상황(어떤 제약/맥락) → 판단(왜 그 기술/접근) → 결과(무엇이 좋아졌는가)' 구조 암시
- 1~2문장, 간결하고 명료하게
- 좋은 예: '확장 가능한 아키텍처 설계' → 지원자가 일 거래 500만 건 이커머스에서 Two-Tower + Kafka로 p99 80ms를 유지한 경험을 이 지점에 직접 적용할 수 있습니다.
- 나쁜 예: '확장 가능한 아키텍처 설계' → 지원자는 아키텍처 설계 경험이 풍부합니다. (구체성·매칭 논리 없음)

## fitnessReason 규칙
- 지원자의 어떤 경험·기술·도메인이 이 공고의 **빈틈에 어떻게 들어맞는지** 2~3문장으로 설명
- "기술 스택이 일치한다"가 아니라 "회사 문제 X에 지원자 경험 Y가 검증된 해법"이라는 논리
- 구체적인 기술 스택·프로젝트·수치·도메인 지식을 직접 언급할 것
- fitnessPercent: 단순 스킬 매칭률이 아닌 **'퍼즐 적합도'** 0~100
  - 80~100: 동일 도메인·문제 해결 경험이 직접 매칭, 즉시 전력감
  - 60~79: 인접 도메인 또는 핵심 기술 다수 매칭, 약간의 온보딩 필요
  - 40~59: 일부 기술 매칭이지만 비즈니스 맥락이 다름, 기여 가능하나 학습 필요
  - 0~39: 매칭 지점이 적음`;

function buildPrompt(profile, guide, jobText) {
  const guideSection = guide ? `## 아픈 지점 분석 가이드\n${guide}\n\n` : "";
  return `${guideSection}## 지원자 프로필\n${profile}\n\n## 채용공고\n${jobText}\n\nJSON 형식으로 분석 결과를 제시해주세요.`;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM 응답에서 JSON을 찾을 수 없습니다.");
  return JSON.parse(match[0]);
}

// 재시도 가능한 에러를 구분하기 위한 커스텀 에러
class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.retryable = true;
  }
}

// provider별 fallback 모델 순서 (선택 모델 제외하고 나머지 순서대로 시도)
const FALLBACK_MODELS = {
  gemini: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"],
  claude: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"],
  openai: ["gpt-4o-mini", "gpt-4o", "o3-mini"],
};

// provider별 기본 모델 (가장 빠른 것)
export const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash-lite",
  claude: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

const KOREAN_ERRORS = {
  gemini: {
    400: "잘못된 요청입니다.\n모델명이 올바른지 확인해 주세요.",
    401: "API 키가 유효하지 않습니다.\n설정에서 키를 다시 확인해 주세요.",
    403: "API 키에 사용 권한이 없습니다.",
    404: "모델을 찾을 수 없습니다.",
    429: "Gemini 무료 할당량을 초과했습니다.",
    500: "Google 서버 오류입니다.",
    503: "Google API를 일시적으로 사용할 수 없습니다.",
  },
  claude: {
    400: "잘못된 요청입니다.\n모델명이 올바른지 확인해 주세요.",
    401: "Anthropic API 키가 유효하지 않습니다.\n설정에서 키를 다시 확인해 주세요.",
    403: "API 키에 사용 권한이 없습니다.",
    404: "모델을 찾을 수 없습니다.",
    429: "Claude API 호출 한도를 초과했습니다.",
    500: "Anthropic 서버 오류입니다.",
    503: "Claude API를 일시적으로 사용할 수 없습니다.",
  },
  openai: {
    400: "잘못된 요청입니다.\n모델명이 올바른지 확인해 주세요.",
    401: "OpenAI API 키가 유효하지 않습니다.\n설정에서 키를 다시 확인해 주세요.",
    403: "API 키에 사용 권한이 없습니다.",
    404: "모델을 찾을 수 없습니다.",
    429: "OpenAI API 한도를 초과했습니다.",
    500: "OpenAI 서버 오류입니다.",
    503: "OpenAI API를 일시적으로 사용할 수 없습니다.",
  },
};

// 재시도해도 소용없는 에러 (키 문제)
const FATAL_STATUSES = new Set([401, 403]);

async function checkResponse(res, provider) {
  if (!res.ok) {
    const message = KOREAN_ERRORS[provider]?.[res.status];
    const body = await res.text().catch(() => "");
    const errorMessage = message ?? `API 오류 ${res.status}${body ? ": " + body.slice(0, 200) : ""}`;
    if (FATAL_STATUSES.has(res.status)) throw new Error(errorMessage);
    throw new RetryableError(errorMessage);
  }
}

async function callClaude(prompt, llmConfig) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": llmConfig.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: llmConfig.model || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  await checkResponse(res, "claude");
  const data = await res.json();
  return extractJson(data.content[0].text);
}

async function callOpenAI(prompt, llmConfig) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.model || "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  await checkResponse(res, "openai");
  const data = await res.json();
  return extractJson(data.choices[0].message.content);
}

async function callGemini(prompt, llmConfig) {
  const model = llmConfig.model || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${llmConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  await checkResponse(res, "gemini");
  const data = await res.json();
  return extractJson(data.candidates[0].content.parts[0].text);
}

export async function analyze({ profile, guide, jobText, llmConfig, onRetry }) {
  if (!llmConfig?.apiKey) throw new Error("API 키가 설정되지 않았습니다. 설정 패널에서 입력해 주세요.");

  const prompt = buildPrompt(profile, guide, jobText);
  const { provider } = llmConfig;

  const callers = { claude: callClaude, openai: callOpenAI, gemini: callGemini };
  const caller = callers[provider];
  if (!caller) throw new Error(`알 수 없는 LLM provider: ${provider}`);

  // 선택된 모델 먼저, 나머지 fallback 순서대로
  const allModels = FALLBACK_MODELS[provider] ?? [];
  const models = [
    llmConfig.model,
    ...allModels.filter(m => m !== llmConfig.model),
  ].filter(Boolean);

  let lastError;
  for (const model of models) {
    try {
      return await caller(prompt, { ...llmConfig, model });
    } catch (err) {
      lastError = err;
      if (!err.retryable) throw err;
      // 다음 모델로 재시도 전에 콜백 호출
      const nextModel = models[models.indexOf(model) + 1];
      if (nextModel && onRetry) onRetry(nextModel, err.message);
    }
  }

  throw new Error(`모든 모델에서 실패했습니다. ${lastError?.message ?? ""}`);
}

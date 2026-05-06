const SYSTEM_PROMPT = `당신은 채용 전문 컨설턴트입니다. 채용공고에서 회사의 아픈 지점을 찾아 지원자의 경력과 매칭하여 기술 제안 방향을 제시합니다.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
{"painPoints":["아픈 지점 1","아픈 지점 2"],"proposals":["제안 1","제안 2"],"fitnessPercent":75}`;

function buildPrompt(profile, guide, jobText) {
  const guideSection = guide ? `## 아픈 지점 분석 가이드\n${guide}\n\n` : "";
  return `${guideSection}## 지원자 프로필\n${profile}\n\n## 채용공고\n${jobText}\n\nJSON 형식으로 분석 결과를 제시해주세요.`;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM 응답에서 JSON을 찾을 수 없습니다.");
  return JSON.parse(match[0]);
}

const KOREAN_ERRORS = {
  gemini: {
    400: "잘못된 요청입니다. 모델명이 올바른지 확인해 주세요.",
    401: "API 키가 유효하지 않습니다. 설정에서 키를 다시 확인해 주세요.",
    403: "API 키에 이 기능을 사용할 권한이 없습니다.",
    404: "선택한 모델을 찾을 수 없습니다. 다른 모델을 선택해 보세요.",
    429: "Gemini API 무료 할당량을 초과했습니다. 잠시 후 재시도하거나, Google AI Studio에서 결제를 활성화해 주세요.",
    500: "Google 서버 오류입니다. 잠시 후 다시 시도해 주세요.",
    503: "Google API가 일시적으로 사용 불가합니다. 잠시 후 재시도해 주세요.",
  },
  claude: {
    400: "잘못된 요청입니다. 모델명이 올바른지 확인해 주세요.",
    401: "Anthropic API 키가 유효하지 않습니다. 설정에서 키를 다시 확인해 주세요.",
    403: "API 키에 이 기능을 사용할 권한이 없습니다.",
    404: "선택한 모델을 찾을 수 없습니다. 다른 모델을 선택해 보세요.",
    429: "Claude API 호출 한도를 초과했습니다. 잠시 후 재시도하거나, Anthropic 플랜을 확인해 주세요.",
    500: "Anthropic 서버 오류입니다. 잠시 후 다시 시도해 주세요.",
    503: "Claude API가 일시적으로 사용 불가합니다. 잠시 후 재시도해 주세요.",
  },
  openai: {
    400: "잘못된 요청입니다. 모델명이 올바른지 확인해 주세요.",
    401: "OpenAI API 키가 유효하지 않습니다. 설정에서 키를 다시 확인해 주세요.",
    403: "API 키에 이 기능을 사용할 권한이 없습니다.",
    404: "선택한 모델을 찾을 수 없습니다. 다른 모델을 선택해 보세요.",
    429: "OpenAI API 한도를 초과했습니다. 플랜과 결제 정보를 확인해 주세요.",
    500: "OpenAI 서버 오류입니다. 잠시 후 다시 시도해 주세요.",
    503: "OpenAI API가 일시적으로 사용 불가합니다. 잠시 후 재시도해 주세요.",
  },
};

async function checkResponse(res, provider) {
  if (!res.ok) {
    const korean = KOREAN_ERRORS[provider]?.[res.status];
    if (korean) throw new Error(korean);
    const body = await res.text().catch(() => "");
    throw new Error(`API 오류 ${res.status}${body ? ": " + body.slice(0, 200) : ""}`);
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

export async function analyze({ profile, guide, jobText, llmConfig }) {
  if (!llmConfig?.apiKey) throw new Error("API 키가 설정되지 않았습니다. 설정 패널에서 입력해 주세요.");
  const prompt = buildPrompt(profile, guide, jobText);
  switch (llmConfig.provider) {
    case "claude": return callClaude(prompt, llmConfig);
    case "openai": return callOpenAI(prompt, llmConfig);
    case "gemini": return callGemini(prompt, llmConfig);
    default: throw new Error(`알 수 없는 LLM provider: ${llmConfig.provider}`);
  }
}

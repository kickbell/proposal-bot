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

async function checkResponse(res) {
  if (!res.ok) {
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
  await checkResponse(res);
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
  await checkResponse(res);
  const data = await res.json();
  return extractJson(data.choices[0].message.content);
}

async function callGemini(prompt, llmConfig) {
  const model = llmConfig.model || "gemini-2.0-flash";
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
  await checkResponse(res);
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

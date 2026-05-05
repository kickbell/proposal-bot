/**
 * analyze({ profile, guide, jobText, llmConfig })
 * → { painPoints: string[], proposals: string[], fitnessPercent: number }
 *
 * 다음 라운드에서 provider별 fetch 구현 예정.
 */
export async function analyze({ profile, guide, jobText, llmConfig }) {
  switch (llmConfig?.provider) {
    case "claude":
    case "openai":
    case "gemini":
      throw new Error("Not implemented: LLM 호출은 다음 라운드에서 구현됩니다.");
    default:
      throw new Error(`알 수 없는 LLM provider: ${llmConfig?.provider}`);
  }
}

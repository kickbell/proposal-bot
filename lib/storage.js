export async function getProfile() {
  const { profile } = await chrome.storage.local.get("profile");
  return profile ?? null;
}

export async function getPainPointsGuide() {
  const { painPointsGuide } = await chrome.storage.local.get("painPointsGuide");
  return painPointsGuide ?? null;
}

export async function getLlmConfig() {
  const { llm } = await chrome.storage.local.get("llm");
  return llm ?? null;
}

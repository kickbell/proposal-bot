const fields = {
  career: document.getElementById("career"),
  domain: document.getElementById("domain"),
  stack: document.getElementById("stack"),
  guide: document.getElementById("guide"),
  provider: document.getElementById("provider"),
  model: document.getElementById("model"),
  apiKey: document.getElementById("apiKey"),
};
const saveBtn = document.getElementById("saveBtn");
const toast = document.getElementById("toast");

async function load() {
  const { profile, painPointsGuide, llm } = await chrome.storage.local.get([
    "profile",
    "painPointsGuide",
    "llm",
  ]);
  if (profile) {
    fields.career.value = profile.career ?? "";
    fields.domain.value = profile.domain ?? "";
    fields.stack.value = profile.stack ?? "";
  }
  if (painPointsGuide) {
    fields.guide.value = painPointsGuide;
  }
  if (llm) {
    fields.provider.value = llm.provider ?? "claude";
    fields.model.value = llm.model ?? "";
    fields.apiKey.value = llm.apiKey ?? "";
  }
}

async function save() {
  const profile = {
    career: fields.career.value.trim(),
    domain: fields.domain.value.trim(),
    stack: fields.stack.value.trim(),
  };
  const painPointsGuide = fields.guide.value.trim();
  const llm = {
    provider: fields.provider.value,
    model: fields.model.value.trim(),
    apiKey: fields.apiKey.value.trim(),
  };

  await chrome.storage.local.set({ profile, painPointsGuide, llm });

  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2000);
}

load();
saveBtn.addEventListener("click", save);

const fields = {
  provider: document.getElementById("provider"),
  model: document.getElementById("model"),
  apiKey: document.getElementById("apiKey"),
};
const saveBtn = document.getElementById("saveBtn");
const toast = document.getElementById("toast");

async function load() {
  const { llm } = await chrome.storage.local.get("llm");
  fields.provider.value = llm?.provider ?? "gemini";
  fields.model.value = llm?.model ?? "";
  fields.apiKey.value = llm?.apiKey ?? "";
}

async function save() {
  const llm = {
    provider: fields.provider.value,
    model: fields.model.value.trim(),
    apiKey: fields.apiKey.value.trim(),
  };
  await chrome.storage.local.set({ llm });
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2000);
}

load();
saveBtn.addEventListener("click", save);

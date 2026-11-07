// Device-local settings only. Never used to alter catch or trip records.
export const MAX_FREEZERS = 100;
export const emptySettings = () => ({ freezerCount: "", averageBlockKg: "", blocks: [] });
export const settingsKey = (userId) => {
  if (!userId) throw new Error("Missing user id");
  return `fryselogg:freezer-settings:v1:${encodeURIComponent(userId)}`;
};
const integer = (value) => /^\d+$/.test(String(value).trim()) && Number.isSafeInteger(Number(value));
export function validateSettings(value) {
  if (!value || !integer(value.freezerCount) || Number(value.freezerCount) < 1 || Number(value.freezerCount) > MAX_FREEZERS) throw new Error("freezerCountInvalid");
  const weight = String(value.averageBlockKg ?? "").trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(weight) || !Number.isFinite(Number(weight)) || Number(weight) <= 0) throw new Error("blockWeightInvalid");
  if (!Array.isArray(value.blocks) || value.blocks.length < Number(value.freezerCount) || value.blocks.length > MAX_FREEZERS || !value.blocks.every(integer)) throw new Error("blockCountsInvalid");
  return { freezerCount: Number(value.freezerCount), averageBlockKg: Number(weight), blocks: value.blocks.map(Number) };
}
export function loadSettings(storage, userId) {
  try {
    const raw = storage.getItem(settingsKey(userId));
    return { value: raw === null ? emptySettings() : validateSettings(JSON.parse(raw)), error: null };
  } catch { return { value: emptySettings(), error: "settingsLoadFailed" }; }
}
export function saveSettings(storage, userId, value) {
  const normalized = validateSettings(value);
  storage.setItem(settingsKey(userId), JSON.stringify(normalized));
  return normalized;
}

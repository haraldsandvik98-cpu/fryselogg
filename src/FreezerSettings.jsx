import { useEffect, useRef, useState } from "react";
import { I18N } from "./i18n.js";
import { emptySettings, loadSettings, saveSettings, MAX_FREEZERS } from "./freezerSettings.js";

export default function FreezerSettings({ userId, lang, onBack }) {
  const text = I18N[lang];
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const [loaded] = useState(() => {
    try { return loadSettings(window.localStorage, userId); }
    catch { return { value: emptySettings(), error: "settingsLoadFailed" }; }
  });
  const [value, setValue] = useState(loaded.value);
  const [error, setError] = useState(loaded.error);
  const [saved, setSaved] = useState(false);
  const count = /^\d+$/.test(String(value.freezerCount)) ? Number(value.freezerCount) : 0;
  const visibleCount = count >= 1 && count <= MAX_FREEZERS ? count : 0;
  const change = (next) => { setValue(next); setSaved(false); setError(null); };
  const save = (event) => {
    event.preventDefault();
    setSaved(false);
    try {
      saveSettings(window.localStorage, userId, value);
      setError(null);
      setSaved(true);
    } catch (failure) {
      setError(["freezerCountInvalid", "blockWeightInvalid", "blockCountsInvalid"].includes(failure?.message) ? failure.message : "settingsSaveFailed");
    }
  };
  return (
    <section className="card" aria-labelledby="settings-heading">
      <h2 id="settings-heading" tabIndex={-1} ref={heading}>{text.settings}</h2>
      <p className="hint">{text.settingsLocal}</p>
      <form onSubmit={save} noValidate>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="freezer-count">{text.freezerCount}</label>
            <input id="freezer-count" inputMode="numeric" value={value.freezerCount} onChange={(event) => {
              const nextCount = Number(event.target.value);
              const blocks = [...value.blocks];
              if (Number.isInteger(nextCount) && nextCount > 0 && nextCount <= MAX_FREEZERS) while (blocks.length < nextCount) blocks.push("");
              change({ ...value, freezerCount: event.target.value, blocks });
            }} aria-describedby="freezer-count-help" />
            <p className="hint" id="freezer-count-help">{text.freezerCountHelp}</p>
          </div>
          <div className="field">
            <label htmlFor="block-weight">{text.averageBlockKg}</label>
            <input id="block-weight" inputMode="decimal" value={value.averageBlockKg} onChange={(event) => change({ ...value, averageBlockKg: event.target.value })} />
          </div>
        </div>
        <div className="grid-2">
          {Array.from({ length: visibleCount }, (_, index) => (
            <div className="field" key={index}>
              <label htmlFor={`freezer-blocks-${index}`}>{text.freezer} {index + 1} — {text.blockCount}</label>
              <input id={`freezer-blocks-${index}`} inputMode="numeric" value={value.blocks[index] ?? ""} onChange={(event) => {
                const blocks = [...value.blocks]; blocks[index] = event.target.value; change({ ...value, blocks });
              }} />
            </div>
          ))}
        </div>
        <p className="hint">{text.hiddenCountsKept}</p>
        {error && <p className="error" role="alert">{text[error]}</p>}
        {saved && <p role="status">{text.settingsSaved}</p>}
        <div className="settings-actions">
          <button type="submit" className="btn btn-primary">{text.saveSettings}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>{text.backToLog}</button>
        </div>
        <p className="hint">{text.settingsBackHint}</p>
      </form>
    </section>
  );
}

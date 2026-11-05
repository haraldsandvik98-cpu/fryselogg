import { useEffect, useMemo, useState } from "react";
import { I18N, SPECIES } from "./i18n.js";
import { supabase, supabaseConfigured } from "./supabase.js";

const LANG_KEY = "fryselogg_lang";

function t(lang, key) {
  return I18N[lang][key];
}

function formatDateTime(iso, lang) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso).replace("T", " ");
  return date.toLocaleString(lang === "no" ? "nb-NO" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatQty(n, unit, lang) {
  const value = Number(n) || 0;
  return `${value.toLocaleString(lang === "no" ? "nb-NO" : "en-GB", {
    maximumFractionDigits: 1
  })} ${unit || "kg"}`;
}

function toLocalInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function totalsFor(catches) {
  const bySpecies = {};
  let total = 0;
  (catches || []).forEach((c) => {
    const qty = Number(c.quantity) || 0;
    const key = `${c.species} (${c.unit || "kg"})`;
    bySpecies[key] = (bySpecies[key] || 0) + qty;
    total += qty;
  });
  return { bySpecies, total };
}

export default function App() {
  const [lang, setLangState] = useState(() => (localStorage.getItem(LANG_KEY) === "en" ? "en" : "no"));
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [trips, setTrips] = useState([]);
  const [dataError, setDataError] = useState("");
  const [busy, setBusy] = useState(false);
  const [boat, setBoat] = useState("");
  const [tripNotes, setTripNotes] = useState("");
  const [species, setSpecies] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [location, setLocation] = useState("");
  const [caughtAt, setCaughtAt] = useState(toLocalInputValue());
  const [temperature, setTemperature] = useState("");
  const [catchNotes, setCatchNotes] = useState("");

  const setLang = (next) => {
    const value = next === "en" ? "en" : "no";
    setLangState(value);
    localStorage.setItem(LANG_KEY, value);
    document.documentElement.lang = value === "en" ? "en" : "no";
  };

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "no";
  }, [lang]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadTrips = async () => {
    if (!supabase || !session) return;
    const { data, error } = await supabase
      .from("fryselogg_trips")
      .select("*, fryselogg_catches(*)")
      .order("created_at", { ascending: false });
    if (error) {
      setDataError(t(lang, "loadError") + " " + error.message);
      return;
    }
    setDataError("");
    setTrips((data || []).map((trip) => ({
      ...trip,
      catches: trip.fryselogg_catches || trip.catches || []
    })));
  };

  useEffect(() => {
    if (session) loadTrips();
  }, [session]);

  const active = useMemo(() => trips.find((trip) => !trip.ended_at) || null, [trips]);
  const past = useMemo(() => trips.filter((trip) => trip.ended_at), [trips]);

  const handleAuth = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError("");
    const fn = mode === "signup" ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn({ email: email.trim(), password });
    if (error) setAuthError(error.message);
    setAuthBusy(false);
  };

  const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setTrips([]);
  };

  const startTrip = async () => {
    if (!supabase || !session) return;
    setBusy(true);
    const { error } = await supabase.from("fryselogg_trips").insert({
      user_id: session.user.id,
      boat: boat.trim() || null,
      notes: tripNotes.trim() || null,
      started_at: new Date().toISOString()
    });
    setBusy(false);
    if (error) {
      setDataError(t(lang, "saveError") + " " + error.message);
      return;
    }
    setBoat("");
    setTripNotes("");
    await loadTrips();
  };

  const addCatch = async (event) => {
    event.preventDefault();
    if (!supabase || !active) return;
    const qty = Number(quantity);
    if (!species.trim() || !qty || qty <= 0) return;
    setBusy(true);
    const { error } = await supabase.from("fryselogg_catches").insert({
      trip_id: active.id,
      species: species.trim(),
      quantity: qty,
      unit: unit || "kg",
      location: location.trim() || null,
      caught_at: caughtAt ? new Date(caughtAt).toISOString() : new Date().toISOString(),
      temperature: temperature === "" ? null : Number(temperature),
      notes: catchNotes.trim() || null
    });
    setBusy(false);
    if (error) {
      setDataError(t(lang, "saveError") + " " + error.message);
      return;
    }
    setSpecies("");
    setQuantity("");
    setTemperature("");
    setCatchNotes("");
    setCaughtAt(toLocalInputValue());
    await loadTrips();
  };

  const deleteCatch = async (id) => {
    if (!supabase || !window.confirm(t(lang, "confirmDelete"))) return;
    const { error } = await supabase.from("fryselogg_catches").delete().eq("id", id);
    if (error) {
      setDataError(t(lang, "saveError") + " " + error.message);
      return;
    }
    await loadTrips();
  };

  const endTrip = async () => {
    if (!supabase || !active || !window.confirm(t(lang, "confirmEnd"))) return;
    const { error } = await supabase
      .from("fryselogg_trips")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) {
      setDataError(t(lang, "saveError") + " " + error.message);
      return;
    }
    await loadTrips();
  };

  const renderTotals = (catches) => {
    const { bySpecies, total } = totalsFor(catches);
    const names = Object.keys(bySpecies);
    if (!names.length) return <p className="empty">{t(lang, "totalsEmpty")}</p>;
    return (
      <>
        {names
          .sort((a, b) => bySpecies[b] - bySpecies[a])
          .map((name) => (
            <div className="total-row" key={name}>
              <span>{name}</span>
              <span className="kg">{formatQty(bySpecies[name], "", lang).trim()}</span>
            </div>
          ))}
        <div className="total-row">
          <strong>{t(lang, "grandTotal")}</strong>
          <strong className="kg grand">{formatQty(total, "kg", lang)}</strong>
        </div>
      </>
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="logo" aria-hidden="true">F</div>
          <div>
            <h1>Fryselogg</h1>
            <p>{t(lang, "tagline")}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="lang-toggle" role="group" aria-label="Language">
            <button type="button" className={lang === "no" ? "active" : ""} onClick={() => setLang("no")}>NO</button>
            <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          {session && (
            <button type="button" className="btn btn-ghost" onClick={logout}>{t(lang, "logout")}</button>
          )}
        </div>
      </header>

      {!supabaseConfigured && (
        <section className="card">
          <p className="error">{t(lang, "missingConfig")}</p>
        </section>
      )}

      {authReady && supabaseConfigured && !session && (
        <section className="card login-card">
          <h2>{t(lang, mode === "signup" ? "signupTitle" : "loginTitle")}</h2>
          <p className="hint">{t(lang, mode === "signup" ? "signupHint" : "loginHint")}</p>
          <form onSubmit={handleAuth}>
            <div className="field">
              <label htmlFor="email">{t(lang, "labelEmail")}</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">{t(lang, "labelPassword")}</label>
              <input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {authError && <p className="error">{authError}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={authBusy}>
              {t(lang, mode === "signup" ? "signupSubmit" : "loginSubmit")}
            </button>
          </form>
          <p className="hint">
            {t(lang, mode === "signup" ? "haveAccount" : "needAccount")}{" "}
            <button type="button" className="linkish" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setAuthError(""); }}>
              {t(lang, mode === "signup" ? "goLogin" : "goSignup")}
            </button>
          </p>
        </section>
      )}

      {session && (
        <>
          <section className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>{t(lang, "tripHeading")}</h2>
              <span className={`status-pill${active ? "" : " idle"}`}>
                {t(lang, active ? "statusActive" : "statusIdle")}
              </span>
            </div>
            <p className="meta">
              {active ? `${t(lang, "tripStarted")}: ${formatDateTime(active.started_at, lang)}${active.boat ? ` · ${active.boat}` : ""}` : ""}
            </p>
            {dataError && <p className="error">{dataError}</p>}

            {!active && (
              <>
                <p className="hint">{t(lang, "noTripHint")}</p>
                <div className="field">
                  <label htmlFor="boat">{t(lang, "labelBoat")}</label>
                  <input id="boat" value={boat} onChange={(e) => setBoat(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="tripNotes">{t(lang, "labelTripNotes")}</label>
                  <textarea id="tripNotes" value={tripNotes} onChange={(e) => setTripNotes(e.target.value)} />
                </div>
                <button className="btn btn-primary btn-block" type="button" onClick={startTrip} disabled={busy}>
                  {t(lang, "startTrip")}
                </button>
              </>
            )}

            {active && (
              <form onSubmit={addCatch}>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="art">{t(lang, "labelArt")}</label>
                    <input id="art" list="artList" value={species} onChange={(e) => setSpecies(e.target.value)} required />
                    <datalist id="artList">
                      {SPECIES[lang].map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div className="field">
                    <label htmlFor="mengde">{t(lang, "labelMengde")}</label>
                    <input id="mengde" type="number" min="0.1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="unit">{t(lang, "labelUnit")}</label>
                    <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option value="kg">kg</option>
                      <option value="t">t</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="sted">{t(lang, "labelSted")}</label>
                    <input id="sted" value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="tid">{t(lang, "labelTid")}</label>
                    <input id="tid" type="datetime-local" value={caughtAt} onChange={(e) => setCaughtAt(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="temp">{t(lang, "labelTemp")}</label>
                    <input id="temp" type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="catchNotes">{t(lang, "labelCatchNotes")}</label>
                  <input id="catchNotes" value={catchNotes} onChange={(e) => setCatchNotes(e.target.value)} />
                </div>
                <div className="btn-row">
                  <button className="btn btn-primary" type="submit" style={{ flex: 1 }} disabled={busy}>{t(lang, "addCatch")}</button>
                  <button className="btn btn-warn" type="button" onClick={endTrip}>{t(lang, "endTrip")}</button>
                </div>
              </form>
            )}
          </section>

          <section className="card">
            <h2>{t(lang, "totalsHeading")}</h2>
            {renderTotals(active ? active.catches || [] : [])}
          </section>

          {active && (
            <section className="card">
              <h2>{t(lang, "catchesHeading")}</h2>
              {!(active.catches || []).length ? (
                <p className="empty">{t(lang, "totalsEmpty")}</p>
              ) : (
                [...(active.catches || [])].reverse().map((c) => (
                  <div className="catch-row" key={c.id}>
                    <div className="catch-main">
                      <strong>{c.species} · {formatQty(c.quantity, c.unit, lang)}</strong>
                      <div className="meta">
                        {[c.location, formatDateTime(c.caught_at || c.created_at, lang), c.temperature == null ? "" : `${c.temperature} °C`, c.notes]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <button className="small-link" type="button" onClick={() => deleteCatch(c.id)}>{t(lang, "deleteCatch")}</button>
                  </div>
                ))
              )}
            </section>
          )}

          <section className="card">
            <h2>{t(lang, "pastHeading")}</h2>
            {!past.length ? (
              <p className="empty">{t(lang, "pastEmpty")}</p>
            ) : (
              past.map((trip, index) => (
                <details key={trip.id} style={{ display: "block", borderTop: index ? "1px solid var(--line)" : 0, padding: "12px 0" }}>
                  <summary style={{ cursor: "pointer", listStyle: "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <strong>{t(lang, "tripLabel")} {formatDateTime(trip.started_at, lang)}{trip.boat ? ` · ${trip.boat}` : ""}</strong>
                        <div className="meta">
                          {t(lang, "ended")}: {formatDateTime(trip.ended_at, lang)} · {(trip.catches || []).length} {t(lang, "catches")}
                        </div>
                      </div>
                      <span className="kg">{formatQty(totalsFor(trip.catches || []).total, "kg", lang)}</span>
                    </div>
                  </summary>
                  <div style={{ marginTop: 10 }}>{renderTotals(trip.catches || [])}</div>
                </details>
              ))
            )}
          </section>

          <p className="userbar">{t(lang, "signedIn")} {session.user.email}</p>
        </>
      )}
    </div>
  );
}

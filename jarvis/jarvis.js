// Джарвис: голосовой ассистент в браузере.
// Речь распознаётся и озвучивается средствами браузера (Web Speech API).
// Два режима:
//  * через домашний сервер (jarvis-server): общая память с часами, термостат, камеры, сеть, файлы;
//  * напрямую в Claude API с ключом в браузере: только разговор.
// Настройки и ключи хранятся только в этом браузере.
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";
const MODEL = "claude-haiku-5-5";
const MAX_SENT_MESSAGES = 40;          // сколько последних сообщений отправлять в Claude (прямой режим)
const FOLLOW_UP_MS = 7000;             // после ответа можно продолжать без слова «Джарвис»
const WAKE_RE = /(?:^|[\s,.!?])(джарвис|джарвиз|жарвис|джервис|jarvis)[\s,.!?:-]*/i;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const $ = (id) => document.getElementById(id);
const els = {
  orb: $("orb"), status: $("status"), heard: $("heard"), log: $("log"),
  form: $("form"), text: $("text"), mic: $("micBtn"), fileInput: $("fileInput"),
  attachments: $("attachments"), drop: $("drop"), clear: $("clearBtn"),
  settingsBtn: $("settingsBtn"), dialog: $("settings"), apiKey: $("apiKey"),
  voice: $("voice"), rate: $("rate"), wake: $("wake"), speak: $("speak"), testVoice: $("testVoice"),
  serverUrl: $("serverUrl"), serverKey: $("serverKey"), mode: $("mode"),
};

// ---------- хранилище ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("jarvis." + key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("jarvis." + key, JSON.stringify(value)); } catch { /* приватный режим */ }
  },
};

const settings = Object.assign(
  { apiKey: "", serverUrl: "", serverKey: "", voiceURI: "", rate: 1.05, wake: true, speak: true },
  store.get("settings", {}),
);
const saveSettings = () => store.set("settings", settings);
const serverMode = () => Boolean(settings.serverUrl && settings.serverKey);
const configured = () => serverMode() || Boolean(settings.apiKey);

// История прямого режима: { role, content (только текст), display }.
// В Claude уходит только текст прошлых реплик, поэтому её можно спокойно обрезать.
let turns = store.get("history", []).map((t) => (
  t.role === "assistant" && typeof t.content !== "string" ? { ...t, content: t.display?.text ?? "" } : t
));
const saveHistory = () => store.set("history", turns);

// ---------- состояние ----------
let active = false;          // Джарвис включён и слушает
let busy = false;            // думает или говорит
let awaitingCommand = false; // следующая фраза — команда, слово «Джарвис» не нужно
let followUpTimer = null;
let pending = [];            // прикреплённые, но ещё не отправленные файлы
let abortCtl = null;

function setState(state, text) {
  document.body.dataset.state = state;
  if (text != null) els.status.textContent = text;
}
setState("off");

function idleStatus() {
  if (!active) return "Нажмите на круг, чтобы включить";
  if (awaitingCommand) return "Слушаю…";
  return settings.wake ? "Жду слово «Джарвис»" : "Слушаю…";
}
function goIdle() {
  busy = false;
  setState(active ? (awaitingCommand ? "listening" : "waiting") : "off", idleStatus());
  if (active) startRec();
}

// ---------- журнал на экране ----------
function addImage(base64, mime = "image/jpeg") {
  const img = document.createElement("img");
  img.className = "snapshot";
  img.alt = "Снимок с камеры";
  img.src = `data:${mime};base64,${base64}`;
  els.log.append(img);
  img.scrollIntoView({ block: "end", behavior: "smooth" });
}

function addMsg(role, text, files = []) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  if (files.length) {
    const f = document.createElement("span");
    f.className = "files";
    f.textContent = "📎 " + files.join(", ");
    div.append(f);
  }
  const body = document.createElement("span");
  body.textContent = text;
  div.append(body);
  els.log.append(div);
  div.scrollIntoView({ block: "end", behavior: "smooth" });
  return body;
}
function renderLocalHistory() {
  els.log.innerHTML = "";
  for (const t of turns) addMsg(t.role, t.display?.text ?? "", t.display?.files ?? []);
}

// Общая история с сервера: что говорили с часов и телефона, тоже видно здесь.
async function loadServerHistory() {
  try {
    const data = await serverCall("/api/history?limit=60");
    els.log.innerHTML = "";
    for (const m of data.messages) {
      const text = m.role === "user" ? m.content.replace(/^\[[^\]]*\]\n/, "") : m.content;
      addMsg(m.role, text);
    }
  } catch (err) {
    els.log.innerHTML = "";
    addMsg("error", explainServerError(err));
  }
}
function renderHistory() { serverMode() ? loadServerHistory() : renderLocalHistory(); }

// ---------- озвучка ----------
const synth = window.speechSynthesis;
let voices = [];
function loadVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  const ru = voices.filter((v) => v.lang?.toLowerCase().startsWith("ru"));
  const list = ru.length ? [...ru, ...voices.filter((v) => !ru.includes(v))] : voices;
  els.voice.innerHTML = "";
  for (const v of list) {
    const o = document.createElement("option");
    o.value = v.voiceURI;
    o.textContent = `${v.name} (${v.lang})`;
    els.voice.append(o);
  }
  if (!settings.voiceURI && ru.length) {
    // Предпочитаем мужской или «облачный» русский голос, если он есть.
    const pick = ru.find((v) => /yuri|юрий|pavel|павел|dmitr|дмитр|maxim|google/i.test(v.name)) || ru[0];
    settings.voiceURI = pick.voiceURI;
  }
  els.voice.value = settings.voiceURI;
}
if (synth) { loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices); }

let speaking = 0;
let speechDone = null;
function speakNow(text) {
  const clean = forSpeech(text);
  if (!clean || !synth || !settings.speak) return;
  const u = new SpeechSynthesisUtterance(clean);
  const v = voices.find((x) => x.voiceURI === settings.voiceURI);
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "ru-RU"; }
  u.rate = settings.rate;
  speaking++;
  setState("speaking");
  const finish = () => { speaking = Math.max(0, speaking - 1); if (!speaking && speechDone) speechDone(); };
  u.onend = finish;
  u.onerror = finish;
  synth.speak(u);
}
function waitSpeech() {
  return new Promise((resolve) => {
    if (!speaking) return resolve();
    speechDone = () => { speechDone = null; resolve(); };
  });
}
function stopSpeech() {
  if (synth) synth.cancel();
  speaking = 0;
  if (speechDone) speechDone();
}
function forSpeech(t) {
  return t
    .replace(/```[\s\S]*?```/g, " (код на экране) ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "ссылка на экране")
    .replace(/[*_#`>|~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function beep() {
  try {
    const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.15);
  } catch { /* без звука */ }
}

// ---------- распознавание речи ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let recRunning = false;

function startRec() {
  if (!SR || recRunning || busy) return;
  rec = new SR();
  rec.lang = "ru-RU";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) handleUtterance(r[0].transcript.trim());
      else interim += r[0].transcript;
    }
    if (interim && !busy) els.heard.textContent = interim;
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      active = false;
      addMsg("error", "Нет доступа к микрофону. Разрешите его в настройках браузера для этого сайта.");
      goIdle();
    }
  };
  rec.onend = () => {
    recRunning = false;
    if ((active || awaitingCommand) && !busy) setTimeout(startRec, 250);
  };
  try { rec.start(); recRunning = true; } catch { recRunning = false; }
}
function stopRec() {
  if (rec && recRunning) { try { rec.abort(); } catch { /* уже остановлен */ } }
  recRunning = false;
}

function armFollowUp(ms) {
  awaitingCommand = true;
  clearTimeout(followUpTimer);
  followUpTimer = setTimeout(() => {
    awaitingCommand = false;
    if (!busy) { setState(active ? "waiting" : "off", idleStatus()); if (!active) stopRec(); }
  }, ms);
}

function handleUtterance(text) {
  if (!text || busy) return;
  els.heard.textContent = text;
  if (!settings.wake || awaitingCommand) {
    clearTimeout(followUpTimer);
    awaitingCommand = false;
    return send(text);
  }
  const m = text.match(WAKE_RE);
  if (!m) return;
  const rest = text.slice(m.index + m[0].length).trim();
  if (rest.length > 1) return send(rest);
  beep();
  armFollowUp(8000);
  setState("listening", "Слушаю…");
}

// ---------- файлы ----------
function readAs(file, how) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    if (how === "text") r.readAsText(file); else r.readAsDataURL(file);
  });
}
async function addFiles(files) {
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) { addMsg("error", `«${file.name}» больше 20 МБ, такой файл не отправить.`); continue; }
    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const data = (await readAs(file, "url")).split(",")[1];
        pending.push({ name: file.name, mime: "application/pdf", data, block: { type: "document", title: file.name, source: { type: "base64", media_type: "application/pdf", data } } });
      } else if (IMAGE_TYPES.includes(file.type)) {
        const data = (await readAs(file, "url")).split(",")[1];
        pending.push({ name: file.name, mime: file.type, data, block: { type: "image", source: { type: "base64", media_type: file.type, data } } });
      } else {
        const text = await readAs(file, "text");
        const data = (await readAs(file, "url")).split(",")[1];
        pending.push({ name: file.name, mime: "text/plain", data, block: { type: "text", text: `Файл «${file.name}»:\n\n${text}` } });
      }
    } catch {
      addMsg("error", `Не удалось прочитать «${file.name}».`);
    }
  }
  renderPending();
}
function renderPending() {
  els.attachments.innerHTML = "";
  pending.forEach((p, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "📎 " + p.name;
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "✕";
    x.title = "Убрать";
    x.onclick = () => { pending.splice(i, 1); renderPending(); };
    chip.append(x);
    els.attachments.append(chip);
  });
}
els.fileInput.addEventListener("change", () => { addFiles([...els.fileInput.files]); els.fileInput.value = ""; });
let dragDepth = 0;
addEventListener("dragenter", (e) => { if (e.dataTransfer?.types?.includes("Files")) { dragDepth++; els.drop.hidden = false; } });
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; els.drop.hidden = true; } });
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.drop.hidden = true;
  if (e.dataTransfer?.files?.length) addFiles([...e.dataTransfer.files]);
});

// ---------- Claude ----------
// Системный подсказ не меняется между запросами (дата идёт в сообщение пользователя):
// у новых моделей Claude правка начала разговора ломает сохранённые размышления.
const SYSTEM_PROMPT = [
  "Ты — Джарвис, личный голосовой ассистент владельца этой страницы. Характер: спокойный, вежливый, собранный, с лёгкой сухой иронией, как у хорошего дворецкого. Обращайся на «вы».",
  "Твои ответы озвучиваются синтезатором речи, поэтому:",
  "- отвечай коротко, 1–4 предложения, если не просят подробнее;",
  "- пиши обычным разговорным текстом: без markdown, заголовков, списков со звёздочками, таблиц и эмодзи;",
  "- если нужен код или длинный текст, скажи одной фразой, что он на экране, и приведи его.",
  "Отвечай на языке собеседника; по умолчанию — по-русски.",
  "Распознавание речи иногда ошибается в словах. Если фраза звучит странно, пойми её по смыслу, а если смысл неясен — переспроси.",
  "В начале сообщения пользователя в квадратных скобках — текущие дата и время, это служебная пометка.",
  "Если пользователь прикрепил файлы, опирайся на их содержимое. Если ответ требует того, к чему у тебя нет доступа (интернет, почта, календарь, файлы на компьютере, умный дом), прямо скажи об этом.",
].join("\n");

function timeStamp() {
  return "[" + new Date().toLocaleString("ru-RU", { dateStyle: "full", timeStyle: "short" }) + "]";
}

function messagesForApi(current) {
  // Старые реплики отрезаются блоками, чтобы начало истории менялось редко (так работает кэш).
  const step = MAX_SENT_MESSAGES / 2;
  const start = turns.length > MAX_SENT_MESSAGES ? Math.floor((turns.length - MAX_SENT_MESSAGES) / step + 1) * step : 0;
  let list = turns.slice(start);
  while (list.length && list[0].role !== "user") list = list.slice(1);
  return [...list.map((t) => ({ role: t.role, content: t.content })), current];
}

async function serverCall(path, body, signal) {
  const base = settings.serverUrl.replace(/\/+$/, "");
  let resp;
  try {
    resp = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: "Bearer " + settings.serverKey, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    const e = new Error("unreachable"); e.unreachable = true; throw e;
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) { const e = new Error(data.error || resp.statusText); e.status = resp.status; throw e; }
  return data;
}

function explainServerError(err) {
  if (err?.unreachable) return "Сервер Джарвиса недоступен. Проверьте, что Mac включён, а Tailscale Funnel работает (./jarvis.sh status).";
  if (err?.status === 401) return "Ключ доступа к серверу не подошёл. Проверьте его в настройках (./jarvis.sh key на Mac).";
  if (err?.status === 429) return "Слишком много неверных попыток. Подождите 15 минут.";
  return err?.message || "Ошибка сервера.";
}

function speakText(text) {
  for (const part of text.match(/[^.!?…]+[.!?…]*\s*/g) || [text]) speakNow(part);
}

async function send(text) {
  text = (text || "").trim();
  if (!text && !pending.length) return;
  if (!configured()) { openSettings(); addMsg("error", "Сначала укажите сервер Джарвиса или ключ Claude API в настройках."); return; }

  busy = true;
  stopRec();
  stopSpeech();
  els.heard.textContent = "";

  const files = pending;
  pending = [];
  renderPending();
  const userText = text || "Посмотри прикреплённые файлы.";
  const fileNames = files.map((f) => f.name);
  addMsg("user", userText, fileNames);
  setState("thinking", "Думаю…");
  abortCtl = new AbortController();

  try {
    if (serverMode()) {
      await sendViaServer(userText, files, abortCtl.signal);
    } else {
      await sendDirect(userText, files, fileNames, abortCtl.signal);
    }
    await waitSpeech();
    if (active) armFollowUp(FOLLOW_UP_MS);
  } catch (err) {
    if (err?.name === "AbortError" || /abort/i.test(err?.message ?? "")) {
      // остановлено пользователем
    } else {
      addMsg("error", serverMode() ? explainServerError(err) : explainError(err));
    }
  } finally {
    abortCtl = null;
    goIdle();
  }
}

async function sendViaServer(userText, files, signal) {
  const payload = {
    text: userText,
    source: "web",
    files: files.map((f) => ({ name: f.name, mime: f.mime, data: f.data })),
  };
  const data = await serverCall("/api/ask", payload, signal);
  addMsg("assistant", data.reply);
  for (const img of data.images || []) addImage(img.data, img.mime);
  speakText(data.reply);
}

async function sendDirect(userText, files, fileNames, signal) {
  const { default: Anthropic } = await import(SDK_URL);
  const stamped = `${timeStamp()}\n${userText}`;
  const current = { role: "user", content: [...files.map((f) => f.block), { type: "text", text: stamped }] };
  const out = addMsg("assistant", "");
  let full = "";
  let sentenceBuf = "";
  try {
    const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: messagesForApi(current),
      output_config: { effort: "low" },          // быстрые ответы для разговора
    }, { signal });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        full += event.delta.text;
        sentenceBuf += event.delta.text;
        out.textContent = full;
        out.parentElement.scrollIntoView({ block: "end" });
        // Озвучиваем по предложениям, не дожидаясь конца ответа.
        let m;
        while ((m = sentenceBuf.match(/^[\s\S]*?[.!?…](?=\s)/))) {
          speakNow(m[0]);
          sentenceBuf = sentenceBuf.slice(m[0].length);
        }
      }
    }
    const msg = await stream.finalMessage();
    speakNow(sentenceBuf);

    if (msg.stop_reason === "refusal") {
      out.textContent = "С этим я помочь не могу.";
      speakNow(out.textContent);
      return;
    }
    // В историю — только текст: файлы и размышления модели не пересылаются заново.
    const filesNote = fileNames.length ? `\n[Были прикреплены файлы: ${fileNames.join(", ")}]` : "";
    turns.push({ role: "user", content: stamped + filesNote, display: { text: userText, files: fileNames } });
    turns.push({ role: "assistant", content: full || "…", display: { text: full } });
    saveHistory();
  } catch (err) {
    out.parentElement.remove();
    throw err;
  }
}

function explainError(err) {
  const s = err?.status;
  if (s === 401) return "Ключ API не подошёл. Проверьте его в настройках.";
  if (s === 402 || /credit|billing/i.test(err?.message ?? "")) return "На счёте API закончились средства (console.anthropic.com → Billing).";
  if (s === 429) return "Слишком много запросов, подождите немного.";
  if (s === 413) return "Файлы слишком большие для одного запроса.";
  if (s >= 500) return "Сервис Claude сейчас недоступен, попробуйте ещё раз.";
  if (!navigator.onLine) return "Нет подключения к интернету.";
  return "Ошибка: " + (err?.message || err);
}

// ---------- кнопки ----------
els.orb.addEventListener("click", () => {
  if (busy) {                      // перебить ответ
    abortCtl?.abort();
    stopSpeech();
    return;
  }
  if (!configured()) { openSettings(); return; }
  if (!SR) { addMsg("error", "Этот браузер не умеет распознавать речь. Откройте страницу в Chrome или Safari, или пишите текстом."); return; }
  active = !active;
  awaitingCommand = false;
  if (active) {
    // Первый запуск озвучки должен быть по нажатию, иначе мобильные браузеры её блокируют.
    if (synth) synth.speak(new SpeechSynthesisUtterance(""));
    beep();
    startRec();
  } else {
    stopRec();
    els.heard.textContent = "";
  }
  setState(active ? "waiting" : "off", idleStatus());
});

els.mic.addEventListener("click", () => {
  if (!SR) { addMsg("error", "Этот браузер не умеет распознавать речь."); return; }
  if (busy) return;
  if (!configured()) { openSettings(); return; }
  beep();
  armFollowUp(10000);
  setState("listening", "Слушаю…");
  startRec();
});

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) return;
  const t = els.text.value;
  els.text.value = "";
  send(t);
});

els.clear.addEventListener("click", async () => {
  const where = serverMode() ? " Она удалится и на сервере: часы тоже начнут разговор заново." : "";
  if (!confirm("Начать новый разговор? Текущая история удалится." + where)) return;
  if (serverMode()) {
    try { await serverCall("/api/reset", {}); } catch (err) { addMsg("error", explainServerError(err)); return; }
  }
  turns = [];
  saveHistory();
  els.log.innerHTML = "";
});

function openSettings() {
  els.apiKey.value = settings.apiKey;
  els.serverUrl.value = settings.serverUrl;
  els.serverKey.value = settings.serverKey;
  els.rate.value = settings.rate;
  els.wake.checked = settings.wake;
  els.speak.checked = settings.speak;
  els.voice.value = settings.voiceURI;
  els.dialog.showModal();
}
els.settingsBtn.addEventListener("click", openSettings);
els.dialog.addEventListener("close", () => {
  const wasServer = serverMode();
  const oldServer = settings.serverUrl + "|" + settings.serverKey;
  settings.apiKey = els.apiKey.value.trim();
  settings.serverUrl = els.serverUrl.value.trim();
  settings.serverKey = els.serverKey.value.trim();
  settings.rate = parseFloat(els.rate.value) || 1;
  settings.wake = els.wake.checked;
  settings.speak = els.speak.checked;
  settings.voiceURI = els.voice.value;
  saveSettings();
  updateModeLabel();
  if (wasServer !== serverMode() || oldServer !== settings.serverUrl + "|" + settings.serverKey) renderHistory();
  if (!busy) setState(document.body.dataset.state, idleStatus());
});

function updateModeLabel() {
  els.mode.textContent = serverMode() ? "через сервер" : settings.apiKey ? "напрямую" : "";
  els.mode.title = serverMode()
    ? "Общая память с часами, термостат, камеры, сеть и файлы"
    : "Только разговор, без домашних подключений";
}
updateModeLabel();
renderHistory();
els.testVoice.addEventListener("click", () => {
  settings.voiceURI = els.voice.value;
  settings.rate = parseFloat(els.rate.value) || 1;
  const was = settings.speak;
  settings.speak = true;
  stopSpeech();
  speakNow("Добрый день. Джарвис на связи и готов помочь.");
  settings.speak = was;
});

if (!SR) els.status.textContent = "Голосовой ввод не поддерживается этим браузером — можно писать текстом";

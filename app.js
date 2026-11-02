import { useFirebase } from "./config.js";
const { db } = await import(useFirebase ? "./db-firebase.js" : "./db-local.js");

const $app = document.getElementById("app");
const $toast = document.getElementById("toast");
let user; // undefined = still checking, null = logged out
let unsubs = [];
let loginMode = "login";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (n) => (String(n || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2) || "?").toUpperCase();
const PALETTE = ["#FF8A4F", "#FFC46B", "#8BD3FF", "#B79CFF", "#7EE0A3", "#FF9DB5"];
const colorOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };
const safe = (key, val) => { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) {} return null; };
let toastTimer;
function toast(msg) { $toast.textContent = msg; $toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => $toast.classList.remove("show"), 2600); }
const clean = () => { unsubs.forEach((u) => { try { u && u(); } catch (e) {} }); unsubs = []; };
const on = (u) => { unsubs.push(u); return u; };

const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M21 4L3 11l6.5 2.5L12 20z"/></svg>',
  hash: '<svg viewBox="0 0 24 24"><path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  invite: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.4-4.2A8 8 0 1 1 8.2 18.7z"/></svg>',
  sms: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2a5 5 0 0 1 4.5 5"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  star: '<svg viewBox="0 0 24 24" style="fill:#111"><path d="M2 5.2L8 6.4h8l6-1.2-.7 2.4H2.7z"/><path d="M4.4 8.6h15.2v1.4H4.4zM5.2 12.2h13.6v1.5H5.2zM10.9 10h2.2v2.2h-2.2zM6.2 8.6h1.6L7.3 20H5.5zM16.2 8.6h1.6l.7 11.4h-1.8z"/></svg>'
};

function mount(html) { $app.innerHTML = html; }
const top = (back, title) => `<div class="top"><a class="iconbtn" href="${back}" aria-label="Back">${I.back}</a>${title ? `<span style="font-size:20px;font-weight:800">${esc(title)}</span>` : ""}</div>`;

/* ---------- Log in / sign up ---------- */
function viewLogin() {
  const signup = loginMode === "signup";
  mount(`<div class="screen login scroll">
    <div class="logo">${I.star}</div>
    <div class="brand">Kamiai</div>
    <div class="tagline">Where anime fans hang out</div>
    <div class="tabs" role="group" aria-label="Log in or sign up">
      <button data-mode="login" aria-pressed="${!signup}">Log in</button>
      <button data-mode="signup" aria-pressed="${signup}">Sign up</button>
    </div>
    <form class="form" id="f" novalidate>
      ${signup ? `<div><label class="label" for="nm">Your name</label><input class="field" id="nm" autocomplete="nickname" placeholder="What should we call you?" maxlength="30"></div>` : ""}
      <div><label class="label" for="em">Email</label><input class="field" id="em" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"></div>
      <div><label class="label" for="pw">Password</label><input class="field" id="pw" type="password" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="${signup ? "At least 6 characters" : "Enter your password"}"></div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn" id="go" type="submit">${signup ? "Create account" : "Log in"}</button>
    </form>
    ${useFirebase ? `<div class="or"><i></i><span>or</span><i></i></div><button class="btn ghost" id="g" type="button">Continue with Google</button>` : `<div class="demo">Demo mode: your account and chats are saved on this phone only. Connect Firebase to chat with friends.</div>`}
    <p class="fine">By continuing, you agree to the Terms and Privacy Policy. Kamiai is for ages 13+.</p>
  </div>`);
  const err = (m) => { document.getElementById("err").textContent = m; };
  $app.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { loginMode = b.dataset.mode; viewLogin(); }));
  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("em").value, pass = document.getElementById("pw").value;
    const name = signup ? document.getElementById("nm").value : "";
    if (!email.includes("@")) return err("Please enter your email.");
    if (pass.length < 6) return err("Password needs at least 6 characters.");
    const btn = document.getElementById("go"); btn.disabled = true; err("");
    try { signup ? await db.signUp(email, pass, name) : await db.logIn(email, pass); }
    catch (x) { err(x.message); btn.disabled = false; }
  });
  const g = document.getElementById("g");
  if (g) g.addEventListener("click", async () => { try { await db.google(); } catch (x) { err(x.message); } });
}

/* ---------- shared helpers ---------- */
const nameCache = {};
const PROF = {};
const STATUS = { online: ["Online", "#3BCB6B"], idle: ["Idle", "#FFC46B"], dnd: ["Do not disturb", "#FF6B6B"], invisible: ["Invisible", "#80808A"] };
const SWATCHES = ["#FF6A1A", "#FF4D6D", "#B79CFF", "#6EC1FF", "#5CE17A", "#FFC46B", "#FF8AD8", "#8A8A94"];
let profBusy = false;
async function loadProfiles(uids) {
  const need = [...new Set(uids)].filter((u) => u && !PROF[u]);
  if (!need.length) return false;
  try { const got = await db.getProfiles(need); need.forEach((u) => { PROF[u] = got[u] || {}; if (got[u] && got[u].name) nameCache[u] = got[u].name; }); }
  catch (e) { return false; }
  return true;
}
async function namesFor(uids) { await loadProfiles(uids); return nameCache; }
const stOf = (uid) => (PROF[uid] && PROF[uid].status) || "online";
const colOf = (uid) => (PROF[uid] && PROF[uid].color) || colorOf(uid);
const avatar = (uid, name, size = 40, dot = false) => {
  const ph = PROF[uid] && PROF[uid].photo;
  const st = stOf(uid), sc = (STATUS[st] || STATUS.online)[1];
  return `<span class="av c has${dot ? " wd" : ""}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;background:${ph ? `#2b2d31 url('${ph}') center/cover` : colOf(uid)}">${ph ? "" : esc(initials(name))}${dot ? `<i class="sdot" style="background:${sc};width:${Math.max(10, Math.round(size * 0.28))}px;height:${Math.max(10, Math.round(size * 0.28))}px"></i>` : ""}</span>`;
};
const stLabel = (uid, self) => { const st = stOf(uid); return st === "invisible" && !self ? "Offline" : (STATUS[st] || STATUS.online)[0]; };
function resizePhoto(file, size = 160) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const k = Math.min(img.width, img.height), sx = (img.width - k) / 2, sy = (img.height - k) / 2;
      c.getContext("2d").drawImage(img, sx, sy, k, k, 0, 0, size, size);
      URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error("Couldn't open that picture.")); };
    img.src = url;
  });
}
const fmtT = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dmUnread = () => Object.keys(unread).filter((k) => k.startsWith("dm:")).reduce((a, k) => a + unread[k], 0);
function rail(servers, active) {
  const n = dmUnread();
  return `<nav class="rail" aria-label="Your servers">
    <a class="sv homebtn ${active === "home" ? "on" : ""}" href="#/dms" aria-label="Direct messages">${I.star}${n ? `<i class="rb">${n}</i>` : ""}</a>
    <div class="sep"></div>
    ${servers.map((s) => `<a class="sv ${s.id === active ? "on" : ""}" href="#/s/${s.id}" aria-label="${esc(s.name)}" ${s.id === active ? 'aria-current="true"' : ""}>${esc(initials(s.name))}</a>`).join("")}
    <a class="sv add" href="#/create" aria-label="Create a server">${I.plus}</a>
  </nav>`;
}
const userbar = () => `<div class="userbar"><a class="ubl" href="#/profile">${avatar(user.uid, user.name, 40, true)}
  <div class="who"><b>${esc(user.name)}</b><span>${esc(stLabel(user.uid, true))}</span></div></a>
  <a class="iconbtn" href="#/profile" aria-label="Settings">${I.gear}</a></div>`;

/* ---------- Home: servers, rooms ---------- */
function viewHome(sid) {
  let servers = null, rooms = [], adding = false;
  const draw = () => {
    if (servers === null) return;
    if (!servers.length) {
      mount(`<div class="screen home">${rail([], "home")}<section class="panel"><div class="empty"><div class="logo">${I.star}</div><h2>Welcome, ${esc(user.name)}!</h2>
        <p class="sub">Servers are places for you and your friends. Make one, or open an invite link a friend sent you.</p>
        <a class="btn" href="#/create" style="max-width:260px">Create a server</a>
        <a class="link" href="#/profile">Your profile</a></div></section></div>`);
      return;
    }
    const cur = servers.find((s) => s.id === sid);
    if (!cur) { go("#/s/" + (safe("kamiai-last") && servers.find((s) => s.id === safe("kamiai-last")) ? safe("kamiai-last") : servers[0].id)); return; }
    safe("kamiai-last", cur.id);
    const owner = cur.ownerId === user.uid;
    mount(`<div class="screen home">${rail(servers, cur.id)}
      <section class="panel">
        <div class="phead"><div class="nm">${esc(cur.name)}<span class="cnt">${cur.members.length} member${cur.members.length === 1 ? "" : "s"}</span></div>
          <a class="iconbtn bg" href="#/invite/${cur.id}" aria-label="Invite friends">${I.invite}</a></div>
        <div class="rooms">
          <div class="sec"><span>TEXT ROOMS</span>${owner ? `<button class="iconbtn" id="addroom" aria-label="Add a room" style="width:32px;height:32px">${I.plus}</button>` : ""}</div>
          ${adding ? `<form id="rf" style="display:flex;gap:8px;padding:0 4px 8px"><label for="rn" style="position:absolute;left:-9999px">Room name</label><input class="field" id="rn" placeholder="new-room" maxlength="24" style="height:44px;font-size:15px"><button class="btn small" type="submit">Add</button></form>` : ""}
          ${rooms.map((r) => `<a class="room" href="#/chat/${cur.id}/${r.id}">${I.hash}<span>${esc(r.name)}</span>${unread[r.id] ? `<i class="ub">${unread[r.id]}</i>` : ""}</a>`).join("")}
        </div>
        ${userbar()}
      </section></div>`);
    const ar = document.getElementById("addroom");
    if (ar) ar.addEventListener("click", () => { adding = !adding; draw(); const i = document.getElementById("rn"); if (i) i.focus(); });
    const rf = document.getElementById("rf");
    if (rf) rf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const n = document.getElementById("rn").value.trim().toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, "-").replace(/^-|-$/g, "");
      if (!n) return;
      try { await db.createRoom(cur.id, n); adding = false; } catch (x) { toast(x.message); }
    });
  };
  on(db.watchDMs(user.uid, () => { if (servers) draw(); }));
  onUnread = () => { if (!adding) draw(); };
  on(() => { onUnread = null; });
  on(db.watchMyServers(user.uid, (s) => { servers = s; draw(); }));
  if (sid) on(db.watchRooms(sid, (r) => { rooms = r; draw(); }));
}

/* ---------- Direct messages home (like Discord's Home tab) ---------- */
function viewDMs() {
  let servers = null, dms = [], showReq = false;
  const other = (d) => d.members.find((x) => x !== user.uid);
  const nm = (d) => (d.names || {})[other(d)] || "Someone";
  const draw = () => {
    if (servers === null) return;
    const reqs = dms.filter((d) => d.status === "pending" && d.requestedBy !== user.uid);
    const list = dms.filter((d) => d.status === "accepted" || d.requestedBy === user.uid);
    let body;
    if (showReq) {
      body = `<button class="room" id="rb">${I.back}<span>Back</span></button>` + (reqs.length ? reqs.map((d) => `<div class="dmrow">${avatar(other(d), nm(d), 44)}<div class="dmtxt"><b>${esc(nm(d))}</b><span>wants to message you</span></div>
        <button class="pill" data-acc="${d.id}">Accept</button><button class="pill ghost" data-dec="${d.id}">Ignore</button></div>`).join("") : '<div class="hint">No requests right now.</div>');
    } else {
      body = (reqs.length ? `<button class="dmrow reqrow" id="rq"><span class="reqicon">${I.invite}</span><div class="dmtxt"><b>Message requests</b><span>${reqs.length} waiting</span></div><i class="ub">${reqs.length}</i></button>` : "")
        + (list.length ? list.map((d) => `<a class="dmrow" href="#/dm/${d.id}">${avatar(other(d), nm(d), 44)}<div class="dmtxt"><b>${esc(nm(d))}</b><span>${d.status === "pending" ? "Request sent · waiting" : esc(d.last || "Say hi 👋")}</span></div>${unread["dm:" + d.id] ? `<i class="ub">${unread["dm:" + d.id]}</i>` : ""}</a>`).join("")
          : (reqs.length ? "" : '<div class="hint"><b>No messages yet</b><br>Tap someone\'s picture in a chat, then press Message.</div>'));
    }
    mount(`<div class="screen home">${rail(servers, "home")}
      <section class="panel"><div class="phead"><div class="nm">${showReq ? "Message requests" : "Direct messages"}</div></div>
        <div class="rooms dml">${body}</div>${userbar()}</section></div>`);
    const rq = document.getElementById("rq"); if (rq) rq.addEventListener("click", () => { showReq = true; draw(); });
    const rb = document.getElementById("rb"); if (rb) rb.addEventListener("click", () => { showReq = false; draw(); });
    document.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", async () => { try { await db.acceptDM(b.dataset.acc); toast("Accepted ✅"); } catch (x) { toast(x.message); } }));
    document.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", async () => { try { await db.declineDM(b.dataset.dec); } catch (x) { toast(x.message); } }));
  };
  on(db.watchMyServers(user.uid, (s) => { servers = s; draw(); }));
  on(db.watchDMs(user.uid, (l) => { dms = l; draw(); loadProfiles(l.map((d) => other(d))).then((ch) => { if (ch) draw(); }); }));
  onUnread = draw;
  on(() => { onUnread = null; });
}

/* ---------- shared message list ---------- */
function msgsHtml(ms) {
  let html = "", lastDay = "", prev = null;
  ms.forEach((m, i) => {
    const d = new Date(m.createdAt), day = d.toDateString();
    if (day !== lastDay) { html += `<div class="day"><i></i><span>${esc(d.toDateString() === new Date().toDateString() ? "Today" : d.toLocaleDateString([], { month: "short", day: "numeric" }))}</span><i></i></div>`; lastDay = day; prev = null; }
    const cont = prev && prev.uid === m.uid && m.createdAt - prev.createdAt < 5 * 60000 && !m.replyTo;
    html += `<div class="msg${cont ? " cont" : ""}" data-i="${i}">${cont ? '<div class="sp"></div>' : `<button class="avb" data-u="${esc(m.uid)}" data-n="${esc(m.name)}" aria-label="${esc(m.name)}, open profile">${avatar(m.uid, m.name)}</button>`}
      <div class="body">${m.replyTo ? `<div class="rpl"><b>${esc(m.replyTo.name)}</b> ${esc(m.replyTo.text)}</div>` : ""}${cont ? "" : `<div class="meta"><b data-u="${esc(m.uid)}" data-n="${esc(m.name)}">${esc(m.name)}</b><time>${fmtT(m.createdAt)}</time></div>`}${m.text ? `<p>${esc(m.text)}${m.edited ? ' <em class="ed">(edited)</em>' : ""}</p>` : ""}${m.image ? `<img class="mimg" src="${esc(m.image)}" alt="Picture sent by ${esc(m.name)}" loading="lazy">` : ""}</div></div>`;
    prev = m;
  });
  return html;
}
// tap a name/picture = profile card; press and hold a message = actions (like Discord)
function wireMsgs(box, ctx) {
  let timer = null, sx = 0, sy = 0, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };
  box.addEventListener("click", (e) => {
    if (fired) { fired = false; return; }
    const im = e.target.closest(".mimg"); if (im) { viewImage(im.src); return; }
    const t = e.target.closest("[data-u]"); if (t) openProfile({ uid: t.dataset.u, name: t.dataset.n }, ctx);
  });
  box.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".msg"); if (!el) return;
    sx = e.clientX; sy = e.clientY; fired = false;
    timer = setTimeout(() => {
      const m = (box.__ms || [])[+el.dataset.i]; if (!m) return;
      fired = true; try { if (navigator.vibrate) navigator.vibrate(15); } catch (x) {}
      openSheet(m, ctx);
    }, 450);
  });
  box.addEventListener("pointermove", (e) => { if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) cancel(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => box.addEventListener(ev, cancel));
  box.addEventListener("scroll", cancel, { passive: true });
  box.addEventListener("contextmenu", (e) => e.preventDefault());
}
const EMOJI = {
  "😀": "😀😃😄😁😆😅😂🤣🥲😊😇🙂😉😍🥰😘😋😛😜🤪😎🤩🥳😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫😶😐😑😬🙄😯😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷",
  "👍": "👍👎👊✊🤛🤜👏🙌🤝🙏💪🤞✌️🤟🤘👌🤌👈👉👆👇☝️✋🤚🖐️👋🤙🫶🫡",
  "❤️": "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝✨🌟⭐🔥💥💯✅❌❗❓💤💢💦",
  "🍥": "🍥🍜🍙🍣🍡🍵🍶🌸⛩️🎌🗾🏯🎴🎎🎏🎐🐉🦊🐱🐶🐰🐼🦁🐯🐸🌙☀️⚡🌈❄️🌊⚔️🗡️🛡️🏹🎮🎧🎤📚🎬🎨",
  "🎉": "🎉🎊🎈🎁🏆🥇⚽🏀🏈🎯🍕🍔🍟🌭🍿🍩🍪🍫🍰🍦☕🍺🚀✈️🚗🏠💻📱💡⏰"
};
function composer(placeholder) {
  return `<div class="cstate" id="cs" hidden></div><div class="emopanel" id="ep" hidden></div>
  <form class="composer" id="cf" autocomplete="off">
    <button class="cbtn" id="ca" type="button" aria-label="Send a picture">${I.plus}</button>
    <div class="cwrap"><label for="mi" style="position:absolute;left:-9999px">Message</label>
      <input id="mi" placeholder="${esc(placeholder)}" maxlength="2000" enterkeyhint="send">
      <button class="cbtn inner" id="ce" type="button" aria-label="Emoji">😀</button></div>
    <button class="send" aria-label="Send" type="submit">${I.send}</button>
    <input type="file" id="cfile" accept="image/*" hidden></form>`;
}
function resizeImage(file, max = 800) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error("Couldn't open that picture.")); };
    img.src = url;
  });
}
function viewImage(src) {
  const bg = document.createElement("div");
  bg.className = "imgview"; bg.innerHTML = `<img src="${esc(src)}" alt="Picture"><button class="iconbtn" aria-label="Close">${I.back}</button>`;
  bg.addEventListener("click", () => bg.remove());
  $app.appendChild(bg);
}
// returns a small controller so the message menu can start a reply or an edit
function wireComposer(h, box) {
  const input = document.getElementById("mi"), cf = document.getElementById("cf"), cs = document.getElementById("cs"), ep = document.getElementById("ep");
  const file = document.getElementById("cfile");
  let reply = null, edit = null, image = "", busy = false;
  const sync = () => cf.classList.toggle("has", !!(input.value.trim() || image));
  const state = () => {
    const parts = [];
    if (edit) parts.push(`<div class="cs-row"><span>Editing message</span><button type="button" data-x="edit" aria-label="Cancel">✕</button></div>`);
    if (reply) parts.push(`<div class="cs-row"><span>Replying to <b>${esc(reply.name)}</b></span><button type="button" data-x="reply" aria-label="Cancel">✕</button></div>`);
    if (image) parts.push(`<div class="cs-row img"><img src="${esc(image)}" alt="Picture to send"><button type="button" data-x="image" aria-label="Remove picture">✕</button></div>`);
    cs.hidden = !parts.length; cs.innerHTML = parts.join("");
    sync();
  };
  cs.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.x === "edit") { edit = null; input.value = ""; }
    if (b.dataset.x === "reply") reply = null;
    if (b.dataset.x === "image") image = "";
    state();
  });
  input.addEventListener("input", sync);
  input.addEventListener("focus", () => { ep.hidden = true; });
  document.getElementById("ca").addEventListener("click", () => file.click());
  file.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    try { image = await resizeImage(f); edit = null; state(); } catch (x) { toast(x.message); }
  });
  // emoji panel
  const tabs = Object.keys(EMOJI); let tab = tabs[0];
  const split = (str) => (window.Intl && Intl.Segmenter) ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(str)].map((x) => x.segment) : Array.from(str);
  const drawEp = () => {
    ep.innerHTML = `<div class="etabs">${tabs.map((t) => `<button type="button" data-t="${t}" aria-pressed="${t === tab}">${t}</button>`).join("")}</div>
      <div class="egrid">${split(EMOJI[tab]).map((e) => `<button type="button" data-e="${e}">${e}</button>`).join("")}</div>`;
  };
  document.getElementById("ce").addEventListener("click", () => { ep.hidden = !ep.hidden; if (!ep.hidden) { drawEp(); input.blur(); } });
  ep.addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]"); if (t) { tab = t.dataset.t; drawEp(); return; }
    const m = e.target.closest("[data-e]"); if (!m) return;
    const st = input.selectionStart == null ? input.value.length : input.selectionStart, en = input.selectionEnd == null ? st : input.selectionEnd;
    input.setRangeText(m.dataset.e, st, en, "end"); sync();
  });
  cf.addEventListener("submit", async (e) => {
    e.preventDefault(); if (busy) return;
    const text = input.value.trim();
    if (!text && !image) return;
    busy = true; ep.hidden = true;
    const snap = { text, image, reply, edit };
    input.value = ""; image = ""; reply = null; edit = null; state();
    try {
      if (snap.edit) await h.edit(snap.edit, text);
      else await h.send({ text, image: snap.image, replyTo: snap.reply ? { name: snap.reply.name, text: snap.reply.text || "📷 Photo" } : null });
      setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    } catch (x) { toast(x.message); input.value = text; image = snap.image; reply = snap.reply; edit = snap.edit; state(); }
    busy = false;
  });
  return {
    reply(m) { reply = m; edit = null; state(); input.focus(); },
    edit(m) { edit = m; reply = null; image = ""; input.value = m.text; state(); input.focus(); },
  };
}

/* ---------- Chat ---------- */
function viewChat(sid, rid) {
  clearUnread(rid);
  let room = null, server = null, blocked = {}, list = [];
  mount(`<div class="screen chat">
    <div class="top"><a class="iconbtn" href="#/s/${sid}" aria-label="Back to rooms">${I.back}</a>
      <div class="tt"><b id="rt">#</b><span id="st"></span></div>
      <button class="iconbtn" id="mb" aria-label="Members">${I.people}</button></div>
    <div class="msgs" id="msgs" role="log" aria-label="Messages"></div>${composer("Message")}</div>`);
  const head = () => {
    document.getElementById("rt").textContent = "# " + (room ? room.name : "");
    document.getElementById("st").textContent = server ? server.name : "";
    document.getElementById("mi").placeholder = room ? "Message #" + room.name : "Message";
    try { draw(); } catch (e) {}
  };
  on(db.watchServer(sid, (s) => { server = s; head(); }));
  on(db.watchRooms(sid, (rs) => { room = rs.find((r) => r.id === rid) || null; head(); }));
  const box = document.getElementById("msgs");
  const draw = () => {
    const ms = list.filter((m) => !blocked[m.uid]);
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120 || !box.childElementCount;
    const intro = room ? `<div class="dmintro first"><span class="hashbig">#</span><h2>Welcome to #${esc(room.name)}!</h2><p>This is the start of the <b>#${esc(room.name)}</b> room.</p></div>` : "";
    box.innerHTML = intro + (ms.length ? msgsHtml(ms) : ""); box.__ms = ms;
    if (nearBottom) box.scrollTop = box.scrollHeight;
    loadProfiles(ms.map((m) => m.uid)).then((ch) => { if (ch) draw(); });
  };
  on(db.watchBlocked(user.uid, (b) => { blocked = b || {}; draw(); }));
  on(db.watchMessages(sid, rid, (ms) => { list = ms; draw(); }));
  const ctx = { kind: "room", sid, rid, isOwner: () => !!server && server.ownerId === user.uid };
  wireMsgs(box, ctx);
  document.getElementById("mb").addEventListener("click", () => { if (server) openMembers(server, ctx); });
  ctx.ctl = wireComposer({
    send: (x) => db.sendMessage(sid, rid, { uid: user.uid, name: user.name, ...x }),
    edit: (m, text) => db.editMsg(ctx, m.id, text)
  }, box);
}

/* ---------- Direct message chat ---------- */
function viewDM(id) {
  clearUnread("dm:" + id);
  let dm = null, blocked = {}, list = [];
  mount(`<div class="screen chat">
    <div class="top"><a class="iconbtn" href="#/dms" aria-label="Back">${I.back}</a>
      <span id="ha"></span><div class="tt" style="margin-left:6px"><b id="rt">Message</b></div></div>
    <div class="msgs" id="msgs" role="log" aria-label="Messages"></div>
    <div class="reqbar" id="rq" hidden></div>${composer("Message")}</div>`);
  const box = document.getElementById("msgs");
  const otherId = () => dm && dm.members.find((x) => x !== user.uid);
  const otherName = () => { const o = otherId(); return o && dm.names ? (dm.names[o] || "Someone") : "Someone"; };
  const head = () => {
    const o = otherId(), nm = otherName();
    document.getElementById("rt").textContent = o ? nm : "Message";
    document.getElementById("ha").innerHTML = o ? avatar(o, nm, 34, true) : "";
    if (o) loadProfiles([o]).then((ch) => { if (ch) head(); });
    document.getElementById("mi").placeholder = o ? "Message @" + nm : "Message";
    const rq = document.getElementById("rq"), cf = document.getElementById("cf");
    if (dm && dm.status === "pending") {
      const mine = dm.requestedBy === user.uid;
      rq.hidden = false; cf.hidden = true;
      rq.innerHTML = mine ? `<p>Request sent ✅<br>You can chat once ${esc(nm)} accepts.</p>` : `<p><b>${esc(nm)}</b> wants to message you.</p><div class="acts"><button class="btn" id="ra" type="button">Accept</button><button class="btn ghost" id="rd" type="button">Decline</button></div>`;
      const ra = document.getElementById("ra"), rd = document.getElementById("rd");
      if (ra) ra.addEventListener("click", async () => { try { await db.acceptDM(id); toast("Accepted ✅"); } catch (x) { toast(x.message); } });
      if (rd) rd.addEventListener("click", async () => { try { await db.declineDM(id); go("#/dms"); } catch (x) { toast(x.message); } });
    } else if (dm) { rq.hidden = true; cf.hidden = false; }
    else { rq.hidden = true; cf.hidden = true; }
    draw();
  };
  const draw = () => {
    const ms = list.filter((m) => !blocked[m.uid]);
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120 || !box.childElementCount;
    if (!ms.length) {
      const o = otherId();
      box.innerHTML = o ? `<div class="dmintro">${avatar(o, otherName(), 72)}<h2>${esc(otherName())}</h2><p>This is the start of your direct messages with <b>${esc(otherName())}</b>.</p></div>` : "";
      return;
    }
    box.innerHTML = msgsHtml(ms); box.__ms = ms;
    if (nearBottom) box.scrollTop = box.scrollHeight;
    loadProfiles(ms.map((m) => m.uid)).then((ch) => { if (ch) draw(); });
  };
  on(db.watchDM(id, (d) => { dm = d; head(); }));
  on(db.watchBlocked(user.uid, (b) => { blocked = b || {}; draw(); }));
  on(db.watchDMMessages(id, (ms) => { list = ms; draw(); }));
  const ctx = { kind: "dm", id, isOwner: () => false };
  wireMsgs(box, ctx);
  ctx.ctl = wireComposer({
    send: (x) => db.sendDM(id, { uid: user.uid, name: user.name, ...x }),
    edit: (m, text) => db.editMsg(ctx, m.id, text)
  }, box);
}

/* ---------- Sheets: message actions, profile card, members ---------- */
function sheet(inner, cls = "") {
  const bg = document.createElement("div");
  bg.className = "sheetbg";
  bg.innerHTML = `<div class="sheet ${cls}" role="dialog">${inner}</div>`;
  $app.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
  return { bg, close, q: (s) => bg.querySelector(s) };
}
async function startDM(p) {
  const id = await db.openDM(user.uid, user.name, p.uid, p.name);
  go("#/dm/" + id);
}
function openSheet(m, ctx) {
  const mine = m.uid === user.uid, canDel = mine || (ctx.isOwner && ctx.isOwner());
  const s = sheet(`<div class="quote"><b>${esc(m.name)}</b><br>${m.text ? esc(m.text) : "📷 Photo"}</div>
    <button id="rpy">Reply</button>
    ${m.text ? '<button id="cp">Copy text</button>' : ""}
    ${mine && m.text ? '<button id="ed">Edit message</button>' : ""}
    ${!mine && ctx.kind === "room" ? `<button id="dmb">Message ${esc(m.name)}</button>` : ""}
    ${!mine ? `<button id="rp">Report message</button><button id="bl" class="danger">Block ${esc(m.name)}</button>` : ""}
    ${canDel ? '<button id="dl2" class="danger">Delete message</button>' : ""}
    <button id="cx" class="plain">Cancel</button>`);
  s.q("#cx").addEventListener("click", s.close);
  s.q("#rpy").addEventListener("click", () => { s.close(); if (ctx.ctl) ctx.ctl.reply({ name: m.name, text: m.text }); });
  const cp = s.q("#cp"); if (cp) cp.addEventListener("click", async () => { try { await navigator.clipboard.writeText(m.text); toast("Copied ✅"); } catch (e) { toast("Couldn't copy"); } s.close(); });
  const ed = s.q("#ed"); if (ed) ed.addEventListener("click", () => { s.close(); if (ctx.ctl) ctx.ctl.edit({ id: m.id, text: m.text }); });
  const d2 = s.q("#dl2"); if (d2) d2.addEventListener("click", async () => {
    s.close();
    if (!confirm("Delete this message for everyone?")) return;
    try { await db.deleteMsg(ctx, m.id); toast("Deleted"); } catch (x) { toast(x.message); }
  });
  const dmb = s.q("#dmb");
  if (dmb) dmb.addEventListener("click", async () => { s.close(); try { await startDM({ uid: m.uid, name: m.name }); } catch (x) { toast(x.message); } });
  const rp = s.q("#rp");
  if (rp) rp.addEventListener("click", async () => {
    try { await db.reportMessage({ reporterId: user.uid, messageUid: m.uid, messageName: m.name, text: m.text || "[photo]", messageId: m.id || "", serverId: ctx.sid || "dm", roomId: ctx.rid || ctx.id || "" }); toast("Thanks, we'll look at it ✅"); }
    catch (x) { toast(x.message); }
    s.close();
  });
  const bl = s.q("#bl");
  if (bl) bl.addEventListener("click", async () => {
    try { await db.blockUser(user.uid, m.uid, m.name); toast(m.name + " is blocked. Their messages are hidden."); } catch (x) { toast(x.message); }
    s.close();
  });
}
async function openProfile(p, ctx) {
  await loadProfiles([p.uid]);
  const me = p.uid === user.uid, isBlocked = !!ntfBlocked[p.uid], pr = PROF[p.uid] || {};
  const name = pr.name || p.name;
  const s = sheet(`<div class="pbanner" style="background:${colOf(p.uid)}"></div>
    <div class="pav">${avatar(p.uid, name, 80, true)}</div>
    <h3 class="pname">${esc(name)}</h3>
    <p class="pstat">${esc(stLabel(p.uid, me))}</p>
    ${pr.bio ? `<div class="pbio"><span class="cap">ABOUT ME</span><p>${esc(pr.bio)}</p></div>` : ""}
    ${me ? '<div class="pbtns"><a class="btn" href="#/profile" id="pe">Edit profile</a></div>' : `<div class="pbtns">${ctx && ctx.kind === "dm" ? "" : '<button class="btn" id="pm" type="button">Message</button>'}
      <button class="btn ghost" id="pb" type="button">${isBlocked ? "Unblock" : "Block"}</button></div>`}
    <button id="cx" class="plain">Close</button>`, "prof");
  s.q("#cx").addEventListener("click", s.close);
  const pe = s.q("#pe"); if (pe) pe.addEventListener("click", s.close);
  const pm = s.q("#pm");
  if (pm) pm.addEventListener("click", async () => { s.close(); try { await startDM({ uid: p.uid, name }); } catch (x) { toast(x.message); } });
  const pb = s.q("#pb");
  if (pb) pb.addEventListener("click", async () => {
    try { if (isBlocked) { await db.unblockUser(user.uid, p.uid); toast("Unblocked ✅"); } else { await db.blockUser(user.uid, p.uid, name); toast(name + " is blocked."); } } catch (x) { toast(x.message); }
    s.close();
  });
}
async function openMembers(server, ctx) {
  const bg = document.createElement("div");
  bg.className = "sheetbg right";
  bg.innerHTML = `<aside class="drawer" aria-label="Members"><div class="dh"><b>Members</b><span>${server.members.length}</span></div><div class="dl" id="dl"><div class="hint">Loading…</div></div></aside>`;
  $app.appendChild(bg);
  bg.addEventListener("click", (e) => { if (e.target === bg) bg.remove(); });
  await namesFor(server.members);
  const ids = server.members.slice().sort((a, b) => (a === server.ownerId ? -1 : b === server.ownerId ? 1 : String(nameCache[a]).localeCompare(String(nameCache[b]))));
  const dl = bg.querySelector("#dl"); if (!dl) return;
  dl.innerHTML = `<div class="sec"><span>MEMBERS — ${ids.length}</span></div>` + ids.map((u) => `<button class="mrow" data-u="${esc(u)}">${avatar(u, nameCache[u], 40, true)}<span class="mn">${esc(nameCache[u] || "Someone")}</span>${u === server.ownerId ? '<em class="own">Owner</em>' : ""}</button>`).join("");
  dl.querySelectorAll(".mrow").forEach((b) => b.addEventListener("click", () => { bg.remove(); openProfile({ uid: b.dataset.u, name: nameCache[b.dataset.u] || "Someone" }, ctx); }));
}

/* ---------- Create a server ---------- */
function viewCreate() {
  mount(`<div class="screen">${top(safe("kamiai-last") ? "#/s/" + safe("kamiai-last") : "#/", "")}
    <div class="scroll"><div class="pad"><h1>Create your server</h1><p class="sub" style="margin:6px 0 0">A place for you and your friends to chat about anime.</p></div>
    <div class="stack" style="padding-top:28px"><div class="avpick" id="pv" aria-hidden="true">+</div>
      <form class="form" id="f"><div><label class="label" for="sn">Server name</label>
        <input class="field" id="sn" placeholder="${esc(user.name)}'s server" maxlength="30" autocomplete="off"></div>
        <p class="sub" style="font-size:13px;margin:0">You'll start with a "general" room. You can add more later.</p>
        <p class="err" id="err" role="alert"></p>
        <button class="btn" id="go" type="submit">Create server</button></form></div></div></div>`);
  const sn = document.getElementById("sn"), pv = document.getElementById("pv");
  sn.addEventListener("input", () => { pv.textContent = sn.value.trim() ? initials(sn.value) : "+"; });
  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = sn.value.trim() || user.name + "'s server";
    const b = document.getElementById("go"); b.disabled = true;
    try { const id = await db.createServer(user.uid, name); go("#/invite/" + id); }
    catch (x) { document.getElementById("err").textContent = x.message; b.disabled = false; }
  });
  setTimeout(() => sn.focus(), 50);
}

/* ---------- Invite friends ---------- */
function viewInvite(sid) {
  mount(`<div class="screen">${top("#/s/" + sid, "")}<div class="scroll" id="inv"></div></div>`);
  on(db.watchServer(sid, (s) => {
    const el = document.getElementById("inv"); if (!el) return;
    if (!s) { el.innerHTML = '<div class="none">Loading…</div>'; return; }
    const link = location.href.split("#")[0] + "#/join/" + s.inviteCode;
    const text = `Join my server "${s.name}" on Kamiai: ${link}`;
    el.innerHTML = `<div class="hero"><div class="av" style="background:var(--accent)">${esc(initials(s.name))}</div>
      <div><div style="font-size:24px;font-weight:800">Invite your friends</div><div class="muted" style="font-size:14px;font-weight:500">to ${esc(s.name)}</div></div></div>
      <div class="card" style="margin-top:22px"><span class="cap">INVITE LINK</span>
        <div class="linkrow"><div class="linkbox" id="lb">${esc(link)}</div><button class="btn small" id="cp">Copy</button></div>
        <span class="sub" style="font-size:13px">Anyone with this link can join your server.</span></div>
      <div class="shares">
        <a href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener"><span>${I.wa}</span>WhatsApp</a>
        <a href="sms:?&body=${encodeURIComponent(text)}"><span>${I.sms}</span>Messages</a>
        <a href="mailto:?subject=${encodeURIComponent("Join me on Kamiai")}&body=${encodeURIComponent(text)}"><span>${I.mail}</span>Email</a>
        <button id="sh"><span>${I.more}</span>More</button></div>
      <div class="stack"><a class="btn" href="#/s/${s.id}">Done</a></div>`;
    document.getElementById("cp").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); toast("Link copied ✅"); }
      catch (e) { const r = document.createRange(); r.selectNodeContents(document.getElementById("lb")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Press and hold the link to copy it"); }
    });
    document.getElementById("sh").addEventListener("click", async () => {
      if (navigator.share) { try { await navigator.share({ title: "Kamiai", text, url: link }); } catch (e) {} }
      else toast("Use Copy and paste the link to your friends");
    });
  }));
}

/* ---------- Profile ---------- */
function viewProfile() {
  const pr = PROF[user.uid] || {};
  let photo = pr.photo || "", color = pr.color || "", status = pr.status || "online", photoChanged = false;
  const back = safe("kamiai-last") ? "#/s/" + safe("kamiai-last") : "#/";
  mount(`<div class="screen scroll"><div class="profbanner" id="pbn"><a class="iconbtn" href="${back}" aria-label="Back" style="position:absolute;left:8px;top:12px;background:rgba(14,14,16,.55)">${I.back.replace("<svg", '<svg style="stroke:#fff"')}</a></div>
    <div class="profrow"><div class="profav2" id="pav"></div>
      <div class="photobtns"><label class="pill" for="pf">Change picture</label><button class="pill ghost" id="prm" type="button">Remove</button></div>
      <input type="file" id="pf" accept="image/*" hidden></div>
    <div class="stack"><div><div style="font-size:26px;font-weight:800" id="pn">${esc(user.name)}</div><div class="muted" style="font-size:14px;font-weight:600;margin-top:2px">${esc(user.email || "")}</div></div>
      <form class="form" id="f">
        <div><label class="label" for="nm">Display name</label><input class="field" id="nm" value="${esc(user.name)}" maxlength="30"></div>
        <div><label class="label" for="bio">About me</label><textarea class="field area" id="bio" maxlength="150" rows="3" placeholder="Tell people about yourself (favorite anime?)">${esc(pr.bio || "")}</textarea><div class="cnt2"><span id="bc">0</span>/150</div></div>
        <div><span class="label">Status</span><div class="stseg" id="sts">${Object.keys(STATUS).map((k) => `<button type="button" data-s="${k}" aria-pressed="${k === status}"><i style="background:${STATUS[k][1]}"></i>${STATUS[k][0]}</button>`).join("")}</div></div>
        <div><span class="label">Profile color</span><div class="swatches" id="sw">${SWATCHES.map((c) => `<button type="button" data-c="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c === color}"></button>`).join("")}</div></div>
        <p class="err" id="err" role="alert"></p><button class="btn" id="sv" type="submit">Save changes</button></form>
      <button class="btn ghost" id="snd" type="button">Message sounds: ON 🔔</button>
      <div><span class="cap">BLOCKED PEOPLE</span><div id="bl" style="display:flex;flex-direction:column;gap:8px;margin-top:10px"></div></div>
      <button class="btn ghost" id="lo" type="button">Log out</button>
      <p class="fine" style="margin:0">Kamiai · ${db.mode === "online" ? "Online" : "Demo mode (this phone only)"}</p></div></div>`);
  const $ = (id) => document.getElementById(id);
  const paint = () => {
    $("pbn").style.background = color || colorOf(user.uid);
    const ph = photo;
    $("pav").innerHTML = `<span class="av c has bigav" style="width:92px;height:92px;font-size:34px;background:${ph ? `#2b2d31 url('${ph}') center/cover` : (color || colorOf(user.uid))}">${ph ? "" : esc(initials($("nm").value || user.name))}<i class="sdot" style="background:${STATUS[status][1]};width:24px;height:24px"></i></span>`;
    $("prm").style.display = photo ? "" : "none";
    $("sts").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === status)));
    $("sw").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.c === color)));
  };
  const bio = $("bio"), bc = $("bc"); bc.textContent = bio.value.length; bio.addEventListener("input", () => { bc.textContent = bio.value.length; });
  $("nm").addEventListener("input", paint);
  $("sts").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { status = b.dataset.s; paint(); } });
  $("sw").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { color = color === b.dataset.c ? "" : b.dataset.c; paint(); } });
  $("prm").addEventListener("click", () => { photo = ""; photoChanged = true; paint(); });
  $("pf").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { photo = await resizePhoto(f); photoChanged = true; paint(); } catch (x) { toast(x.message); }
    e.target.value = "";
  });
  paint();
  $("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = $("nm").value.trim(); if (!n) { $("err").textContent = "Please enter a name."; return; }
    $("sv").disabled = true;
    try {
      if (n !== user.name) { await db.updateName(user.uid, n); user.name = n; nameCache[user.uid] = n; }
      const f2 = { bio: bio.value.trim(), status, color, photo };
      await db.saveProfile(user.uid, f2);
      PROF[user.uid] = Object.assign({}, PROF[user.uid], { name: n }, f2);
      toast("Profile saved ✅"); $("err").textContent = ""; $("pn").textContent = n;
    } catch (x) { $("err").textContent = x.message; }
    $("sv").disabled = false;
  });
  $("lo").addEventListener("click", async () => { await db.logOut(); });
  const snd = $("snd");
  const sndDraw = () => { snd.textContent = ntfOn ? "Message sounds: ON 🔔" : "Message sounds: OFF 🔕"; };
  sndDraw();
  snd.addEventListener("click", () => { ntfOn = !ntfOn; safe("kamiai-sound", ntfOn ? "on" : "off"); sndDraw(); if (ntfOn) ding(); });
  on(db.watchBlocked(user.uid, (b) => {
    const el = $("bl"); if (!el) return;
    const ids = Object.keys(b || {});
    el.innerHTML = ids.length ? ids.map((id) => `<div class="brow"><b>${esc(b[id])}</b><button data-u="${esc(id)}">Unblock</button></div>`).join("") : '<span class="muted" style="font-size:14px">Nobody. Tap a person in a chat to block them.</span>';
    el.querySelectorAll("button").forEach((x) => x.addEventListener("click", async () => { try { await db.unblockUser(user.uid, x.dataset.u); toast("Unblocked ✅"); } catch (e) { toast(e.message); } }));
  }));
}

/* ---------- Notifications (while the app is open) ---------- */
let ntfStop = null, ntfOwner = null, unread = {}, onUnread = null, ntfBlocked = {}, ntfOn = safe("kamiai-sound") !== "off";
let audioCtx = null;
function ding() {
  if (!ntfOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    [880, 1318].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.3);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.32);
    });
  } catch (e) {}
  try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {}
}
function totalUnread() { return Object.values(unread).reduce((a, b) => a + b, 0); }
function setBadge() {
  const n = totalUnread();
  document.title = n ? `(${n}) Kamiai` : "Kamiai";
  try { if (n && navigator.setAppBadge) navigator.setAppBadge(n); else if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (e) {}
  if (onUnread) onUnread();
}
function clearUnread(rid) { if (unread[rid]) { delete unread[rid]; setBadge(); } }
function viewing(sid, rid) { return document.visibilityState === "visible" && location.hash === `#/chat/${sid}/${rid}`; }
function startNotify() {
  if (ntfOwner === user.uid) return;
  stopNotify();
  ntfOwner = user.uid;
  const stops = [], rooms = new Set(), servers = new Set();
  stops.push(db.watchBlocked(user.uid, (b) => { ntfBlocked = b || {}; }));
  stops.push(db.watchMyServers(user.uid, (list) => {
    list.forEach((sv) => {
      if (servers.has(sv.id)) return; servers.add(sv.id);
      stops.push(db.watchRooms(sv.id, (rs) => {
        rs.forEach((r) => {
          if (rooms.has(r.id)) return; rooms.add(r.id);
          let seen = null;
          stops.push(db.watchMessages(sv.id, r.id, (ms) => {
            if (!seen) { seen = new Set(ms.map((m) => m.id)); return; }
            const fresh = ms.filter((m) => !seen.has(m.id));
            fresh.forEach((m) => seen.add(m.id));
            fresh.filter((m) => m.uid !== user.uid && !ntfBlocked[m.uid]).forEach((m) => {
              if (viewing(sv.id, r.id)) return;
              unread[r.id] = (unread[r.id] || 0) + 1;
              setBadge(); ding();
              toast(`${m.name} in #${r.name}: ${String(m.text || "📷 Photo").slice(0, 60)}`);
            });
          }));
        });
      }));
    });
  }));
  const dmSeen = new Set(); let dmFirst = true;
  stops.push(db.watchDMs(user.uid, (list) => {
    list.forEach((d) => {
      if (dmSeen.has(d.id)) return; dmSeen.add(d.id);
      if (!dmFirst && d.status === "pending" && d.requestedBy !== user.uid) { ding(); toast(`${(d.names || {})[d.requestedBy] || "Someone"} wants to message you`); }
      let seen = null;
      stops.push(db.watchDMMessages(d.id, (ms) => {
        if (!seen) { seen = new Set(ms.map((m) => m.id)); return; }
        const fresh = ms.filter((m) => !seen.has(m.id));
        fresh.forEach((m) => seen.add(m.id));
        fresh.filter((m) => m.uid !== user.uid && !ntfBlocked[m.uid]).forEach((m) => {
          if (document.visibilityState === "visible" && location.hash === "#/dm/" + d.id) return;
          unread["dm:" + d.id] = (unread["dm:" + d.id] || 0) + 1;
          setBadge(); ding();
          toast(`${m.name}: ${String(m.text || "📷 Photo").slice(0, 60)}`);
        });
      }));
    });
    dmFirst = false;
  }));
  ntfStop = () => stops.forEach((x) => { try { x && x(); } catch (e) {} });
}
function stopNotify() { if (ntfStop) ntfStop(); ntfStop = null; ntfOwner = null; unread = {}; setBadge(); }
document.addEventListener("visibilitychange", () => { const m = location.hash.match(/^#\/chat\/[^/]+\/([^/]+)/); if (document.visibilityState === "visible" && m) clearUnread(m[1]); });

/* ---------- Router ---------- */
async function route() {
  clean();
  if (user === undefined) { mount(""); return; }
  const h = location.hash.replace(/^#/, "") || "/";
  const p = h.split("/").filter(Boolean);
  if (p[0] === "join" && p[1]) safe("kamiai-pending", p[1]);
  if (!user) { stopNotify(); viewLogin(); return; }
  await loadProfiles([user.uid]);
  startNotify();
  const pending = safe("kamiai-pending");
  if (pending) {
    safe("kamiai-pending", "");
    try { const id = await db.joinByCode(user.uid, pending); toast("You joined the server 🎉"); go("#/s/" + id); }
    catch (x) { toast(x.message); go("#/"); }
    return;
  }
  if (p[0] === "chat" && p[2]) return viewChat(p[1], p[2]);
  if (p[0] === "dms") return viewDMs();
  if (p[0] === "dm" && p[1]) return viewDM(p[1]);
  if (p[0] === "create") return viewCreate();
  if (p[0] === "invite" && p[1]) return viewInvite(p[1]);
  if (p[0] === "profile") return viewProfile();
  return viewHome(p[0] === "s" ? p[1] : null);
}
window.addEventListener("hashchange", route);
db.onUser((u) => {
  const was = user;
  user = u;
  if (was === undefined || (!!was !== !!u) || (u && was && u.uid !== was.uid)) route();
});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

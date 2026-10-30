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

/* ---------- Home: servers, rooms ---------- */
function viewHome(sid) {
  let servers = null, rooms = [], adding = false;
  const draw = () => {
    if (servers === null) return;
    if (!servers.length) {
      mount(`<div class="screen"><div class="empty"><div class="logo">${I.star}</div><h2>Welcome, ${esc(user.name)}!</h2>
        <p class="sub">Servers are places for you and your friends. Make one, or open an invite link a friend sent you.</p>
        <a class="btn" href="#/create" style="max-width:260px">Create a server</a>
        <a class="link" href="#/profile">Your profile</a></div></div>`);
      return;
    }
    const cur = servers.find((s) => s.id === sid);
    if (!cur) { go("#/s/" + (safe("kamiai-last") && servers.find((s) => s.id === safe("kamiai-last")) ? safe("kamiai-last") : servers[0].id)); return; }
    safe("kamiai-last", cur.id);
    const owner = cur.ownerId === user.uid;
    mount(`<div class="screen home">
      <nav class="rail" aria-label="Your servers">
        ${servers.map((s) => `<a class="sv ${s.id === cur.id ? "on" : ""}" href="#/s/${s.id}" aria-label="${esc(s.name)}" ${s.id === cur.id ? 'aria-current="true"' : ""}>${esc(initials(s.name))}</a>`).join("")}
        <div class="sep"></div>
        <a class="sv add" href="#/create" aria-label="Create a server">${I.plus}</a>
      </nav>
      <section class="panel">
        <div class="phead"><div class="nm">${esc(cur.name)}<span class="cnt">${cur.members.length} member${cur.members.length === 1 ? "" : "s"}</span></div>
          <a class="iconbtn bg" href="#/invite/${cur.id}" aria-label="Invite friends">${I.invite}</a></div>
        <div class="rooms">
          <div class="sec"><span>ROOMS</span>${owner ? `<button class="iconbtn" id="addroom" aria-label="Add a room" style="width:32px;height:32px">${I.plus}</button>` : ""}</div>
          ${adding ? `<form id="rf" style="display:flex;gap:8px;padding:0 4px 8px"><label for="rn" style="position:absolute;left:-9999px">Room name</label><input class="field" id="rn" placeholder="new-room" maxlength="24" style="height:44px;font-size:15px"><button class="btn small" type="submit">Add</button></form>` : ""}
          ${rooms.map((r) => `<a class="room" href="#/chat/${cur.id}/${r.id}">${I.hash}<span>${esc(r.name)}</span></a>`).join("")}
        </div>
        <div class="userbar"><div class="av" style="background:${colorOf(user.uid)}">${esc(initials(user.name))}</div>
          <div class="who"><b>${esc(user.name)}</b><span>Online</span></div>
          <a class="iconbtn" href="#/profile" aria-label="Settings">${I.gear}</a></div>
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
  on(db.watchMyServers(user.uid, (s) => { servers = s; draw(); }));
  // rooms for the selected server; re-subscribe when we know which one
  if (sid) on(db.watchRooms(sid, (r) => { rooms = r; draw(); }));
}

/* ---------- Chat ---------- */
function viewChat(sid, rid) {
  let room = null, server = null;
  mount(`<div class="screen chat">
    <div class="top"><a class="iconbtn" href="#/s/${sid}" aria-label="Back to rooms">${I.back}</a>
      <div class="tt"><b id="rt">#</b><span id="st"></span></div></div>
    <div class="msgs" id="msgs" role="log" aria-label="Messages"></div>
    <form class="composer" id="cf" autocomplete="off">
      <label for="mi" style="position:absolute;left:-9999px">Message</label>
      <input id="mi" placeholder="Message" maxlength="2000" enterkeyhint="send">
      <button class="send" aria-label="Send" type="submit">${I.send}</button>
    </form></div>`);
  const head = () => { document.getElementById("rt").textContent = "# " + (room ? room.name : ""); document.getElementById("st").textContent = server ? server.name : ""; };
  on(db.watchServer(sid, (s) => { server = s; if (s === null && db.mode === "online") { /* not a member */ } head(); }));
  on(db.watchRooms(sid, (rs) => { room = rs.find((r) => r.id === rid) || null; head(); }));
  const box = document.getElementById("msgs");
  const fmtT = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  on(db.watchMessages(sid, rid, (ms) => {
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120 || !box.childElementCount;
    if (!ms.length) { box.innerHTML = '<div class="none">No messages yet.<br>Say hi and start the chat! 👋</div>'; return; }
    let html = "", lastDay = "", prev = null;
    for (const m of ms) {
      const d = new Date(m.createdAt), day = d.toDateString();
      if (day !== lastDay) { html += `<div class="day"><i></i><span>${esc(d.toDateString() === new Date().toDateString() ? "Today" : d.toLocaleDateString([], { month: "short", day: "numeric" }))}</span><i></i></div>`; lastDay = day; prev = null; }
      const cont = prev && prev.uid === m.uid && m.createdAt - prev.createdAt < 5 * 60000;
      html += `<div class="msg ${cont ? "cont" : ""}">${cont ? '<div class="sp"></div>' : `<div class="av" style="background:${colorOf(m.uid)}">${esc(initials(m.name))}</div>`}
        <div class="body">${cont ? "" : `<div class="meta"><b style="color:${m.uid === user.uid ? "var(--accent2)" : "#fff"}">${esc(m.name)}</b><time>${fmtT(m.createdAt)}</time></div>`}<p>${esc(m.text)}</p></div></div>`;
      prev = m;
    }
    box.innerHTML = html;
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }));
  const input = document.getElementById("mi");
  document.getElementById("cf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    input.value = ""; input.focus();
    try { await db.sendMessage(sid, rid, { uid: user.uid, name: user.name, text }); setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50); }
    catch (x) { toast(x.message); input.value = text; }
  });
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
  mount(`<div class="screen scroll"><div class="profbanner"><a class="iconbtn" href="${safe("kamiai-last") ? "#/s/" + safe("kamiai-last") : "#/"}" aria-label="Back" style="position:absolute;left:8px;top:12px;background:rgba(14,14,16,.55)">${I.back.replace("<svg", '<svg style="stroke:#fff"')}</a></div>
    <div class="profav" style="background:${colorOf(user.uid)}">${esc(initials(user.name))}</div>
    <div class="stack"><div><div style="font-size:26px;font-weight:800">${esc(user.name)}</div><div class="muted" style="font-size:14px;font-weight:600;margin-top:2px">${esc(user.email || "")}</div></div>
      <form class="form" id="f"><div><label class="label" for="nm">Display name</label><input class="field" id="nm" value="${esc(user.name)}" maxlength="30"></div>
        <p class="err" id="err" role="alert"></p><button class="btn" type="submit">Save name</button></form>
      <button class="btn ghost" id="lo" type="button">Log out</button>
      <p class="fine" style="margin:0">Kamiai · ${db.mode === "online" ? "Online" : "Demo mode (this phone only)"}</p></div></div>`);
  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = document.getElementById("nm").value.trim(); if (!n) return;
    try { await db.updateName(user.uid, n); user.name = n; toast("Name saved ✅"); viewProfile(); } catch (x) { document.getElementById("err").textContent = x.message; }
  });
  document.getElementById("lo").addEventListener("click", async () => { await db.logOut(); });
}

/* ---------- Router ---------- */
async function route() {
  clean();
  if (user === undefined) { mount(""); return; }
  const h = location.hash.replace(/^#/, "") || "/";
  const p = h.split("/").filter(Boolean);
  if (p[0] === "join" && p[1]) safe("kamiai-pending", p[1]);
  if (!user) { viewLogin(); return; }
  const pending = safe("kamiai-pending");
  if (pending) {
    safe("kamiai-pending", "");
    try { const id = await db.joinByCode(user.uid, pending); toast("You joined the server 🎉"); go("#/s/" + id); }
    catch (x) { toast(x.message); go("#/"); }
    return;
  }
  if (p[0] === "chat" && p[2]) return viewChat(p[1], p[2]);
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

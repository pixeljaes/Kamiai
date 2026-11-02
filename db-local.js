// Demo mode: everything is saved on this phone only (no internet needed).
const KEY = "kamiai-demo-v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const base = () => Object.assign({ accounts: [], servers: [], rooms: [], messages: [], session: null, blocks: {}, reports: [], dms: [], dmMessages: [] }, load());
let state = base();
const listeners = new Set();
const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); fire(); };
const fire = () => listeners.forEach((f) => f());
window.addEventListener("storage", (e) => { if (e.key === KEY) { state = base(); fire(); } });
const uid = () => Math.random().toString(36).slice(2, 10);
const sub = (fn) => { listeners.add(fn); fn(); return () => listeners.delete(fn); };
const code = () => Math.random().toString(36).slice(2, 10);

const extra = (m) => { const o = { uid: m.uid, name: m.name, text: m.text || "" }; if (m.image) o.image = m.image; if (m.replyTo) o.replyTo = m.replyTo; return o; };

export const db = {
  mode: "demo",
  onUser(cb) {
    return sub(() => {
      const a = state.accounts.find((x) => x.uid === state.session);
      cb(a ? { uid: a.uid, name: a.name, email: a.email } : null);
    });
  },
  async signUp(email, pass, name) {
    email = email.trim().toLowerCase();
    if (state.accounts.some((a) => a.email === email)) throw new Error("That email already has an account. Try logging in.");
    const a = { uid: uid(), email, pass, name: name.trim() || email.split("@")[0] };
    state.accounts.push(a); state.session = a.uid; save();
  },
  async logIn(email, pass) {
    email = email.trim().toLowerCase();
    const a = state.accounts.find((x) => x.email === email && x.pass === pass);
    if (!a) throw new Error("Wrong email or password.");
    state.session = a.uid; save();
  },
  async google() { throw new Error("Google sign-in needs the real online setup. Use email for now."); },
  async logOut() { state.session = null; save(); },
  async updateName(u, name) {
    const a = state.accounts.find((x) => x.uid === u); if (a) a.name = name; save();
  },
  watchMyServers(u, cb) { return sub(() => cb(state.servers.filter((s) => s.members.includes(u)).sort((a, b) => a.createdAt - b.createdAt))); },
  watchServer(id, cb) { return sub(() => cb(state.servers.find((s) => s.id === id) || null)); },
  async createServer(u, name) {
    const s = { id: uid(), name, ownerId: u, members: [u], inviteCode: code(), createdAt: Date.now() };
    state.servers.push(s);
    state.rooms.push({ id: uid(), serverId: s.id, name: "general", createdAt: Date.now() });
    save(); return s.id;
  },
  async joinByCode(u, c) {
    const s = state.servers.find((x) => x.inviteCode === c.trim());
    if (!s) throw new Error("That invite link doesn't work any more.");
    if (!s.members.includes(u)) s.members.push(u);
    save(); return s.id;
  },
  watchRooms(sid, cb) { return sub(() => cb(state.rooms.filter((r) => r.serverId === sid).sort((a, b) => a.createdAt - b.createdAt))); },
  async createRoom(sid, name) { state.rooms.push({ id: uid(), serverId: sid, name, createdAt: Date.now() }); save(); },
  watchMessages(sid, rid, cb) { return sub(() => cb(state.messages.filter((m) => m.roomId === rid).sort((a, b) => a.createdAt - b.createdAt).slice(-100))); },
  dmId: (a, b) => [a, b].sort().join("_"),
  async openDM(u, uName, other, otherName) {
    const id = [u, other].sort().join("_");
    if (!state.dms.find((d) => d.id === id)) { state.dms.push({ id, members: [u, other].sort(), names: { [u]: uName, [other]: otherName }, status: "pending", requestedBy: u, updatedAt: Date.now() }); save(); }
    return id;
  },
  async acceptDM(id) { const d = state.dms.find((x) => x.id === id); if (d) { d.status = "accepted"; d.updatedAt = Date.now(); save(); } },
  async declineDM(id) { state.dms = state.dms.filter((x) => x.id !== id); state.dmMessages = state.dmMessages.filter((m) => m.dmId !== id); save(); },
  watchDM(id, cb) { return sub(() => cb(state.dms.find((d) => d.id === id) || null)); },
  watchDMs(u, cb) { return sub(() => cb(state.dms.filter((d) => d.members.includes(u)).sort((a, b) => b.updatedAt - a.updatedAt))); },
  watchDMMessages(id, cb) { return sub(() => cb(state.dmMessages.filter((m) => m.dmId === id).sort((a, b) => a.createdAt - b.createdAt).slice(-100))); },
  async sendDM(id, m) {
    const dd = state.dms.find((x) => x.id === id); if (!dd || dd.status !== "accepted") throw new Error("They haven't accepted yet.");
    state.dmMessages.push(Object.assign({ id: uid(), dmId: id, createdAt: Date.now() }, extra(m)));
    const d = state.dms.find((x) => x.id === id); if (d) { d.updatedAt = Date.now(); d.last = (m.text || "📷 Photo").slice(0, 80); }
    save();
  },
  async getProfiles(uids) {
    const o = {};
    uids.forEach((id) => { const a = state.accounts.find((x) => x.uid === id) || {}; o[id] = { name: a.name || "Someone", photo: a.photo || "", color: a.color || "", bio: a.bio || "", status: a.status || "online" }; });
    return o;
  },
  async saveProfile(u, f) { const a = state.accounts.find((x) => x.uid === u); if (a) Object.assign(a, f); save(); },
  async getNames(uids) { const o = {}; uids.forEach((id) => { const a = state.accounts.find((x) => x.uid === id); o[id] = a ? a.name : "Someone"; }); return o; },
  watchBlocked(u, cb) { return sub(() => cb(state.blocks[u] || {})); },
  async blockUser(u, other, name) { state.blocks[u] = Object.assign({}, state.blocks[u], { [other]: name || "Someone" }); save(); },
  async unblockUser(u, other) { const b = Object.assign({}, state.blocks[u]); delete b[other]; state.blocks[u] = b; save(); },
  async reportMessage(r) { state.reports.push(Object.assign({}, r, { createdAt: Date.now() })); save(); },
  async sendMessage(sid, rid, m) { state.messages.push(Object.assign({ id: uid(), roomId: rid, serverId: sid, createdAt: Date.now() }, extra(m))); save(); },
  async editMsg(c, id, text) { const m = (c.kind === "dm" ? state.dmMessages : state.messages).find((x) => x.id === id); if (m) { m.text = text; m.edited = true; save(); } },
  async deleteMsg(c, id) { const k = c.kind === "dm" ? "dmMessages" : "messages"; state[k] = state[k].filter((x) => x.id !== id); save(); }
};

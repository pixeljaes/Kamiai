// Demo mode: everything is saved on this phone only (no internet needed).
const KEY = "kamiai-demo-v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const base = () => Object.assign({ accounts: [], servers: [], rooms: [], messages: [], session: null }, load());
let state = base();
const listeners = new Set();
const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); fire(); };
const fire = () => listeners.forEach((f) => f());
window.addEventListener("storage", (e) => { if (e.key === KEY) { state = base(); fire(); } });
const uid = () => Math.random().toString(36).slice(2, 10);
const sub = (fn) => { listeners.add(fn); fn(); return () => listeners.delete(fn); };
const code = () => Math.random().toString(36).slice(2, 10);

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
  async sendMessage(sid, rid, m) { state.messages.push({ id: uid(), roomId: rid, serverId: sid, uid: m.uid, name: m.name, text: m.text, createdAt: Date.now() }); save(); }
};

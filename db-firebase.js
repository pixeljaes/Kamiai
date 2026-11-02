import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, updateDoc, onSnapshot, query, where,
  orderBy, limit, arrayUnion, serverTimestamp, writeBatch, deleteField, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);
const ms = (t) => (t && t.toMillis ? t.toMillis() : Date.now());
const code = () => Math.random().toString(36).slice(2, 10);
const friendly = (e) => {
  const c = e && e.code || "";
  if (c.includes("email-already-in-use")) return new Error("That email already has an account. Try logging in.");
  if (c.includes("weak-password")) return new Error("Password is too short. Use at least 6 characters.");
  if (c.includes("invalid-email")) return new Error("That email doesn't look right.");
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return new Error("Wrong email or password.");
  if (c.includes("popup-closed")) return new Error("Google sign-in was closed.");
  if (c.includes("permission-denied")) return new Error("You don't have permission to do that.");
  return e instanceof Error ? e : new Error("Something went wrong. Try again.");
};
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

export const db = {
  mode: "online",
  onUser(cb) {
    return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, name: u.displayName || (u.email || "").split("@")[0], email: u.email } : null));
  },
  signUp: wrap(async (email, pass, name) => {
    const c = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await updateProfile(c.user, { displayName: name.trim() || email.split("@")[0] });
    await setDoc(doc(fs, "users", c.user.uid), { name: c.user.displayName, createdAt: serverTimestamp() });
  }),
  logIn: wrap((email, pass) => signInWithEmailAndPassword(auth, email.trim(), pass)),
  google: wrap(async () => {
    const c = await signInWithPopup(auth, new GoogleAuthProvider());
    await setDoc(doc(fs, "users", c.user.uid), { name: c.user.displayName || "", createdAt: serverTimestamp() }, { merge: true });
  }),
  logOut: () => signOut(auth),
  updateName: wrap(async (u, name) => {
    await updateProfile(auth.currentUser, { displayName: name });
    await setDoc(doc(fs, "users", u), { name }, { merge: true });
  }),
  watchMyServers(u, cb) {
    return onSnapshot(query(collection(fs, "servers"), where("members", "array-contains", u)), (s) => {
      cb(s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt) })).sort((a, b) => a.createdAt - b.createdAt));
    });
  },
  watchServer(id, cb) {
    return onSnapshot(doc(fs, "servers", id), (d) => cb(d.exists() ? { id: d.id, ...d.data() } : null), () => cb(null));
  },
  createServer: wrap(async (u, name) => {
    const sref = doc(collection(fs, "servers")), c = code(), b = writeBatch(fs);
    b.set(sref, { name, ownerId: u, members: [u], inviteCode: c, createdAt: serverTimestamp() });
    b.set(doc(fs, "invites", c), { serverId: sref.id, name });
    b.set(doc(collection(fs, "servers", sref.id, "rooms")), { name: "general", createdAt: serverTimestamp() });
    await b.commit();
    return sref.id;
  }),
  joinByCode: wrap(async (u, c) => {
    const inv = await getDoc(doc(fs, "invites", c.trim()));
    if (!inv.exists()) throw new Error("That invite link doesn't work any more.");
    await updateDoc(doc(fs, "servers", inv.data().serverId), { members: arrayUnion(u) });
    return inv.data().serverId;
  }),
  watchRooms(sid, cb) {
    return onSnapshot(collection(fs, "servers", sid, "rooms"), (s) => {
      cb(s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt) })).sort((a, b) => a.createdAt - b.createdAt));
    }, () => cb([]));
  },
  createRoom: wrap((sid, name) => addDoc(collection(fs, "servers", sid, "rooms"), { name, createdAt: serverTimestamp() })),
  watchMessages(sid, rid, cb) {
    const q = query(collection(fs, "servers", sid, "rooms", rid, "messages"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q, { includeMetadataChanges: false }, (s) => {
      cb(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }), createdAt: ms(d.data({ serverTimestamps: "estimate" }).createdAt) })).reverse());
    }, () => cb([]));
  },
  dmId: (a, b) => [a, b].sort().join("_"),
  openDM: wrap(async (u, uName, other, otherName) => {
    const id = [u, other].sort().join("_");
    let exists = false;
    try { exists = (await getDoc(doc(fs, "dms", id))).exists(); } catch (e) { exists = false; }
    if (!exists) await setDoc(doc(fs, "dms", id), { members: [u, other].sort(), names: { [u]: uName, [other]: otherName }, status: "pending", requestedBy: u, updatedAt: serverTimestamp() });
    return id;
  }),
  acceptDM: wrap((id) => updateDoc(doc(fs, "dms", id), { status: "accepted", updatedAt: serverTimestamp() })),
  declineDM: wrap((id) => deleteDoc(doc(fs, "dms", id))),
  watchDM(id, cb) {
    return onSnapshot(doc(fs, "dms", id), (d) => cb(d.exists() ? { id: d.id, ...d.data() } : null), () => cb(null));
  },
  watchDMs(u, cb) {
    return onSnapshot(query(collection(fs, "dms"), where("members", "array-contains", u)), (s) => {
      cb(s.docs.map((d) => ({ id: d.id, ...d.data(), updatedAt: ms(d.data().updatedAt) })).sort((a, b) => b.updatedAt - a.updatedAt));
    }, () => cb([]));
  },
  watchDMMessages(id, cb) {
    const q = query(collection(fs, "dms", id, "messages"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q, (s) => {
      cb(s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }), createdAt: ms(d.data({ serverTimestamps: "estimate" }).createdAt) })).reverse());
    }, () => cb([]));
  },
  sendDM: wrap(async (id, m) => {
    await addDoc(collection(fs, "dms", id, "messages"), { uid: m.uid, name: m.name, text: m.text, createdAt: serverTimestamp() });
    await setDoc(doc(fs, "dms", id), { updatedAt: serverTimestamp(), last: m.text.slice(0, 80) }, { merge: true });
  }),
  async getNames(uids) {
    const out = {};
    await Promise.all(uids.map(async (id) => { try { const d = await getDoc(doc(fs, "users", id)); out[id] = (d.exists() && d.data().name) || "Someone"; } catch (e) { out[id] = "Someone"; } }));
    return out;
  },
  watchBlocked(u, cb) {
    return onSnapshot(doc(fs, "users", u), (d) => cb((d.exists() && d.data().blocked) || {}), () => cb({}));
  },
  blockUser: wrap((u, other, name) => setDoc(doc(fs, "users", u), { blocked: { [other]: name || "Someone" } }, { merge: true })),
  unblockUser: wrap((u, other) => setDoc(doc(fs, "users", u), { blocked: { [other]: deleteField() } }, { merge: true })),
  reportMessage: wrap((r) => addDoc(collection(fs, "reports"), { ...r, createdAt: serverTimestamp() })),
  sendMessage: wrap((sid, rid, m) => addDoc(collection(fs, "servers", sid, "rooms", rid, "messages"), {
    uid: m.uid, name: m.name, text: m.text, createdAt: serverTimestamp()
  }))
};

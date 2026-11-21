// Synchronisation Firebase (même compte Google et mêmes données que l'application Android)
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import * as Store from './store.js';

export const sync = { status: 'off', user: null, error: '' };

let auth = null;
let db = null;
let uid = null;
let unsubs = [];

function notify() {
  Store.emit('sync');
}

const toDoc = (kind, r) => {
  if (kind === 'repos') return { ts: r.ts, sec: r.sec };
  if (kind === 'sports') return { ts: r.ts, sec: r.sec, type: r.type };
  return { ts: r.ts };
};

const fromDoc = (kind, id, v) => {
  const ts = Number(v.ts);
  if (!Number.isFinite(ts)) return null;
  if (kind === 'waters') return { id, ts };
  const sec = Number(v.sec);
  if (!Number.isFinite(sec)) return null;
  if (kind === 'repos') return { id, ts, sec: Math.round(sec) };
  return { id, ts, sec: Math.round(sec), type: String(v.type || 'Sport') };
};

function fail(e) {
  sync.status = 'error';
  sync.error = e && e.code === 'permission-denied'
    ? 'Accès refusé par Firestore : vérifiez les règles de sécurité.'
    : (e && e.message) || 'Erreur de synchronisation.';
  notify();
}

function startListening() {
  Store.KINDS.forEach((kind) => {
    const un = onSnapshot(
      collection(db, 'users', uid, kind),
      (snap) => {
        sync.status = 'on';
        sync.error = '';
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'removed') {
            Store.removeRemote(kind, ch.doc.id);
          } else {
            if (Store.hasRecord(kind, ch.doc.id)) return;
            const rec = fromDoc(kind, ch.doc.id, ch.doc.data());
            if (rec) Store.addRemote(kind, rec);
          }
        });
        notify();
      },
      fail
    );
    unsubs.push(un);
  });
}

function stopListening() {
  unsubs.forEach((u) => {
    try {
      u();
    } catch (e) { /* ignoré */ }
  });
  unsubs = [];
}

function startSync() {
  sync.status = 'connecting';
  notify();
  // Envoi de ce qui existe déjà sur cet ordinateur
  Store.KINDS.forEach((kind) => {
    Store.data[kind].forEach((r) => {
      setDoc(doc(db, 'users', uid, kind, r.id), toDoc(kind, r)).catch(fail);
    });
  });
  startListening();
}

export function configured(cfg) {
  return !!(cfg && cfg.apiKey && !/^REMPLACER/i.test(cfg.apiKey) && cfg.projectId);
}

export function initSync(cfg) {
  if (!configured(cfg)) {
    sync.status = 'unconfigured';
    notify();
    return;
  }
  try {
    const app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    fail(e);
    return;
  }
  Store.setSyncHooks({
    upsert: (kind, r) => {
      if (uid) setDoc(doc(db, 'users', uid, kind, r.id), toDoc(kind, r)).catch(fail);
    },
    remove: (kind, id) => {
      if (uid) deleteDoc(doc(db, 'users', uid, kind, id)).catch(fail);
    }
  });
  sync.status = 'off';
  onAuthStateChanged(auth, (user) => {
    stopListening();
    if (user) {
      uid = user.uid;
      sync.user = { name: user.displayName || '', email: user.email || '', photo: user.photoURL || '' };
      startSync();
    } else {
      uid = null;
      sync.user = null;
      sync.status = 'off';
      notify();
    }
  });
}

export async function signInWithTokens(idToken, accessToken) {
  if (!auth) throw new Error('Synchronisation non configurée.');
  const cred = GoogleAuthProvider.credential(idToken || null, accessToken || null);
  await signInWithCredential(auth, cred);
}

export async function signOutUser() {
  stopListening();
  uid = null;
  if (auth) await signOut(auth);
  Store.clearLocal();
}

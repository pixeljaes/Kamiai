// Paste your Firebase details between the quotes below (see the guide).
// While they are empty, Kamiai runs in "demo mode" on this phone only.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
export const useFirebase = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

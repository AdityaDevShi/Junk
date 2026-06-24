import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { roleForEmail, type Role } from "./roles";
import { ensureProfile, saveProfile as saveProfileDoc, type Profile } from "./profile";

interface AuthContextValue {
  user: User | null;
  role: Role;
  profile: Profile | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, pw: string) => Promise<void>;
  signUpEmail: (email: string, pw: string, name?: string) => Promise<void>;
  signInAnon: () => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        ensureProfile(u)
          .then(setProfile)
          .catch(() => setProfile(null));
      } else {
        setProfile(null);
      }
    });
  }, []);

  // Authority role only for known emails (never for anonymous guests).
  const role: Role = user && !user.isAnonymous ? roleForEmail(user.email) : "citizen";

  const value: AuthContextValue = {
    user,
    role,
    profile,
    loading,
    signInGoogle: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signInEmail: async (email, pw) => {
      await signInWithEmailAndPassword(auth, email, pw);
    },
    signUpEmail: async (email, pw, name) => {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      if (name) await updateProfile(cred.user, { displayName: name });
    },
    signInAnon: async () => {
      await signInAnonymously(auth);
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
    saveProfile: async (data) => {
      if (!user) return;
      await saveProfileDoc(user.uid, data);
      setProfile((p) => (p ? { ...p, ...data } : p));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

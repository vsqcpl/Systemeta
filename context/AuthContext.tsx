"use client";

import React, { createContext, useContext, useReducer, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/roles";
import { getModuleEntryPage } from "@/lib/redirectMap";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "Invited";
  mfa: boolean;
  last_login_at: string;
  must_change_password: boolean;
  projectIds?: string[];
  clientIds?: string[];
  clientId?: string;
  reporteeIds?: string[];
  reporteeOf?: string;
}

export interface AuthState {
  user: UserProfile | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
}

type AuthAction =
  | { type: "AUTH_LOADING" }
  | { type: "AUTH_SUCCESS"; payload: UserProfile }
  | { type: "AUTH_FAILURE"; payload: string | null }
  | { type: "AUTH_LOGOUT" };

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "AUTH_LOADING":
      return { ...state, status: "loading", error: null };
    case "AUTH_SUCCESS": {
      const apiUser = action.payload as any;
      const userProfile: UserProfile = {
        ...apiUser,
        must_change_password: apiUser.mustChangePassword !== undefined ? apiUser.mustChangePassword : apiUser.must_change_password,
        last_login_at: apiUser.lastLoginAt !== undefined ? apiUser.lastLoginAt : apiUser.last_login_at,
      };
      return { user: userProfile, status: "authenticated", error: null };
    }
    case "AUTH_FAILURE":
      return { user: null, status: "unauthenticated", error: action.payload };
    case "AUTH_LOGOUT":
      return { user: null, status: "unauthenticated", error: null };
    default:
      return state;
  }
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  dispatch: React.Dispatch<AuthAction>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const router = useRouter();

  // On mount: rehydrate session from cookie
  useEffect(() => {
    async function rehydrate() {
      dispatch({ type: "AUTH_LOADING" });
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) throw new Error("No active session");
        const user = await res.json();
        dispatch({ type: "AUTH_SUCCESS", payload: user });
      } catch {
        dispatch({ type: "AUTH_FAILURE", payload: null });
      }
    }
    rehydrate();
  }, []);

  async function login(email: string, password: string, rememberMe: boolean) {
    console.log("AUTH CONTEXT: login called with rememberMe =", rememberMe);
    dispatch({ type: "AUTH_LOADING" });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = err.message ?? "Invalid email or password.";
        dispatch({ type: "AUTH_FAILURE", payload: msg });
        return { success: false, message: msg };
      }

      // Fetch profile
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        throw new Error("Failed to load user profile");
      }
      const apiUser = await meRes.json();
      const user: UserProfile = {
        ...apiUser,
        must_change_password: apiUser.mustChangePassword !== undefined ? apiUser.mustChangePassword : apiUser.must_change_password,
        last_login_at: apiUser.lastLoginAt !== undefined ? apiUser.lastLoginAt : apiUser.last_login_at,
      };
      dispatch({ type: "AUTH_SUCCESS", payload: user });

      if (user.must_change_password) {
        router.replace("/change-password");
        return { success: true };
      }

      // Always navigate to module selection first.
      // The user must manually choose a module before role-based access applies.
      // Clear any previously saved module so AppLayout doesn't skip module selection.
      try {
        localStorage.removeItem("vsqc_active_module");
      } catch (_) {}

      // Client Contacts ONLY have access to Project Management module.
      if (user.role === "client_contact") {
        try {
          localStorage.setItem("vsqc_active_module", "projects");
        } catch (_) {}
        const destination = getModuleEntryPage(user.role as UserRole, "projects");
        router.replace(destination);
      } else {
        router.replace("/select-module");
      }
      
      return { success: true };
    } catch (err) {
      const msg = "Something went wrong. Please try again.";
      dispatch({ type: "AUTH_FAILURE", payload: msg });
      return { success: false, message: msg };
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (_) {}
    dispatch({ type: "AUTH_LOGOUT" });
    router.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

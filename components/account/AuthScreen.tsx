"use client";

import { useState } from "react";
import { AuthForm } from "@/components/account/AuthForm";
import { signInAction, registerAction } from "@/lib/actions/auth";

export function AuthScreen({ returnTo, subtext }: { returnTo: string; subtext?: string }) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const isSignIn = mode === "signin";

  return (
    <div className="space-y-8 pt-4">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          PUGNA<span className="text-signal">.</span>
        </h1>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{isSignIn ? "Sign in" : "Create account"}</h2>
        <p className="text-mute text-sm">
          {isSignIn
            ? (subtext ?? "Follow fighters, save fights, follow clubs and get notified when something happens.")
            : "Join PUGNA — takes less than a minute."}
        </p>
      </div>

      {isSignIn ? (
        <AuthForm key="signin" action={signInAction} returnTo={returnTo} submitLabel="Sign in" />
      ) : (
        <AuthForm key="register" action={registerAction} returnTo={returnTo} submitLabel="Create account" showName />
      )}

      <p className="text-center text-sm text-mute">
        {isSignIn ? "Don't have an account? " : "Already have an account? "}
        <button
          onClick={() => setMode(isSignIn ? "register" : "signin")}
          className="text-signal font-semibold underline underline-offset-2"
        >
          {isSignIn ? "Create account" : "Sign in"}
        </button>
      </p>

      <div className="text-xs text-mute pt-2 border-t border-white/10 space-y-2">
        <p className="text-center font-medium">You can still use PUGNA without an account</p>
        <ul className="space-y-1 max-w-[220px] mx-auto">
          <li>· Browse events</li>
          <li>· Watch available live fights</li>
          <li>· Scan event QR codes</li>
          <li>· Explore clubs</li>
          <li>· Explore fighters</li>
        </ul>
      </div>
    </div>
  );
}

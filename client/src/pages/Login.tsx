import { useState } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { Button, Card, Input } from "../components/ui";
import { Logo } from "../components/Logo";
import { useToast } from "../components/Toast";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { refetch } = useAuth();
  const toast = useToast();

  const login = trpc.auth.login.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Signed in. Welcome back!");
        refetch();
      } else {
        const message = "Incorrect password.";
        setError(message);
        toast.error(message);
      }
    },
    onError: () => {
      const message = "Something went wrong. Try again.";
      setError(message);
      toast.error(message);
    },
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-navy via-brand-primary to-brand-secondary p-4">
      {/* Soft decorative glow, purely visual */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-brand-accent/10 blur-3xl" aria-hidden="true" />

      <Card className="relative w-full max-w-sm animate-fade-slide-in border-white/10 shadow-soft-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="lg" className="mb-3" />
          <p className="mt-1 text-sm text-gray-500">Sign in to manage your schedule</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            login.mutate({ password });
          }}
          className="space-y-4"
        >
          <Input
            label="Password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            required
          />
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

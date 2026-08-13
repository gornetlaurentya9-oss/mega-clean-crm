import { useState } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { Button, Card, Input } from "../components/ui";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { refetch } = useAuth();
  const login = trpc.auth.login.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        refetch();
      } else {
        setError("Incorrect password.");
      }
    },
    onError: () => setError("Something went wrong. Try again."),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-700 p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">🧹</div>
          <h1 className="text-xl font-bold text-gray-900">Mega Clean CRM</h1>
          <p className="text-sm text-gray-500">Sign in to manage your schedule</p>
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

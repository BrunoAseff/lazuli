import { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useAuthCapabilities } from "@/features/account-settings/api/account-settings-queries.ts";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import { AuthFeedback } from "./auth-feedback.tsx";

const GoogleIcon = () => (
  <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
    <path
      d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
      fill="#4285F4"
    />
    <path
      d="M12 22c2.7 0 4.98-.9 6.63-2.38l-3.25-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"
      fill="#34A853"
    />
    <path
      d="M6.39 13.92A6.01 6.01 0 0 1 6.07 12c0-.67.11-1.32.32-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.53l3.35-2.61Z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z"
      fill="#EA4335"
    />
  </svg>
);

export const GoogleAuthOption = ({ callbackPath = "/dashboard" }: { callbackPath?: string }) => {
  const capabilities = useAuthCapabilities();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (capabilities.isPending || capabilities.isError || !capabilities.data?.google) return null;

  const continueWithGoogle = async () => {
    setPending(true);
    setError(null);
    const safeCallbackPath =
      callbackPath.startsWith("/") && !callbackPath.startsWith("//") ? callbackPath : "/dashboard";
    const result = await authClient.signIn.social({
      callbackURL: new URL(safeCallbackPath, window.location.origin).toString(),
      errorCallbackURL: `${window.location.origin}/login?error=google`,
      provider: "google",
    });
    if (result.error) {
      setPending(false);
      setError(getAuthErrorMessage(result.error, "Não foi possível continuar com o Google."));
    }
  };

  return (
    <div className="mb-5 grid gap-4">
      <Button
        disabled={pending}
        onClick={() => void continueWithGoogle()}
        type="button"
        variant="outline"
      >
        {pending ? <Spinner aria-hidden="true" /> : <GoogleIcon />}
        Continuar com Google
      </Button>
      {error && <AuthFeedback kind="error">{error}</AuthFeedback>}
      <div className="flex items-center gap-3" role="separator">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou continue com e-mail</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
};

import { createPkcePair } from "@/lib/oauth/device-flow";
import type { PkceCodeFlowConfig, StoredTokens } from "@/lib/oauth/types";

/**
 * Browser-based authorization-code + PKCE flow where the provider shows the
 * user a code to copy/paste back into the app (Anthropic's claude.ai OAuth —
 * the exact flow Claude Code itself uses for `claude auth login`). Unlike
 * pasting the Claude Code Keychain credential, this gives SignalStack its own
 * independent token chain, so refreshes here never invalidate the CLI's
 * tokens (Anthropic rotates the refresh token on every use).
 */
export interface PendingPkceCodeFlow {
  authorizeUrl: string;
  codeVerifier: string;
  state: string;
}

export async function startPkceCodeFlow(
  config: PkceCodeFlowConfig,
): Promise<PendingPkceCodeFlow> {
  const pkce = await createPkcePair();
  const query = new URLSearchParams({
    code: "true",
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    state: pkce.verifier,
  });
  return {
    authorizeUrl: `${config.authorizeUrl}?${query.toString()}`,
    codeVerifier: pkce.verifier,
    state: pkce.verifier,
  };
}

export async function exchangePkceCode(
  config: PkceCodeFlowConfig,
  pending: PendingPkceCodeFlow,
  pastedCode: string,
): Promise<StoredTokens> {
  const trimmed = pastedCode.trim();
  if (!trimmed) throw new Error("Paste the code from the browser first.");
  // Anthropic renders the code as `<authorization_code>#<state>`.
  const [code, stateFromCode] = trimmed.split("#");
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      state: stateFromCode ?? pending.state,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code_verifier: pending.codeVerifier,
    }),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON body — fall through to the status-based error below.
  }
  if (!response.ok || typeof data.access_token !== "string") {
    const message =
      (typeof data.error_description === "string" ? data.error_description : null) ??
      (typeof data.error === "string" ? data.error : null) ??
      `Sign-in failed (HTTP ${response.status}).`;
    throw new Error(message);
  }

  const account = (data.account ?? null) as Record<string, unknown> | null;
  return {
    accessToken: data.access_token,
    refreshToken: (typeof data.refresh_token === "string" ? data.refresh_token : null),
    expiresAt:
      typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : null,
    accountId:
      account && typeof account.uuid === "string" ? account.uuid : null,
    scope: typeof data.scope === "string" ? data.scope : null,
  };
}

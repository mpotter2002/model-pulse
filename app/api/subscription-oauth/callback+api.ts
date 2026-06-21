import {
  SUBSCRIPTION_OAUTH_CAPABILITIES,
  getOAuthRedirectUri,
  getSubscriptionOAuthEnv,
  isProviderId,
  missingSubscriptionOAuthEnv,
} from "@/lib/subscription-oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerParam = url.searchParams.get("provider");
  const code = url.searchParams.get("code");

  if (!isProviderId(providerParam)) {
    return Response.json({ error: "Unsupported provider." }, { status: 400 });
  }

  const capability = SUBSCRIPTION_OAUTH_CAPABILITIES[providerParam];
  if (!capability.officialTelemetryAvailable) {
    return Response.json(
      {
        error: "Subscription OAuth telemetry is not available for this provider.",
        provider: capability,
      },
      { status: 501 },
    );
  }

  if (!code) {
    return Response.json({ error: "Missing OAuth code." }, { status: 400 });
  }

  const missingEnv = missingSubscriptionOAuthEnv(providerParam);
  if (missingEnv.length > 0) {
    return Response.json(
      {
        error: "OAuth provider is scaffolded but missing environment variables.",
        missingEnv,
      },
      { status: 500 },
    );
  }

  const env = getSubscriptionOAuthEnv(providerParam);
  const response = await fetch(env.tokenUrl!, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.clientId!,
      client_secret: env.clientSecret!,
      code,
      grant_type: "authorization_code",
      redirect_uri: getOAuthRedirectUri(request, providerParam),
    }),
  });

  if (!response.ok) {
    return Response.json(
      {
        error: "OAuth token exchange failed.",
        status: response.status,
      },
      { status: 502 },
    );
  }

  const tokenPayload = await response.json();
  return Response.json({
    provider: providerParam,
    status: "connected",
    tokenPayload,
    storage: "TODO: connect token vault before production use.",
  });
}

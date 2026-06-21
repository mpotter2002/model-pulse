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
  const authorizeUrl = new URL(env.authorizeUrl!);
  authorizeUrl.searchParams.set("client_id", env.clientId!);
  authorizeUrl.searchParams.set("redirect_uri", getOAuthRedirectUri(request, providerParam));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", crypto.randomUUID());

  return Response.redirect(authorizeUrl);
}

import { SUBSCRIPTION_OAUTH_CAPABILITIES, missingSubscriptionOAuthEnv } from "@/lib/subscription-oauth";
import { PROVIDER_ORDER } from "@/lib/providers";

export async function GET() {
  return Response.json({
    providers: PROVIDER_ORDER.map((providerId) => {
      const capability = SUBSCRIPTION_OAUTH_CAPABILITIES[providerId];
      return {
        ...capability,
        missingEnv: missingSubscriptionOAuthEnv(providerId),
      };
    }),
  });
}

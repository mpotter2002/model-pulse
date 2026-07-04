import { SUBSCRIPTION_PROVIDERS } from "@/lib/oauth/providers";
import { PROVIDERS } from "@/lib/providers";
import type { SubscriptionProviderId } from "@/lib/oauth/types";
import type { ModelCardId, ProviderId } from "@/types/domain";
import { getProviderLogo, type ProviderLogo } from "@/lib/provider-logos";

export type AIModelCardConfig = {
  id: ModelCardId;
  title: string;
  subtitle: string;
  initials: string;
  accent: string;
  logo?: ProviderLogo;
  apiProviderId?: ProviderId;
  subscriptionProviderId?: SubscriptionProviderId;
};

export function makeModelCards(): AIModelCardConfig[] {
  const cards: AIModelCardConfig[] = [
    {
      id: "openai",
      title: "ChatGPT / OpenAI",
      subtitle: "ChatGPT subscription limits and OpenAI API usage in one place.",
      initials: "OA",
      accent: PROVIDERS.openai.accent,
      apiProviderId: "openai",
      subscriptionProviderId: "codex-sub",
    },
    {
      id: "anthropic",
      title: "Claude / Anthropic",
      subtitle: "Claude subscription windows alongside Anthropic API/admin tracking.",
      initials: "Cl",
      accent: PROVIDERS.anthropic.accent,
      apiProviderId: "anthropic",
      subscriptionProviderId: "claude-sub",
    },
    {
      id: "kimi",
      title: "Kimi / Moonshot",
      subtitle: "Kimi subscription login plus Moonshot API/manual tracking.",
      initials: "Ki",
      accent: PROVIDERS.kimi.accent,
      apiProviderId: "kimi",
      subscriptionProviderId: "kimi-sub",
    },
    subscriptionOnly("minimax", "MiniMax", "MiniMax subscription plan and model windows.", "minimax-sub", "MM"),
    subscriptionOnly("zai", "Z.ai GLM", "Z.ai coding plan usage from a pasted token.", "zai-sub", "ZA"),
    subscriptionOnly("gemini", "Gemini", "Gemini CLI subscription quota from desktop OAuth credentials.", "gemini-sub", "GE"),
    subscriptionOnly("elevenlabs", "ElevenLabs", "ElevenLabs character credit and voice slot usage.", "elevenlabs-sub", "EL"),
    subscriptionOnly("poe", "Poe", "Poe point balance and usage history.", "poe-sub", "PO"),
    subscriptionOnly("codebuff", "Codebuff", "Codebuff credit balance and weekly rate limits.", "codebuff-sub", "CB"),
    subscriptionOnly("copilot", "GitHub Copilot", "GitHub Copilot premium interactions and chat quotas.", "copilot-sub", "CO"),
    subscriptionOnly("chutes", "Chutes", "Chutes subscription usage and quota windows.", "chutes-sub", "CH"),
    subscriptionOnly("factory", "Factory", "Factory AI subscription usage and token windows.", "factory-sub", "FA"),
    subscriptionOnly("opencode", "OpenCode", "OpenCode Go API-key access and documented monthly spend limits.", "opencode-sub", "OC"),
  ];
  return cards.map((card) => ({ ...card, logo: getProviderLogo(card.id) }));
}

function subscriptionOnly(
  id: ModelCardId,
  title: string,
  subtitle: string,
  subscriptionProviderId: SubscriptionProviderId,
  initials: string,
): AIModelCardConfig {
  return {
    id,
    title,
    subtitle,
    initials,
    accent: SUBSCRIPTION_PROVIDERS[subscriptionProviderId].accent,
    subscriptionProviderId,
  };
}

export function getModelCardById(id: string | undefined): AIModelCardConfig | null {
  if (!id) return null;
  return makeModelCards().find((card) => card.id === id) ?? null;
}

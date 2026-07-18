import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Linking, Pressable, TextInput, View } from "react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RateLimitLine } from "@/components/ui/rate-limit-line";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/components/ui/theme";
import type { PendingDeviceFlow } from "@/lib/oauth/device-flow";
import {
  beginDeviceLogin,
  beginPkceCodeLogin,
  completePkceCodeLogin,
  disconnect,
  getConnectionStatus,
  parseAndSaveApiToken,
  pollDeviceLogin,
  type ConnectionStatus,
} from "@/lib/oauth/manager";
import type { PendingPkceCodeFlow } from "@/lib/oauth/pkce-code-flow";
import { SUBSCRIPTION_PROVIDERS } from "@/lib/oauth/providers";
import type { SubscriptionProviderId, UsageLimitRow } from "@/lib/oauth/types";

export function SubscriptionCard({ providerId, refreshNonce }: { providerId: SubscriptionProviderId; refreshNonce: number }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <SubscriptionPanel providerId={providerId} refreshNonce={refreshNonce} showHeader />
    </View>
  );
}

export function SubscriptionPanel({
  providerId,
  refreshNonce,
  showHeader = false,
}: {
  providerId: SubscriptionProviderId;
  refreshNonce: number;
  showHeader?: boolean;
}) {
  const theme = useTheme();
  const def = SUBSCRIPTION_PROVIDERS[providerId];
  const [status, setStatus] = useState<ConnectionStatus>({ kind: "disconnected" });
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDeviceFlow | null>(null);
  const [pendingPkce, setPendingPkce] = useState<PendingPkceCodeFlow | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passiveClaudeRefresh = providerId === "claude-sub";

  const refresh = useCallback(
    async (allowNetwork = true, force = false) => {
      const s = await getConnectionStatus(providerId, { allowNetwork, force });
      setStatus(s);
    },
    [providerId],
  );

  // Distinguish the initial passive load from a user-initiated refresh (a
  // bumped `refreshNonce`). On mount we honor `passiveClaudeRefresh`
  // (cache-only for Claude, to avoid tripping Anthropic's throttled usage
  // endpoint). When the parent's Refresh button bumps the nonce, treat it as
  // an explicit user action and force a real network fetch.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      void refresh(!passiveClaudeRefresh);
      return;
    }
    void refresh(true, true);
  }, [passiveClaudeRefresh, refresh, refreshNonce]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  };

  async function startDeviceLogin() {
    setBusy(true);
    setError(null);
    try {
      const next = await beginDeviceLogin(providerId);
      setPending(next);
      const target = next.authorization.verificationUriComplete ?? next.authorization.verificationUri;
      if (target) void Linking.openURL(target);
      schedulePoll(next, next.authorization.interval);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start login.");
    } finally {
      setBusy(false);
    }
  }

  function schedulePoll(flow: PendingDeviceFlow, intervalSeconds: number) {
    stopPolling();
    pollTimer.current = setTimeout(async () => {
      try {
        const result = await pollDeviceLogin(providerId, flow);
        if (result.kind === "success") {
          setPending(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          void refresh(!passiveClaudeRefresh);
          return;
        }
        if (result.kind === "denied") {
          setPending(null);
          setError(result.message ?? "Access denied.");
          return;
        }
        if (result.kind === "expired") {
          setPending(null);
          setError("Login code expired. Try again.");
          return;
        }
        const nextInterval = result.kind === "slow-down" ? intervalSeconds + 5 : intervalSeconds;
        schedulePoll(flow, nextInterval);
      } catch (e) {
        setPending(null);
        setError(e instanceof Error ? e.message : "Login failed.");
      }
    }, Math.max(1, intervalSeconds) * 1000);
  }

  async function connectToken() {
    if (!tokenDraft.trim()) return;
    setBusy(true);
    setChecking(true);
    setError(null);
    try {
      await parseAndSaveApiToken(providerId, tokenDraft);
      setTokenDraft("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh(!passiveClaudeRefresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save token.");
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }

  async function startPkceLogin() {
    setBusy(true);
    setError(null);
    try {
      const next = await beginPkceCodeLogin(providerId);
      setPendingPkce(next);
      void Linking.openURL(next.authorizeUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start sign-in.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPkceCode() {
    if (!pendingPkce || !tokenDraft.trim()) return;
    setBusy(true);
    setChecking(true);
    setError(null);
    try {
      await completePkceCodeLogin(providerId, pendingPkce, tokenDraft);
      setTokenDraft("");
      setPendingPkce(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh(!passiveClaudeRefresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }

  async function onDisconnect() {
    setBusy(true);
    stopPolling();
    setPending(null);
    setPendingPkce(null);
    try {
      await disconnect(providerId);
      void refresh(false);
    } finally {
      setBusy(false);
    }
  }

  const connected = status.kind === "connected";

  return (
    <Card padding={showHeader ? 4 : 0} background={showHeader ? "card" : "transparent"}>
      <View style={{ gap: 14 }}>
        {showHeader ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: def.accent }} />
              <Text size="base" weight="bold">
                {def.shortLabel}
              </Text>
            </View>
            <StatusText connected={connected} checking={checking} status={status} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text size="sm" weight="semibold" color="muted">
              SUBSCRIPTION
            </Text>
            <StatusText connected={connected} checking={checking} status={status} />
          </View>
        )}

        {pending ? (
          <View style={{ gap: 8, borderRadius: 12, padding: 14, backgroundColor: theme.muted }}>
            <Text size="sm" color="muted">
              {def.deviceFlow?.verificationHint ?? "Approve in your browser. Enter this code if asked:"}
            </Text>
            <Pressable onPress={() => Clipboard.setStringAsync(pending.authorization.userCode)}>
              <Text size="2xl" weight="extrabold" style={{ letterSpacing: 4, fontVariant: ["tabular-nums"] }}>
                {pending.authorization.userCode}
              </Text>
            </Pressable>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                const t = pending.authorization.verificationUriComplete ?? pending.authorization.verificationUri;
                if (t) void Linking.openURL(t);
              }}
            >
              Reopen browser
            </Button>
          </View>
        ) : null}

        {connected ? (
          <View style={{ gap: 12 }}>
            {status.usage.planLabel ? (
              <Text size="sm" color="muted">
                {status.usage.planLabel}
              </Text>
            ) : null}
            {status.usage.limits.length === 0 ? (
              <Text size="sm" color="muted">
                No usage rows returned yet.
              </Text>
            ) : (
              status.usage.limits.map((row, idx) => <UsageRowView key={idx} row={row} accent={def.accent} />)
            )}
            <Text size="xs" color="muted">
              Updated {status.updatedAt}
            </Text>
            {status.usage.debugDetail ? (
              <Text size="xs" color="muted" style={{ opacity: 0.7 }}>
                {status.usage.debugDetail}
              </Text>
            ) : null}
          </View>
        ) : null}

        {status.kind === "error" && !connected ? <Text color="destructive">{status.message}</Text> : null}
        {error ? <Text color="destructive">{error}</Text> : null}

        {!connected && def.authKind === "device-flow" && !pending ? (
          <View style={{ gap: 10 }}>
            {def.tokenHint ? (
              <Text size="sm" color="muted">
                {def.tokenHint}
              </Text>
            ) : null}
            <Button onPress={startDeviceLogin} disabled={busy}>
              {busy ? "Starting…" : `Connect ${def.shortLabel}`}
            </Button>
          </View>
        ) : null}

        {!connected && def.authKind === "pkce-code" ? (
          <View style={{ gap: 10 }}>
            {def.tokenHint ? <Text size="sm" color="muted">{def.tokenHint}</Text> : null}
            {def.setupSteps ? <SetupSteps steps={def.setupSteps} /> : null}
            {!pendingPkce ? (
              <Button onPress={startPkceLogin} disabled={busy}>
                {busy ? "Opening…" : `Connect ${def.shortLabel}`}
              </Button>
            ) : (
              <View style={{ gap: 10 }}>
                <Input
                  value={tokenDraft}
                  onChangeText={setTokenDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Paste code from browser"
                />
                <Button onPress={submitPkceCode} disabled={busy || !tokenDraft.trim()}>
                  {busy ? "Signing in…" : "Submit code"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void Linking.openURL(pendingPkce.authorizeUrl)}
                >
                  Reopen browser
                </Button>
              </View>
            )}
          </View>
        ) : null}

        {!connected && def.authKind === "api-token" ? (
          <View style={{ gap: 10 }}>
            {def.tokenHint ? <Text size="sm" color="muted">{def.tokenHint}</Text> : null}
            {def.setupSteps ? <SetupSteps steps={def.setupSteps} /> : null}
            {def.helperCommand ? <CommandPill command={def.helperCommand} /> : null}
            <Input value={tokenDraft} onChangeText={setTokenDraft} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Paste token or JSON" />
            <Button onPress={connectToken} disabled={busy || !tokenDraft.trim()}>
              {busy ? "Saving…" : "Save token"}
            </Button>
          </View>
        ) : null}

        {connected ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" size="sm" onPress={() => refresh(true, true)} disabled={busy}>
              Refresh usage
            </Button>
            <Button variant="outline" size="sm" onPress={onDisconnect} disabled={busy}>
              Disconnect
            </Button>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function StatusText({ connected, checking, status }: { connected: boolean; checking: boolean; status: ConnectionStatus }) {
  if (checking) return <Text size="xs" color="muted">Checking…</Text>;
  if (connected) return <Badge variant="success">Connected</Badge>;
  if (status.kind === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">Not connected</Badge>;
}

function SetupSteps({ steps }: { steps: string[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {steps.map((step, index) => (
        <View key={step} style={{ flexDirection: "row", gap: 8 }}>
          <Text size="xs" weight="bold" color="muted" style={{ width: 18 }}>
            {index + 1}.
          </Text>
          <Text size="sm" color="muted" style={{ flex: 1 }}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CommandPill({ command }: { command: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Clipboard.setStringAsync(command);
        Haptics.selectionAsync();
      }}
      style={{ borderRadius: 10, backgroundColor: theme.muted, paddingHorizontal: 12, paddingVertical: 10 }}
    >
      <Text size="xs" color="muted" style={{ marginBottom: 4 }}>
        Mac command (tap to copy)
      </Text>
      <Text size="sm" weight="semibold">
        {command}
      </Text>
    </Pressable>
  );
}

export function UsageRowView({ row, accent }: { row: UsageLimitRow; accent: string }) {
  const theme = useTheme();
  const pct = row.percentUsed;
  const detail =
    pct !== null
      ? `${pct}% used`
      : row.used !== null && row.limit !== null
        ? `${formatInt(row.used)} / ${formatInt(row.limit)}`
        : row.used !== null
          ? formatInt(row.used)
          : "—";

  const remaining = pct !== null ? Math.max(0, 1 - pct / 100) : row.used !== null && row.limit !== null && row.limit > 0 ? Math.max(0, 1 - row.used / row.limit) : null;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text size="sm" weight="medium">
          {row.label}
        </Text>
        <Text size="sm" color="muted" style={{ fontVariant: ["tabular-nums"] }}>
          {detail}
        </Text>
      </View>
      {remaining !== null ? (
        <RateLimitLine value={remaining} color={accent} />
      ) : null}
      {row.resetHint ? (
        <Text size="xs" color="muted">
          {row.resetHint}
        </Text>
      ) : null}
    </View>
  );
}

export function formatInt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

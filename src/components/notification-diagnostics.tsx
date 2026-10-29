import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { loadBackgroundAlertDiagnostics, type BackgroundAlertDiagnostics } from "@/lib/notification-diagnostics";

export function NotificationDiagnostics() {
  const [value, setValue] = useState<BackgroundAlertDiagnostics | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  async function refresh() {
    setStatus("loading");
    try {
      setValue(await loadBackgroundAlertDiagnostics());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void refresh(); }, []);
  return (
    <View style={{ gap: 6 }}>
      <Text size="sm" weight="semibold">Background delivery checks</Text>
      {status === "loading" ? <Text size="xs" color="muted">Loading check history…</Text> :
        status === "error" ? <Text size="xs" color="muted">Check history is temporarily unavailable.</Text> :
        !value ? <Text size="xs" color="muted">No background check recorded by this build yet.</Text> : (
          <>
            <Text size="xs" color="muted">Last started: {new Date(value.startedAt).toLocaleString()}</Text>
            <Text size="xs" color="muted">{value.completedAt ? `Last finished: ${new Date(value.completedAt).toLocaleString()}` : "No completion recorded; iOS may have interrupted this check."}</Text>
            <Text size="xs" color="muted">Result: {value.outcome} · {value.apiProvidersChecked} API connections · {value.subscriptionsWithUsage} subscriptions with usage · {value.alertsSent} alerts scheduled</Text>
          </>
        )}
      <Text size="xs" color="muted">These are background checks only. Opening the app does not count as a background run.</Text>
      <Button variant="secondary" size="sm" disabled={status === "loading"} onPress={() => void refresh()} style={{ alignSelf: "flex-start" }}>Refresh check history</Button>
    </View>
  );
}

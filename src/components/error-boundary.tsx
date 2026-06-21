import React from "react";
import { ScrollView, Text, View } from "react-native";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SignalStack] App crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: "#0D1418" }}
          contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 16 }}
        >
          <Text style={{ color: "#F5A0A0", fontSize: 13, fontWeight: "800", letterSpacing: 0.5 }}>
            SIGNALSTACK CRASHED
          </Text>
          <Text style={{ color: "#F5F8FA", fontSize: 22, fontWeight: "800" }}>
            {this.state.error.message || "Unknown error"}
          </Text>
          <View style={{ borderRadius: 12, padding: 14, backgroundColor: "#1B2932" }}>
            <Text selectable style={{ color: "#C1D0DA", fontSize: 12, fontFamily: "Menlo", lineHeight: 17 }}>
              {(this.state.error.stack ?? "no stack").slice(0, 4000)}
            </Text>
          </View>
          <Text selectable style={{ color: "#8EA0AB", fontSize: 12 }}>
            Long-press the stack text to copy it, then send it back to the agent.
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

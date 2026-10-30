import React, { Children, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { getCardGridLayout, getMasonryLayout } from "@/lib/adaptive-layout";

/** Measure the container so rotation, folding and split windows all reflow in place. */
export function AdaptiveCardGrid({ children, minimumCardWidth = 260 }: { children: React.ReactNode; minimumCardWidth?: number }) {
  const [width, setWidth] = useState(0);
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const { fontScale } = useWindowDimensions();
  const { columns, cardWidth, gap } = getCardGridLayout(width, fontScale, minimumCardWidth);
  const cards = Children.toArray(children);
  const keys = cards.map((child, index) => React.isValidElement(child) ? String(child.key ?? index) : String(index));
  const { positions, height } = getMasonryLayout(keys.map((key) => {
    const measured = measurements[key];
    return measured && measured.width === cardWidth ? measured.height : 280;
  }), columns, gap);

  return (
    <View
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={{ height }}
    >
      {cards.map((child, index) => (
        <View
          key={keys[index]}
          onLayout={({ nativeEvent }) => {
            const measured = nativeEvent.layout;
            // Ignore measurements from a previous width during rotation/folding.
            if (typeof cardWidth !== "number" || Math.abs(measured.width - cardWidth) > 1) return;
            const key = keys[index];
            setMeasurements((previous) => previous[key]?.width === cardWidth && previous[key]?.height === measured.height
              ? previous : { ...previous, [key]: { width: cardWidth, height: measured.height } });
          }}
          style={{ position: "absolute", top: positions[index].top, left: positions[index].column * (typeof cardWidth === "number" ? cardWidth + gap : 0), width: cardWidth, minWidth: 0 }}
        >{child}</View>
      ))}
    </View>
  );
}

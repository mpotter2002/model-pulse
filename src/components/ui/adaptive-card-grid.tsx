import React, { Children, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { getCardGridLayout } from "@/lib/adaptive-layout";

/** Measure the container so rotation, folding and split windows all reflow in place. */
export function AdaptiveCardGrid({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const { cardWidth, gap } = getCardGridLayout(width, fontScale);

  return (
    <View
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: "wrap", columnGap: gap, alignItems: "flex-start" }}
    >
      {Children.map(children, (child) => (
        <View style={{ width: cardWidth, minWidth: 0 }}>{child}</View>
      ))}
    </View>
  );
}

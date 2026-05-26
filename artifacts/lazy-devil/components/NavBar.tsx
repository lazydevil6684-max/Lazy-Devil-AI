import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface NavItem {
  screen: Screen;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

const ITEMS: NavItem[] = [
  { screen: "terminal", icon: "terminal", label: "SHELL" },
  { screen: "ai", icon: "cpu", label: "AI" },
  { screen: "files", icon: "folder", label: "FILES" },
  { screen: "tools", icon: "zap", label: "TOOLS" },
  { screen: "ducky", icon: "code", label: "DUCKY" },
  { screen: "bridge", icon: "link", label: "BRIDGE" },
];

export default function NavBar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeScreen, setActiveScreen } = useApp();

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.container,
        {
          borderTopColor: colors.border,
          paddingBottom,
          backgroundColor: "rgba(0,0,0,0.97)",
        },
      ]}
    >
      {ITEMS.map((item) => {
        const active = activeScreen === item.screen;
        const isBridge = item.screen === "bridge";
        return (
          <TouchableOpacity
            key={item.screen}
            style={styles.item}
            onPress={() => setActiveScreen(item.screen)}
          >
            {active && (
              <View style={[styles.activeDot, { backgroundColor: isBridge ? "#44ff44" : colors.primary }]} />
            )}
            <Feather
              name={item.icon}
              size={15}
              color={active ? (isBridge ? "#44ff44" : colors.navActive) : colors.navInactive}
            />
            <Text
              style={[
                styles.label,
                { color: active ? (isBridge ? "#44ff44" : colors.navActive) : colors.navInactive },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  item: {
    flex: 1,
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 3,
    gap: 2,
    position: "relative",
  },
  activeDot: {
    position: "absolute",
    top: 0,
    width: "60%",
    height: 2,
  },
  label: {
    fontFamily: "monospace",
    fontSize: 6,
    letterSpacing: 0.3,
    fontWeight: "bold",
  },
});

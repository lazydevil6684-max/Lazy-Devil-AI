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
  { screen: "terminal", icon: "terminal", label: "TERMINAL" },
  { screen: "ai", icon: "cpu", label: "AI CHAT" },
  { screen: "files", icon: "folder", label: "FILES" },
  { screen: "tools", icon: "zap", label: "TOOLS" },
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
          paddingBottom: paddingBottom,
          backgroundColor: "rgba(0,0,0,0.97)",
        },
      ]}
    >
      {ITEMS.map((item) => {
        const active = activeScreen === item.screen;
        return (
          <TouchableOpacity
            key={item.screen}
            style={styles.item}
            onPress={() => setActiveScreen(item.screen)}
          >
            {active && (
              <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
            )}
            <Feather
              name={item.icon}
              size={20}
              color={active ? colors.navActive : colors.navInactive}
            />
            <Text
              style={[
                styles.label,
                { color: active ? colors.navActive : colors.navInactive },
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
    paddingTop: 8,
    paddingBottom: 4,
    gap: 3,
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
    fontSize: 8,
    letterSpacing: 0.5,
    fontWeight: "bold",
  },
});

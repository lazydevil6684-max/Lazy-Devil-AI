import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface NavItem {
  screen: Screen;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  accent?: string;
}

const ITEMS: NavItem[] = [
  { screen: "terminal", icon: "terminal",  label: "SHELL"  },
  { screen: "ai",       icon: "cpu",       label: "AI"     },
  { screen: "netmap",   icon: "wifi",      label: "NETMAP", accent: "#00ccff" },
  { screen: "tools",    icon: "zap",       label: "TOOLS"  },
  { screen: "files",    icon: "folder",    label: "FILES"  },
  { screen: "ducky",    icon: "code",      label: "DUCKY"  },
  { screen: "bridge",   icon: "link",      label: "BRIDGE", accent: "#44ff44" },
];

export default function NavBar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeScreen, setActiveScreen } = useApp();

  const paddingBottom = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View
      style={[
        styles.wrapper,
        { borderTopColor: colors.border, paddingBottom, backgroundColor: "rgba(0,0,0,0.97)" },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {ITEMS.map((item) => {
          const active = activeScreen === item.screen;
          const activeColor = item.accent ?? colors.navActive;
          const dotColor = item.accent ?? colors.primary;
          return (
            <TouchableOpacity
              key={item.screen}
              style={styles.item}
              onPress={() => setActiveScreen(item.screen)}
            >
              {active && <View style={[styles.activeDot, { backgroundColor: dotColor }]} />}
              <Feather
                name={item.icon}
                size={15}
                color={active ? activeColor : colors.navInactive}
              />
              <Text style={[styles.label, { color: active ? activeColor : colors.navInactive }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  scrollContent: {
    flexDirection: "row",
    minWidth: "100%",
    justifyContent: "space-around",
  },
  item: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 3,
    paddingHorizontal: 10,
    gap: 2,
    position: "relative",
    minWidth: 50,
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

import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AIScreen from "@/components/AIScreen";
import BridgeScreen from "@/components/BridgeScreen";
import DuckyScreen from "@/components/DuckyScreen";
import FilesScreen from "@/components/FilesScreen";
import MatrixRain from "@/components/MatrixRain";
import NavBar from "@/components/NavBar";
import TerminalScreen from "@/components/TerminalScreen";
import ToolsScreen from "@/components/ToolsScreen";
import { useApp } from "@/context/AppContext";

export default function MainScreen() {
  const { activeScreen } = useApp();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <MatrixRain opacity={0.45} />
      <View style={styles.screenLayer}>
        {activeScreen === "terminal" && <TerminalScreen />}
        {activeScreen === "ai" && <AIScreen />}
        {activeScreen === "files" && <FilesScreen />}
        {activeScreen === "tools" && <ToolsScreen />}
        {activeScreen === "ducky" && <DuckyScreen />}
        {activeScreen === "bridge" && <BridgeScreen />}
      </View>
      <NavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  screenLayer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
  },
});

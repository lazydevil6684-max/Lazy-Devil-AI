import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size?: number;
  modificationTime?: number;
}

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentPath, setCurrentPath } = useApp();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setSelectedFile(null);
    setFileContent(null);
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists || !info.isDirectory) {
        setEntries([]);
        setLoading(false);
        return;
      }
      const names = await FileSystem.readDirectoryAsync(path);
      const detailed: FileEntry[] = await Promise.all(
        names.map(async (name) => {
          try {
            const fi = await FileSystem.getInfoAsync(`${path}/${name}`, {
              size: true,
            });
            return {
              name,
              isDirectory: fi.isDirectory ?? false,
              size: (fi as any).size ?? 0,
              modificationTime: (fi as any).modificationTime ?? 0,
            };
          } catch {
            return { name, isDirectory: false };
          }
        })
      );
      detailed.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory)
          return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(detailed);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDir(currentPath);
  }, [currentPath, loadDir]);

  const openEntry = async (entry: FileEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fullPath = `${currentPath}/${entry.name}`;
    if (entry.isDirectory) {
      setCurrentPath(fullPath);
    } else {
      setSelectedFile(entry.name);
      try {
        const content = await FileSystem.readAsStringAsync(fullPath);
        setFileContent(content);
      } catch {
        setFileContent("[Binary file or unreadable]");
      }
    }
  };

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + parts.join("/") || "/";
    setCurrentPath(newPath);
  };

  const deleteFile = (name: string) => {
    if (Platform.OS === "web") return;
    Alert.alert("Delete", `Delete ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(`${currentPath}/${name}`, {
              idempotent: true,
            });
            loadDir(currentPath);
          } catch {
            Alert.alert("Error", "Could not delete file");
          }
        },
      },
    ]);
  };

  const filtered = entries.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatSize = (bytes?: number) => {
    if (!bytes) return "0B";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`;
    return `${(bytes / 1048576).toFixed(1)}M`;
  };

  if (selectedFile && fileContent !== null) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={16} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}>BACK</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {selectedFile}
          </Text>
        </View>
        <FlatList
          data={fileContent.split("\n")}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.fileLine}>
              <Text style={[styles.lineNum, { color: colors.terminalDim }]}>
                {String(index + 1).padStart(4, " ")}
              </Text>
              <Text style={[styles.lineContent, { color: colors.foreground }]} selectable>
                {item}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goUp} style={styles.backBtn} disabled={currentPath === "/"}>
          <Feather
            name="arrow-up"
            size={16}
            color={currentPath === "/" ? colors.terminalDim : colors.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {currentPath}
        </Text>
        <TouchableOpacity onPress={() => loadDir(currentPath)} style={styles.backBtn}>
          <Feather name="refresh-cw" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <Feather name="search" size={13} color={colors.terminalDim} style={{ marginRight: 6 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          value={search}
          onChangeText={setSearch}
          placeholder="filter files..."
          placeholderTextColor={colors.terminalDim}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.terminalDim }]}>READING...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.terminalDim }]}>
            {entries.length === 0 ? "[ empty directory ]" : "[ no matches ]"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.entry, { borderBottomColor: colors.terminalGhost }]}
              onPress={() => openEntry(item)}
              onLongPress={() => deleteFile(item.name)}
            >
              <Feather
                name={item.isDirectory ? "folder" : "file-text"}
                size={14}
                color={item.isDirectory ? colors.primary : colors.terminalBody}
                style={{ marginRight: 10 }}
              />
              <Text
                style={[
                  styles.entryName,
                  { color: item.isDirectory ? colors.terminalHead : colors.foreground },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.entryMeta, { color: colors.terminalDim }]}>
                {item.isDirectory ? "DIR" : formatSize(item.size)}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        />
      )}

      <View
        style={[
          styles.statusBar,
          { borderTopColor: colors.border, paddingBottom: insets.bottom + 90 },
        ]}
      >
        <Text style={[styles.statusText, { color: colors.terminalDim }]}>
          {filtered.length} items · Long press to delete
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontFamily: "monospace", fontSize: 11, fontWeight: "bold" },
  headerTitle: { flex: 1, fontFamily: "monospace", fontSize: 11 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: "monospace", fontSize: 12, paddingVertical: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontFamily: "monospace", fontSize: 12 },
  loadingText: { fontFamily: "monospace", fontSize: 11 },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  entryName: { flex: 1, fontFamily: "monospace", fontSize: 13 },
  entryMeta: { fontFamily: "monospace", fontSize: 10 },
  statusBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    backgroundColor: "#000",
  },
  statusText: { fontFamily: "monospace", fontSize: 10 },
  fileLine: { flexDirection: "row", paddingHorizontal: 4, paddingVertical: 1 },
  lineNum: { fontFamily: "monospace", fontSize: 11, width: 36, marginRight: 8 },
  lineContent: { fontFamily: "monospace", fontSize: 11, flex: 1 },
});

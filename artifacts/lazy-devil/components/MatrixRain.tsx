import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

const CHAR_WIDTH = 13;
const CHAR_HEIGHT = 16;
const CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#$%^&*!<>?/~`|\\";
const TICK_MS = 70;

function randChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

interface DropColumn {
  chars: string[];
  head: number;
  speed: number;
  length: number;
}

interface MatrixRainProps {
  opacity?: number;
}

export default function MatrixRain({ opacity = 0.55 }: MatrixRainProps) {
  const { width, height } = useWindowDimensions();
  const numCols = Math.floor(width / CHAR_WIDTH);
  const numRows = Math.floor(height / CHAR_HEIGHT) + 2;

  const [columns, setColumns] = useState<DropColumn[]>(() =>
    Array.from({ length: numCols }, () => ({
      chars: Array.from({ length: numRows }, () => randChar()),
      head: Math.floor(Math.random() * numRows),
      speed: 0.5 + Math.random() * 1.5,
      length: 6 + Math.floor(Math.random() * 14),
    }))
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const colsRef = useRef(columns);
  colsRef.current = columns;

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setColumns((prev) =>
        prev.map((col) => {
          const newHead = col.head + col.speed;
          const wrappedHead = newHead > numRows + col.length ? -col.length : newHead;
          const newChars = [...col.chars];
          const headIdx = Math.floor(wrappedHead);
          if (headIdx >= 0 && headIdx < numRows) {
            newChars[headIdx] = randChar();
          }
          return { ...col, head: wrappedHead, chars: newChars };
        })
      );
    }, TICK_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [numRows]);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity, flexDirection: "row" }]} pointerEvents="none">
      {columns.map((col, ci) => (
        <View key={ci} style={{ width: CHAR_WIDTH, flexDirection: "column" }}>
          {col.chars.map((ch, ri) => {
            const dist = Math.floor(col.head) - ri;
            let color: string;
            let fontWeight: "bold" | "normal" = "normal";
            if (dist === 0) {
              color = "#ff6666";
              fontWeight = "bold";
            } else if (dist === 1) {
              color = "#ff3333";
            } else if (dist <= 3) {
              color = "#cc0000";
            } else if (dist <= 6) {
              color = "#880000";
            } else if (dist <= col.length) {
              color = "#440000";
            } else {
              color = "transparent";
            }
            return (
              <Text
                key={ri}
                style={{
                  color,
                  fontSize: 12,
                  fontFamily: "monospace",
                  height: CHAR_HEIGHT,
                  lineHeight: CHAR_HEIGHT,
                  fontWeight,
                }}
              >
                {color === "transparent" ? " " : ch}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * JS interface for the native RootExecModule (Android only).
 * On iOS/web, all calls return a graceful fallback message.
 */
import { NativeModules, Platform } from "react-native";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  elapsed: number;
  command: string;
}

const { RootExec: NativeRootExec } = NativeModules;
const isSupported = Platform.OS === "android" && !!NativeRootExec;

export async function isRooted(): Promise<boolean> {
  if (!isSupported) return false;
  try { return await NativeRootExec.isRooted(); }
  catch { return false; }
}

export async function execute(command: string): Promise<ExecResult> {
  if (!isSupported) {
    return { stdout: "", stderr: "[!] Native exec only available on Android APK", exitCode: 1, elapsed: 0, command };
  }
  try { return await NativeRootExec.execute(command); }
  catch (e: any) { return { stdout: "", stderr: e?.message ?? "Native exec failed", exitCode: 1, elapsed: 0, command }; }
}

export async function executeAsRoot(command: string): Promise<ExecResult> {
  if (!isSupported) {
    return { stdout: "", stderr: "[!] Root exec only available on Android APK with Magisk", exitCode: 1, elapsed: 0, command };
  }
  try { return await NativeRootExec.executeAsRoot(command); }
  catch (e: any) { return { stdout: "", stderr: e?.message ?? "Root exec failed", exitCode: 1, elapsed: 0, command }; }
}

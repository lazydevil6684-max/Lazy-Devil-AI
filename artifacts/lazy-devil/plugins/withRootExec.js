/**
 * Expo Config Plugin — injects native Magisk root execution module
 * Adds RootExecModule.kt (execute shell commands via `su`) and registers it
 * with the React Native bridge so JS can call NativeModules.RootExec.
 */
const { withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const ROOT_EXEC_MODULE_KT = `package expo.modules.rootexec

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import java.io.DataOutputStream

class RootExecModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RootExec"

    @ReactMethod
    fun isRooted(promise: Promise) {
        try {
            val process = Runtime.getRuntime().exec(arrayOf("su", "-c", "id"))
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()
            promise.resolve(output.contains("uid=0"))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun execute(command: String, promise: Promise) {
        runShell(command, asRoot = false, promise)
    }

    @ReactMethod
    fun executeAsRoot(command: String, promise: Promise) {
        runShell(command, asRoot = true, promise)
    }

    private fun runShell(command: String, asRoot: Boolean, promise: Promise) {
        Thread {
            try {
                val result = WritableNativeMap()
                val startMs = System.currentTimeMillis()
                val process: Process

                if (asRoot) {
                    process = Runtime.getRuntime().exec("su")
                    val os = DataOutputStream(process.outputStream)
                    os.writeBytes(command + "\\n")
                    os.writeBytes("exit\\n")
                    os.flush()
                    os.close()
                } else {
                    process = Runtime.getRuntime().exec(arrayOf("/system/bin/sh", "-c", command))
                }

                val stdout = process.inputStream.bufferedReader().readText()
                val stderr = process.errorStream.bufferedReader().readText()
                val exitCode = process.waitFor()

                result.putString("stdout", stdout.take(50000))
                result.putString("stderr", stderr.take(5000))
                result.putInt("exitCode", exitCode)
                result.putInt("elapsed", (System.currentTimeMillis() - startMs).toInt())
                result.putString("command", command)
                promise.resolve(result)
            } catch (e: Exception) {
                val result = WritableNativeMap()
                result.putString("stdout", "")
                result.putString("stderr", e.message ?: "Unknown error")
                result.putInt("exitCode", -1)
                result.putInt("elapsed", 0)
                result.putString("command", command)
                promise.resolve(result)
            }
        }.start()
    }
}
`;

const ROOT_EXEC_PACKAGE_KT = `package expo.modules.rootexec

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RootExecPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(RootExecModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

function withRootExecKotlin(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const androidRoot = path.join(
        config.modRequest.platformProjectRoot,
        "app", "src", "main", "java", "expo", "modules", "rootexec"
      );
      fs.mkdirSync(androidRoot, { recursive: true });
      fs.writeFileSync(path.join(androidRoot, "RootExecModule.kt"), ROOT_EXEC_MODULE_KT);
      fs.writeFileSync(path.join(androidRoot, "RootExecPackage.kt"), ROOT_EXEC_PACKAGE_KT);
      return config;
    },
  ]);
}

function withRootExecMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Add import
    if (!contents.includes("import expo.modules.rootexec.RootExecPackage")) {
      contents = contents.replace(
        /import com\.facebook\.react\.ReactApplication/,
        "import expo.modules.rootexec.RootExecPackage\nimport com.facebook.react.ReactApplication"
      );
    }

    // Add package to list
    if (!contents.includes("RootExecPackage()")) {
      contents = contents.replace(
        /packages\.add\(new PackageList\(this\)\.getPackages\(\)\)/,
        'packages.addAll(PackageList(this).packages)\n            packages.add(RootExecPackage())'
      );
      // Kotlin version
      contents = contents.replace(
        /packages\.addAll\(PackageList\(this\)\.packages\)/,
        "packages.addAll(PackageList(this).packages)\n            packages.add(RootExecPackage())"
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withRootExec(config) {
  config = withRootExecKotlin(config);
  config = withRootExecMainApplication(config);
  return config;
};

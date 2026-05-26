/**
 * Expo Config Plugin — adds all Android permissions needed for Lazy Devil Terminal
 * Network, storage, camera, microphone, Bluetooth, location, SMS, contacts, etc.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const PERMISSIONS = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.ACCESS_WIFI_STATE",
  "android.permission.CHANGE_WIFI_STATE",
  "android.permission.CHANGE_WIFI_MULTICAST_STATE",
  "android.permission.CHANGE_NETWORK_STATE",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.MANAGE_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.BLUETOOTH",
  "android.permission.BLUETOOTH_ADMIN",
  "android.permission.BLUETOOTH_SCAN",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.BLUETOOTH_ADVERTISE",
  "android.permission.READ_CONTACTS",
  "android.permission.READ_SMS",
  "android.permission.SEND_SMS",
  "android.permission.RECEIVE_SMS",
  "android.permission.READ_CALL_LOG",
  "android.permission.CALL_PHONE",
  "android.permission.VIBRATE",
  "android.permission.FLASHLIGHT",
  "android.permission.USE_FINGERPRINT",
  "android.permission.USE_BIOMETRIC",
  "android.permission.READ_PHONE_STATE",
  "android.permission.NFC",
  "android.permission.TRANSMIT_IR",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.WAKE_LOCK",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.REQUEST_INSTALL_PACKAGES",
];

module.exports = function withAndroidPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const existing = (manifest["uses-permission"] || []).map(
      (p) => p.$?.["android:name"]
    );

    for (const perm of PERMISSIONS) {
      if (!existing.includes(perm)) {
        manifest["uses-permission"] = manifest["uses-permission"] || [];
        manifest["uses-permission"].push({ $: { "android:name": perm } });
      }
    }

    // Add uses-feature for hardware
    manifest["uses-feature"] = [
      ...(manifest["uses-feature"] || []),
      { $: { "android:name": "android.hardware.camera", "android:required": "false" } },
      { $: { "android:name": "android.hardware.camera.autofocus", "android:required": "false" } },
      { $: { "android:name": "android.hardware.bluetooth", "android:required": "false" } },
      { $: { "android:name": "android.hardware.bluetooth_le", "android:required": "false" } },
      { $: { "android:name": "android.hardware.nfc", "android:required": "false" } },
      { $: { "android:name": "android.hardware.location.gps", "android:required": "false" } },
    ];

    // Allow cleartext traffic (for Termux bridge on local network)
    const app = manifest.application?.[0];
    if (app) {
      app.$ = { ...app.$, "android:usesCleartextTraffic": "true", "android:requestLegacyExternalStorage": "true" };
    }

    return config;
  });
};

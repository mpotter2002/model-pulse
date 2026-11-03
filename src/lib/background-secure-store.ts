import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Background checks must read consent, credentials and preferences while the
// phone is locked. Keychain data remains protected until the first unlock
// after a reboot; Expo's default WHEN_UNLOCKED prevents these checks.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  // Expo updates only the value of an existing item, not its accessibility.
  // A separate service creates new items with the correct protection class.
  keychainService: "modelpulse-background-v1",
};
const queues = new Map<string, Promise<unknown>>();

function withKey<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const result = (queues.get(key) ?? Promise.resolve()).then(operation);
  const tail = result.catch(() => undefined);
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return result;
}

async function removeLegacyItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn("[ModelPulse] legacy Keychain cleanup failed", error);
  }
}

export function getItemAsync(key: string): Promise<string | null> {
  return withKey(key, async () => {
    if (Platform.OS !== "ios") return SecureStore.getItemAsync(key);
    const current = await SecureStore.getItemAsync(key, options);
    if (current !== null) return current;
    const legacy = await SecureStore.getItemAsync(key);
    if (legacy !== null) {
      // Copy successfully before removing the old item; on failure the legacy
      // value remains readable and migration retries the next time.
      try {
        await SecureStore.setItemAsync(key, legacy, options);
        await removeLegacyItem(key);
      } catch (error) {
        console.warn("[ModelPulse] background Keychain migration failed", error);
      }
    }
    return legacy;
  });
}

export function setItemAsync(key: string, value: string): Promise<void> {
  return withKey(key, async () => {
    if (Platform.OS !== "ios") return SecureStore.setItemAsync(key, value);
    await SecureStore.setItemAsync(key, value, options);
    await removeLegacyItem(key);
  });
}

export function deleteItemAsync(key: string): Promise<void> {
  return withKey(key, async () => {
    if (Platform.OS === "ios") await SecureStore.deleteItemAsync(key, options);
    await SecureStore.deleteItemAsync(key);
  });
}

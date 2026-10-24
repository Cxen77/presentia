import AsyncStorage from "@react-native-async-storage/async-storage";
export const WELCOME_SEEN_KEY = "presentia_welcome_seen_v1";
export async function markWelcomeSeen() {
  try {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* Storage preferences must not block real authentication. */
  }
}
export async function getUnauthenticatedEntry(): Promise<
  "onboarding" | "login"
> {
  try {
    if (await AsyncStorage.getItem(WELCOME_SEEN_KEY)) return "login";
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, "1");
    return "onboarding";
  } catch {
    return "login";
  }
}

import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "./locale";

export async function getLocale() {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}

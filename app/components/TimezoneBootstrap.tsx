"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TimezoneBootstrap({ refreshAfterSave = false }: { refreshAfterSave?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    const controller = new AbortController();
    async function configure() {
      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const profile = await response.json();
        if (profile.configured) return;
        const update = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone }),
          signal: controller.signal,
        });
        if (update.ok && refreshAfterSave) router.refresh();
      } catch {
        // 时区自动配置失败不影响主流程，用户仍可在设置页手动保存。
      }
    }
    void configure();
    return () => controller.abort();
  }, [refreshAfterSave, router]);

  return null;
}

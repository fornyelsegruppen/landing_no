"use client";

import { RefreshRouteOnSave } from "@payloadcms/live-preview-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LivePreviewRefresh() {
  const router = useRouter();
  const [serverURL, setServerURL] = useState<string>();

  useEffect(() => {
    const timer = window.setTimeout(() => setServerURL(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!serverURL) return null;

  return <RefreshRouteOnSave refresh={router.refresh} serverURL={serverURL} />;
}

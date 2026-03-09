import { useContext, useEffect, useMemo } from "react";
import { MetadataContext } from "@/components/metadataContext";
import type { PageMetadata } from "@/lib/metadata";

export function usePageMetadata(metadata: PageMetadata | null) {
  const context = useContext(MetadataContext);

  if (!context) {
    throw new Error("usePageMetadata must be used inside MetadataProvider");
  }

  const metadataKey = metadata ? JSON.stringify(metadata) : "";
  const stableMetadata = useMemo<PageMetadata | null>(() => {
    if (!metadataKey) return null;
    return JSON.parse(metadataKey) as PageMetadata;
  }, [metadataKey]);

  useEffect(() => {
    context.setPageMetadata(stableMetadata);

    return () => {
      context.setPageMetadata(null);
    };
  }, [context, stableMetadata]);
}

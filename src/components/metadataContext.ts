import { createContext } from "react";
import type { PageMetadata } from "@/lib/metadata";

export type MetadataContextValue = {
  setPageMetadata: (metadata: PageMetadata | null) => void;
};

export const MetadataContext = createContext<MetadataContextValue | null>(null);

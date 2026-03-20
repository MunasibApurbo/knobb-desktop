import { createContext, useContext } from "react";

export interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  expandPanel: () => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  expandPanel: () => {},
});

export function useSidebarCollapsed() {
  return useContext(SidebarContext);
}

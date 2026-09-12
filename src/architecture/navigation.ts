export type ExplorerTab =
  | "map"
  | "tour"
  | "experiences"
  | "voice"
  | "data"
  | "latency";

const EXPLORER_TABS: ExplorerTab[] = [
  "map",
  "tour",
  "experiences",
  "voice",
  "data",
  "latency",
];

export function getKeyboardTab(
  currentTab: ExplorerTab,
  key: string,
): ExplorerTab {
  if (key === "Home") return EXPLORER_TABS[0];
  if (key === "End") return EXPLORER_TABS[EXPLORER_TABS.length - 1];
  if (key !== "ArrowLeft" && key !== "ArrowRight") return currentTab;

  const direction = key === "ArrowRight" ? 1 : -1;
  const currentIndex = EXPLORER_TABS.indexOf(currentTab);
  const nextIndex =
    (currentIndex + direction + EXPLORER_TABS.length) % EXPLORER_TABS.length;
  return EXPLORER_TABS[nextIndex];
}

export interface ExplorerState {
  tab: ExplorerTab;
  selectedNodeId: string | null;
  tourIndex: number;
}

type TourAction = {
  nodeIds: string[];
};

export type ExplorerAction =
  | { type: "select-tab"; tab: ExplorerTab }
  | { type: "select-node"; nodeId: string }
  | ({ type: "select-tour" } & TourAction)
  | ({ type: "next-tour-step" } & TourAction)
  | ({ type: "previous-tour-step" } & TourAction);

export const initialExplorerState: ExplorerState = {
  tab: "map",
  selectedNodeId: null,
  tourIndex: 0,
};

export function reduceExplorerState(
  state: ExplorerState,
  action: ExplorerAction,
): ExplorerState {
  switch (action.type) {
    case "select-tab":
      return { tab: action.tab, selectedNodeId: null, tourIndex: 0 };
    case "select-node":
      return { ...state, selectedNodeId: action.nodeId };
    case "select-tour":
      return {
        tab: "tour",
        selectedNodeId: action.nodeIds[0] ?? null,
        tourIndex: 0,
      };
    case "next-tour-step": {
      const maxIndex = Math.max(action.nodeIds.length - 1, 0);
      const tourIndex = Math.min(Math.max(state.tourIndex + 1, 0), maxIndex);
      return {
        ...state,
        selectedNodeId: action.nodeIds[tourIndex] ?? null,
        tourIndex,
      };
    }
    case "previous-tour-step": {
      const maxIndex = Math.max(action.nodeIds.length - 1, 0);
      const tourIndex = Math.min(Math.max(state.tourIndex - 1, 0), maxIndex);
      return {
        ...state,
        selectedNodeId: action.nodeIds[tourIndex] ?? null,
        tourIndex,
      };
    }
  }
}

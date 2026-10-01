"use client";

import { create } from "zustand";

interface SupervisorUiState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  setPendingCount: (pendingCount: number) => void;
}

export const useSupervisorUiStore = create<SupervisorUiState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));

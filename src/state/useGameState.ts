import { useCallback, useEffect, useState } from 'react';
import { iles } from '../data/iles';
import { missionsInitiales } from '../data/missions';
import type { Mission } from '../types';

const STORAGE_KEY = 'log-pose-state';

interface GameState {
  prime: number;
  currentIslandId: number;
  logPose: Record<number, number>;
  missions: Mission[];
}

const defaultState: GameState = {
  prime: 0,
  currentIslandId: iles[0].id,
  logPose: {},
  missions: missionsInitiales,
};

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      prime: typeof parsed.prime === 'number' ? parsed.prime : defaultState.prime,
      currentIslandId:
        typeof parsed.currentIslandId === 'number'
          ? parsed.currentIslandId
          : defaultState.currentIslandId,
      logPose: parsed.logPose ?? defaultState.logPose,
      missions: parsed.missions ?? defaultState.missions,
    };
  } catch {
    return defaultState;
  }
}

export function useGameState() {
  const [state, setState] = useState<GameState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const ajouterGain = useCallback((montant: number) => {
    if (!Number.isFinite(montant) || montant <= 0) return;
    setState((prev) => ({ ...prev, prime: prev.prime + montant }));
  }, []);

  const validerMission = useCallback((id: string) => {
    setState((prev) => {
      const mission = prev.missions.find((m) => m.id === id);
      if (!mission || mission.statut === 'done') return prev;

      const missions = prev.missions.map((m) =>
        m.id === id ? { ...m, statut: 'done' as const } : m,
      );

      let logPose = prev.logPose;
      let currentIslandId = prev.currentIslandId;

      if (mission.questWeight > 0) {
        const current = prev.logPose[prev.currentIslandId] ?? 0;
        const next = Math.min(100, current + mission.questWeight);
        logPose = { ...prev.logPose, [prev.currentIslandId]: next };

        if (next >= 100) {
          const idx = iles.findIndex((i) => i.id === prev.currentIslandId);
          const nextIle = iles[idx + 1];
          if (nextIle) {
            currentIslandId = nextIle.id;
          }
        }
      }

      return { ...prev, missions, logPose, currentIslandId };
    });
  }, []);

  const echouerMission = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      missions: prev.missions.map((m) =>
        m.id === id ? { ...m, statut: 'failed' as const } : m,
      ),
    }));
  }, []);

  const bounty = state.prime * 1000;
  const currentIle = iles.find((i) => i.id === state.currentIslandId) ?? iles[0];
  const logPoseActuel = state.logPose[state.currentIslandId] ?? 0;

  return {
    prime: state.prime,
    bounty,
    currentIle,
    totalIles: iles.length,
    logPose: logPoseActuel,
    missions: state.missions,
    ajouterGain,
    validerMission,
    echouerMission,
  };
}

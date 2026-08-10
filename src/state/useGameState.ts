import { useCallback, useEffect, useState } from 'react';
import { iles } from '../data/iles';
import { missionsInitiales } from '../data/missions';
import type { BlocPlanning, JourSemaine, Mission } from '../types';

const STORAGE_KEY = 'log-pose-state';

const TOUS_LES_JOURS: JourSemaine[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

function heure(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

const blocsPlanningInitiaux: BlocPlanning[] = missionsInitiales.map((m, i) => ({
  id: m.id,
  titre: m.texte,
  heureDebut: heure(8 + i),
  heureFin: heure(9 + i),
  jours: TOUS_LES_JOURS,
  questWeight: m.questWeight,
}));

interface GameState {
  prime: number;
  currentIslandId: number;
  logPose: Record<number, number>;
  missions: Mission[];
  blocsPlanning: BlocPlanning[];
}

const defaultState: GameState = {
  prime: 0,
  currentIslandId: iles[0].id,
  logPose: {},
  missions: missionsInitiales,
  blocsPlanning: blocsPlanningInitiaux,
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
      blocsPlanning: parsed.blocsPlanning ?? defaultState.blocsPlanning,
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

  const ajouterBloc = useCallback((bloc: Omit<BlocPlanning, 'id'>) => {
    setState((prev) => ({
      ...prev,
      blocsPlanning: [...prev.blocsPlanning, { ...bloc, id: crypto.randomUUID() }],
    }));
  }, []);

  const modifierBloc = useCallback((id: string, patch: Omit<BlocPlanning, 'id'>) => {
    setState((prev) => ({
      ...prev,
      blocsPlanning: prev.blocsPlanning.map((b) => (b.id === id ? { ...patch, id } : b)),
    }));
  }, []);

  const supprimerBloc = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      blocsPlanning: prev.blocsPlanning.filter((b) => b.id !== id),
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
    blocsPlanning: state.blocsPlanning,
    ajouterGain,
    validerMission,
    echouerMission,
    ajouterBloc,
    modifierBloc,
    supprimerBloc,
  };
}

// État du budget, persisté dans le localStorage.
// Deux morceaux : le salaire mensuel et la liste des postes de répartition
// (saisie manuelle par Louis). Indépendant du reste du jeu, comme useHabitudes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PosteBudget } from '../types';

const STORAGE_KEY = 'log-pose-budget';

interface BudgetState {
  salaire: number;
  postes: PosteBudget[];
}

const defaultState: BudgetState = { salaire: 0, postes: [] };

function nombreSain(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function loadState(): BudgetState {
  try {
    const brut = localStorage.getItem(STORAGE_KEY);
    if (!brut) return defaultState;
    const parsed = JSON.parse(brut) as Partial<BudgetState>;
    const postes = Array.isArray(parsed.postes)
      ? parsed.postes
          .filter((p): p is PosteBudget => typeof p?.id === 'string')
          .map((p): PosteBudget => ({
            id: p.id,
            nom: typeof p.nom === 'string' ? p.nom : '',
            montant: nombreSain(p.montant),
          }))
      : [];
    return { salaire: nombreSain(parsed.salaire), postes };
  } catch {
    return defaultState;
  }
}

export function useBudget() {
  const [state, setState] = useState<BudgetState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota : tant pis */
    }
  }, [state]);

  const definirSalaire = useCallback((salaire: number) => {
    setState((prev) => ({ ...prev, salaire: nombreSain(salaire) }));
  }, []);

  const ajouterPoste = useCallback((nom = '', montant = 0): string => {
    const id = crypto.randomUUID();
    setState((prev) => ({
      ...prev,
      postes: [...prev.postes, { id, nom, montant: nombreSain(montant) }],
    }));
    return id;
  }, []);

  const modifierPoste = useCallback(
    (id: string, patch: Partial<Omit<PosteBudget, 'id'>>) => {
      setState((prev) => ({
        ...prev,
        postes: prev.postes.map((p) =>
          p.id === id
            ? {
                ...p,
                ...patch,
                montant: patch.montant != null ? nombreSain(patch.montant) : p.montant,
              }
            : p,
        ),
      }));
    },
    [],
  );

  const supprimerPoste = useCallback((id: string) => {
    setState((prev) => ({ ...prev, postes: prev.postes.filter((p) => p.id !== id) }));
  }, []);

  const totalReparti = useMemo(
    () => state.postes.reduce((somme, p) => somme + p.montant, 0),
    [state.postes],
  );

  return {
    salaire: state.salaire,
    postes: state.postes,
    totalReparti,
    restant: state.salaire - totalReparti,
    definirSalaire,
    ajouterPoste,
    modifierPoste,
    supprimerPoste,
  };
}

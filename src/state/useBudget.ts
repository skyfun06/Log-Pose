// État du budget, persisté dans le localStorage.
// Le salaire mensuel, sa source (saisi à la main ou lu sur une fiche de paie
// du second cerveau) et la liste des postes de répartition.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PosteBudget, SourceSalaire } from '../types';

const STORAGE_KEY = 'log-pose-budget';

interface BudgetState {
  salaire: number;
  // Par défaut, le salaire suit la dernière fiche de paie rangée dans le
  // second cerveau ; le salaire gardé ici sert quand le serveur est éteint.
  source: SourceSalaire;
  postes: PosteBudget[];
}

const SOURCE_PAR_DEFAUT: SourceSalaire = { mode: 'fiche', mois: null };

const defaultState: BudgetState = { salaire: 0, source: SOURCE_PAR_DEFAUT, postes: [] };

function sourceSaine(source: unknown): SourceSalaire {
  const s = source as Partial<{ mode: string; mois: unknown }> | null;
  if (s?.mode === 'manuel') return { mode: 'manuel' };
  if (s?.mode === 'fiche') {
    return { mode: 'fiche', mois: typeof s.mois === 'string' && /^\d{4}-\d{2}$/.test(s.mois) ? s.mois : null };
  }
  return SOURCE_PAR_DEFAUT;
}

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
    return { salaire: nombreSain(parsed.salaire), source: sourceSaine(parsed.source), postes };
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

  // Saisie à la main : le salaire ne suit plus les fiches de paie.
  const definirSalaire = useCallback((salaire: number) => {
    setState((prev) => ({ ...prev, salaire: nombreSain(salaire), source: { mode: 'manuel' } }));
  }, []);

  // Le salaire suit les fiches de paie d'un mois (null = le plus récent).
  const lierMois = useCallback((mois: string | null) => {
    setState((prev) => ({ ...prev, source: { mode: 'fiche', mois } }));
  }, []);

  // Recopie le total des fiches suivies (sans changer la source).
  const synchroniserSalaire = useCallback((montant: number) => {
    setState((prev) =>
      prev.source.mode !== 'fiche' || prev.salaire === nombreSain(montant)
        ? prev
        : { ...prev, salaire: nombreSain(montant) },
    );
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
    source: state.source,
    postes: state.postes,
    totalReparti,
    restant: state.salaire - totalReparti,
    definirSalaire,
    lierMois,
    synchroniserSalaire,
    ajouterPoste,
    modifierPoste,
    supprimerPoste,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { iles } from '../data/iles';
import { indexPalier } from '../data/paliers';
import { PROGRAMME_CONSEILLE, VERSION_PROGRAMME } from '../data/programme';
import type {
  BlocPlanning,
  Difficulte,
  Etape,
  Gain,
  Ile,
  JourSemaine,
  Mission,
  StatutMission,
} from '../types';

const STORAGE_KEY = 'log-pose-state';

const JOUR_INDEX: JourSemaine[] = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function jourSemaineActuel(): JourSemaine {
  return JOUR_INDEX[new Date().getDay()];
}

function dateDuJour(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Avant de remplacer l'emploi du temps par le programme conseillé, l'ancien
// est mis de côté ici (on peut le restaurer à la main au besoin).
// Remise à zéro de la prime demandée par Louis : augmenter ce numéro vide le
// registre des gains une fois, au prochain chargement (les butins promis et le
// reste de l'état sont gardés).
const VERSION_REMISE_PRIME = 3;

const CLE_SAUVEGARDE_PLANNING = 'log-pose-planning-avant-programme';

interface GameState {
  // Registre des gains : la prime en est la somme (on peut annuler un gain).
  gains: Gain[];
  // Dernier palier dont la cérémonie a été vue : tant qu'il est en retard sur
  // le palier atteint, la cérémonie s'affiche (même après rechargement).
  palierCelebre: number;
  // Date (ISO) à laquelle chaque palier a été atteint.
  atteintLe: Record<number, string>;
  // Récompense réelle que Louis se promet pour chaque palier.
  butins: Record<number, string>;
  versionRemisePrime?: number;
  currentIslandId: number;
  logPose: Record<number, number>;
  // Îles conquises sur la carte : id → date (ISO) de la conquête.
  ilesConquises: Record<number, string>;
  // Étapes de la quête de chaque île (objectifs à cocher).
  etapes: Record<number, Etape[]>;
  blocsPlanning: BlocPlanning[];
  statutsMissions: Record<string, StatutMission>;
  dateStatuts: string;
  // Version du programme conseillé déjà appliquée (voir data/programme.ts).
  versionProgramme?: number;
}

const defaultState: GameState = {
  gains: [],
  palierCelebre: 0,
  atteintLe: {},
  butins: {},
  versionRemisePrime: VERSION_REMISE_PRIME,
  currentIslandId: iles[0].id,
  logPose: {},
  ilesConquises: {},
  etapes: etapesCompletes({}),
  blocsPlanning: PROGRAMME_CONSEILLE,
  statutsMissions: {},
  dateStatuts: dateDuJour(),
  versionProgramme: VERSION_PROGRAMME,
};

// Applique une fois le programme conseillé (nouvelle version) en sauvegardant
// l'ancien emploi du temps ; sinon garde celui de Louis tel quel.
function programmeAJour(parsed: Partial<GameState>): BlocPlanning[] {
  const actuel = parsed.blocsPlanning ?? PROGRAMME_CONSEILLE;
  if ((parsed.versionProgramme ?? 0) >= VERSION_PROGRAMME) return actuel;
  try {
    localStorage.setItem(CLE_SAUVEGARDE_PLANNING, JSON.stringify(actuel));
  } catch {
    /* sauvegarde impossible : on applique quand même le programme */
  }
  return PROGRAMME_CONSEILLE;
}

// Une île sans étapes réglées reçoit les étapes suggérées (une seule fois :
// elles sont ensuite enregistrées et modifiables).
function etapesSuggerees(ile: Ile): Etape[] {
  const maintenant = new Date().toISOString();
  return ile.etapesSuggerees.map((e, i) => ({
    id: `sugg-${ile.id}-${i}`,
    texte: e.texte,
    difficulte: e.difficulte,
    creeLe: maintenant,
  }));
}

function etapesCompletes(etapes: Record<number, Etape[]>): Record<number, Etape[]> {
  const complet = { ...etapes };
  for (const ile of iles)
    if (!Array.isArray(complet[ile.id])) complet[ile.id] = etapesSuggerees(ile);
  return complet;
}

// Toutes les étapes de l'île visée sont faites : l'île est conquise et le
// navire met le cap sur la suivante.
function avecConquete(etat: GameState): GameState {
  const id = etat.currentIslandId;
  const liste = etat.etapes[id] ?? [];
  if (etat.ilesConquises[id] || liste.length === 0 || liste.some((e) => !e.faiteLe)) return etat;
  const idx = iles.findIndex((i) => i.id === id);
  const suivante = iles[idx + 1];
  return {
    ...etat,
    ilesConquises: { ...etat.ilesConquises, [id]: new Date().toISOString() },
    currentIslandId: suivante ? suivante.id : id,
  };
}

// Avancement vers l'île visée : part (pondérée par la difficulté) des étapes
// faites.
export function avancementEtapes(liste: Etape[]): number {
  const total = liste.reduce((t, e) => t + e.difficulte, 0);
  if (total === 0) return 0;
  return liste.reduce((t, e) => t + (e.faiteLe ? e.difficulte : 0), 0) / total;
}

export interface ResultatEtape {
  faite: boolean; // l'étape vient d'être cochée (et non décochée)
  difficulte: Difficulte;
  conquise: Ile | null; // île conquise par ce coup
}

function somme(gains: Gain[]): number {
  return Math.round(gains.reduce((total, g) => total + g.montant, 0) * 100) / 100;
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // L'ancien compteur « prime » (sans registre) est abandonné : passer au
    // registre des gains repart de 0 €.
    const remise = (parsed.versionRemisePrime ?? 0) < VERSION_REMISE_PRIME;
    const gains = Array.isArray(parsed.gains) && !remise ? parsed.gains : defaultState.gains;
    return {
      gains,
      palierCelebre: Math.min(parsed.palierCelebre ?? 0, indexPalier(somme(gains))),
      atteintLe: remise ? {} : (parsed.atteintLe ?? defaultState.atteintLe),
      versionRemisePrime: VERSION_REMISE_PRIME,
      butins: parsed.butins ?? defaultState.butins,
      currentIslandId:
        typeof parsed.currentIslandId === 'number'
          ? parsed.currentIslandId
          : defaultState.currentIslandId,
      logPose: parsed.logPose ?? defaultState.logPose,
      ilesConquises: parsed.ilesConquises ?? defaultState.ilesConquises,
      etapes: etapesCompletes(parsed.etapes ?? {}),
      blocsPlanning: programmeAJour(parsed),
      statutsMissions: parsed.statutsMissions ?? defaultState.statutsMissions,
      dateStatuts: parsed.dateStatuts ?? defaultState.dateStatuts,
      versionProgramme: VERSION_PROGRAMME,
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

  useEffect(() => {
    const today = dateDuJour();
    if (state.dateStatuts !== today) {
      setState((prev) => ({ ...prev, statutsMissions: {}, dateStatuts: today }));
    }
  }, [state.dateStatuts]);

  const missions = useMemo<Mission[]>(() => {
    const jour = jourSemaineActuel();
    return state.blocsPlanning
      .filter((b) => b.jours.includes(jour))
      .slice()
      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
      .map((b) => ({
        id: b.id,
        texte: b.titre,
        questWeight: b.questWeight,
        statut: state.statutsMissions[b.id] ?? 'pending',
      }));
  }, [state.blocsPlanning, state.statutsMissions]);

  const ajouterGain = useCallback((montant: number, note?: string) => {
    if (!Number.isFinite(montant) || montant <= 0) return;
    setState((prev) => {
      const date = new Date().toISOString();
      const gain: Gain = { id: crypto.randomUUID(), montant, date, ...(note ? { note } : {}) };
      const gains = [...prev.gains, gain];
      // Date d'atteinte des paliers franchis par ce gain.
      const avant = indexPalier(somme(prev.gains));
      const apres = indexPalier(somme(gains));
      const atteintLe = { ...prev.atteintLe };
      for (let i = avant + 1; i <= apres; i++) atteintLe[i] ??= date;
      return { ...prev, gains, atteintLe };
    });
  }, []);

  // Annuler un gain (erreur de saisie) : si la prime retombe sous un palier,
  // celui-ci redevient à conquérir (et sa cérémonie rejouera).
  const supprimerGain = useCallback((id: string) => {
    setState((prev) => {
      const gains = prev.gains.filter((g) => g.id !== id);
      const index = indexPalier(somme(gains));
      const atteintLe = Object.fromEntries(
        Object.entries(prev.atteintLe).filter(([i]) => Number(i) <= index),
      );
      return { ...prev, gains, atteintLe, palierCelebre: Math.min(prev.palierCelebre, index) };
    });
  }, []);

  // Repartir de 0 € (les butins promis sont gardés).
  const remettrePrimeAZero = useCallback(() => {
    setState((prev) => ({ ...prev, gains: [], atteintLe: {}, palierCelebre: 0 }));
  }, []);

  // Miroir de l'état pour connaître le résultat d'une action avant le rendu.
  const etatRef = useRef(state);
  etatRef.current = state;

  // Coche ou décoche une étape de l'île visée ; la dernière étape cochée
  // conquiert l'île.
  const basculerEtape = useCallback((ileId: number, etapeId: string): ResultatEtape | null => {
    const prev = etatRef.current;
    if (ileId !== prev.currentIslandId || prev.ilesConquises[ileId]) return null;
    const etape = (prev.etapes[ileId] ?? []).find((e) => e.id === etapeId);
    if (!etape) return null;
    const faite = !etape.faiteLe;
    const liste = (prev.etapes[ileId] ?? []).map((e) =>
      e.id === etapeId ? { ...e, faiteLe: faite ? new Date().toISOString() : undefined } : e,
    );
    const suivant = avecConquete({ ...prev, etapes: { ...prev.etapes, [ileId]: liste } });
    etatRef.current = suivant;
    setState(suivant);
    return {
      faite,
      difficulte: etape.difficulte,
      conquise: suivant.ilesConquises[ileId] ? (iles.find((i) => i.id === ileId) ?? null) : null,
    };
  }, []);

  const ajouterEtape = useCallback((ileId: number, texte: string, difficulte: Difficulte) => {
    if (!texte.trim()) return;
    setState((prev) => {
      const etape: Etape = {
        id: crypto.randomUUID(),
        texte: texte.trim(),
        difficulte,
        creeLe: new Date().toISOString(),
      };
      return {
        ...prev,
        etapes: { ...prev.etapes, [ileId]: [...(prev.etapes[ileId] ?? []), etape] },
      };
    });
  }, []);

  const modifierEtape = useCallback(
    (ileId: number, etapeId: string, patch: { texte?: string; difficulte?: Difficulte }) => {
      setState((prev) => ({
        ...prev,
        etapes: {
          ...prev.etapes,
          [ileId]: (prev.etapes[ileId] ?? []).map((e) =>
            e.id === etapeId ? { ...e, ...patch, texte: patch.texte?.trim() || e.texte } : e,
          ),
        },
      }));
    },
    [],
  );

  const supprimerEtape = useCallback((ileId: number, etapeId: string) => {
    setState((prev) =>
      avecConquete({
        ...prev,
        etapes: {
          ...prev.etapes,
          [ileId]: (prev.etapes[ileId] ?? []).filter((e) => e.id !== etapeId),
        },
      }),
    );
  }, []);

  // Annule la dernière conquête : le navire repart vers cette île, dont la
  // dernière étape cochée redevient à faire.
  const revenirIle = useCallback(() => {
    setState((prev) => {
      const idx = iles.findIndex((i) => i.id === prev.currentIslandId);
      const actuelleConquise = prev.ilesConquises[prev.currentIslandId] !== undefined;
      const cible = actuelleConquise ? iles[idx] : iles[idx - 1];
      if (!cible || !prev.ilesConquises[cible.id]) return prev;
      const ilesConquises = { ...prev.ilesConquises };
      delete ilesConquises[cible.id];
      const liste = prev.etapes[cible.id] ?? [];
      const derniere = liste
        .filter((e) => e.faiteLe)
        .sort((a, b) => (b.faiteLe ?? '').localeCompare(a.faiteLe ?? ''))[0];
      const etapes = {
        ...prev.etapes,
        [cible.id]: liste.map((e) => (e.id === derniere?.id ? { ...e, faiteLe: undefined } : e)),
      };
      return { ...prev, ilesConquises, etapes, currentIslandId: cible.id };
    });
  }, []);

  const celebrerPalier = useCallback(() => {
    setState((prev) => ({ ...prev, palierCelebre: indexPalier(somme(prev.gains)) }));
  }, []);

  const definirButin = useCallback((index: number, texte: string) => {
    setState((prev) => {
      const butins = { ...prev.butins };
      if (texte.trim()) butins[index] = texte;
      else delete butins[index];
      return { ...prev, butins };
    });
  }, []);

  const validerMission = useCallback((id: string) => {
    setState((prev) => {
      if (prev.statutsMissions[id] === 'done') return prev;
      const bloc = prev.blocsPlanning.find((b) => b.id === id);
      if (!bloc) return prev;

      const statutsMissions = { ...prev.statutsMissions, [id]: 'done' as const };

      let logPose = prev.logPose;
      let currentIslandId = prev.currentIslandId;

      if (bloc.questWeight > 0) {
        const current = prev.logPose[prev.currentIslandId] ?? 0;
        const next = Math.min(100, current + bloc.questWeight);
        logPose = { ...prev.logPose, [prev.currentIslandId]: next };

        if (next >= 100) {
          const idx = iles.findIndex((i) => i.id === prev.currentIslandId);
          const nextIle = iles[idx + 1];
          if (nextIle) {
            currentIslandId = nextIle.id;
          }
        }
      }

      return { ...prev, statutsMissions, logPose, currentIslandId };
    });
  }, []);

  const echouerMission = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      statutsMissions: { ...prev.statutsMissions, [id]: 'failed' as const },
    }));
  }, []);

  // Renvoie l'id du créneau créé : indispensable pour que l'IA (GoingMerry)
  // puisse enchaîner plusieurs actions sur l'agenda dans un même tour sans
  // relire un état React pas encore rafraîchi.
  const ajouterBloc = useCallback((bloc: Omit<BlocPlanning, 'id'>): string => {
    const id = crypto.randomUUID();
    setState((prev) => ({
      ...prev,
      blocsPlanning: [...prev.blocsPlanning, { ...bloc, id }],
    }));
    return id;
  }, []);

  const modifierBloc = useCallback((id: string, patch: Omit<BlocPlanning, 'id'>) => {
    setState((prev) => ({
      ...prev,
      blocsPlanning: prev.blocsPlanning.map((b) =>
        b.id === id && !b.fixe ? { ...patch, id, fixe: b.fixe } : b,
      ),
    }));
  }, []);

  const supprimerBloc = useCallback((id: string, jour: JourSemaine) => {
    setState((prev) => {
      const bloc = prev.blocsPlanning.find((b) => b.id === id);
      if (!bloc || bloc.fixe) return prev;

      const joursRestants = bloc.jours.filter((j) => j !== jour);

      // Il reste d'autres jours : on retire seulement ce jour du créneau.
      if (joursRestants.length > 0) {
        return {
          ...prev,
          blocsPlanning: prev.blocsPlanning.map((b) =>
            b.id === id ? { ...b, jours: joursRestants } : b,
          ),
        };
      }

      // Plus aucun jour : on supprime le créneau entièrement.
      const statutsMissions = { ...prev.statutsMissions };
      delete statutsMissions[id];
      return {
        ...prev,
        blocsPlanning: prev.blocsPlanning.filter((b) => b.id !== id),
        statutsMissions,
      };
    });
  }, []);

  const prime = somme(state.gains);
  const bounty = prime * 1000;
  const currentIle = iles.find((i) => i.id === state.currentIslandId) ?? iles[0];
  const logPoseActuel = state.logPose[state.currentIslandId] ?? 0;

  return {
    prime,
    bounty,
    gains: state.gains,
    palierCelebre: state.palierCelebre,
    atteintLe: state.atteintLe,
    butins: state.butins,
    supprimerGain,
    remettrePrimeAZero,
    celebrerPalier,
    definirButin,
    currentIle,
    totalIles: iles.length,
    logPose: logPoseActuel,
    ilesConquises: state.ilesConquises,
    etapes: state.etapes,
    basculerEtape,
    ajouterEtape,
    modifierEtape,
    supprimerEtape,
    revenirIle,
    missions,
    blocsPlanning: state.blocsPlanning,
    ajouterGain,
    validerMission,
    echouerMission,
    ajouterBloc,
    modifierBloc,
    supprimerBloc,
  };
}

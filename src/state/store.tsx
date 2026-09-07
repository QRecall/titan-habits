import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  Commitment,
  CommitmentStatus,
  DayEntry,
  Profile,
  WeeklyContract,
  WeeklyReview,
} from '../types';
import { currentWeekKey, parseISODate, startOfISOWeek, toISODate, today, weekKey } from './date';
import { defaultStorage, emptyState, readStoredState, writeStoredState } from './storage';
import {
  contractForWeek,
  latestContractBefore,
  newContractForWeekStarting,
  nextWeekStart,
  sortContracts,
} from './contracts';

const initialState: AppState = emptyState;

export type Action =
  | { type: 'SET_PROFILE'; profile: Profile }
  | { type: 'RESET_ALL' }
  | { type: 'RESTORE'; state: AppState }
  | { type: 'SAVE_CONTRACT'; contract: WeeklyContract }
  | { type: 'MARK'; date: string; weekKey: string; commitmentId: string; status: CommitmentStatus }
  | { type: 'NOTE'; date: string; weekKey: string; commitmentId: string; note: string }
  | { type: 'SAVE_REVIEW'; review: WeeklyReview };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: action.profile };

    case 'RESET_ALL':
      return { ...initialState };

    case 'RESTORE':
      // Sustituye todo el estado por el de la copia (ya validada).
      return {
        profile: action.state.profile,
        contracts: action.state.contracts,
        days: action.state.days,
        reviews: action.state.reviews,
      };

    case 'SAVE_CONTRACT': {
      // Sustituye contrato existente para el mismo weekKey, o añade uno nuevo.
      // Al editar dentro de la misma semana se conservan las fechas originales
      // (startDate, signedAt, createdAt): el periodo evaluable no cambia y el
      // progreso ya registrado sigue contando.
      const previous = state.contracts.find((c) => c.weekKey === action.contract.weekKey);
      const others = state.contracts.filter((c) => c.weekKey !== action.contract.weekKey);
      const contract: WeeklyContract = previous
        ? {
            ...action.contract,
            startDate: previous.startDate,
            signedAt: previous.signedAt,
            createdAt: previous.createdAt,
          }
        : action.contract;
      return { ...state, contracts: sortContracts([...others, contract]) };
    }

    case 'MARK': {
      const day = state.days.find((d) => d.date === action.date);
      if (!day) {
        const newDay: DayEntry = {
          date: action.date,
          weekKey: action.weekKey,
          marks: [{ commitmentId: action.commitmentId, status: action.status }],
        };
        return { ...state, days: [...state.days, newDay] };
      }
      const existing = day.marks.find((m) => m.commitmentId === action.commitmentId);
      const nextMarks = existing
        ? day.marks.map((m) =>
            m.commitmentId === action.commitmentId ? { ...m, status: action.status } : m
          )
        : [...day.marks, { commitmentId: action.commitmentId, status: action.status }];
      return {
        ...state,
        days: state.days.map((d) => (d.date === action.date ? { ...d, marks: nextMarks } : d)),
      };
    }

    case 'NOTE': {
      const day = state.days.find((d) => d.date === action.date);
      if (!day) {
        return {
          ...state,
          days: [
            ...state.days,
            {
              date: action.date,
              weekKey: action.weekKey,
              marks: [{ commitmentId: action.commitmentId, status: null, note: action.note }],
            },
          ],
        };
      }
      const existing = day.marks.find((m) => m.commitmentId === action.commitmentId);
      const nextMarks = existing
        ? day.marks.map((m) =>
            m.commitmentId === action.commitmentId ? { ...m, note: action.note } : m
          )
        : [...day.marks, { commitmentId: action.commitmentId, status: null, note: action.note }];
      return {
        ...state,
        days: state.days.map((d) => (d.date === action.date ? { ...d, marks: nextMarks } : d)),
      };
    }

    case 'SAVE_REVIEW': {
      const others = state.reviews.filter((r) => r.weekKey !== action.review.weekKey);
      return { ...state, reviews: [...others, action.review] };
    }

    default:
      return state;
  }
}

export function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

/** 'current' = semana en curso · 'next' = la semana que empieza el próximo lunes. */
export type ContractTarget = 'current' | 'next';

export function newContractFor(commitments: Commitment[], target: ContractTarget): WeeklyContract {
  const now = new Date();
  const start = target === 'next' ? nextWeekStart(now) : toISODate(startOfISOWeek(now));
  return newContractForWeekStarting(commitments, start, now);
}

/** @deprecated usa newContractFor(commitments, 'current'). */
export function newContractForCurrentWeek(commitments: Commitment[]): WeeklyContract {
  return newContractFor(commitments, 'current');
}

export type StorageStatus = {
  /** Explicación si lo guardado no se pudo leer al arrancar. */
  loadError: string | null;
  /** Clave donde se conservó, intacto, el contenido ilegible. */
  preservedKey: string | null;
  /** true si el último intento de guardar fue rechazado por el navegador. */
  lastSaveFailed: boolean;
  /** true mientras no se haya escrito nada desde el arranque. */
  untouched: boolean;
};

type StoreValue = {
  state: AppState;
  setProfile: (p: Profile) => void;
  saveContract: (commitments: Commitment[], target?: ContractTarget) => void;
  mark: (commitmentId: string, status: CommitmentStatus, date?: string) => void;
  setNote: (commitmentId: string, note: string, date?: string) => void;
  saveReview: (review: Omit<WeeklyReview, 'createdAt'>) => void;
  resetAll: () => void;
  /** Sustituye todo el estado por una copia ya validada. */
  restore: (next: AppState) => void;
  storage: StorageStatus;
  /** Contrato de la semana en curso, o null si aún no se ha firmado. */
  activeContract: WeeklyContract | null;
  /** Contrato más reciente anterior a la semana en curso. */
  previousContract: WeeklyContract | null;
  /** Contrato ya preparado para la próxima semana, si existe. */
  nextContract: WeeklyContract | null;
  todayEntry: DayEntry | null;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(() => readStoredState(defaultStorage()));
  const [state, dispatch] = useReducer(reducer, loaded.state);
  const [lastSaveFailed, setLastSaveFailed] = useState(false);

  useEffect(() => {
    // Mientras el estado sea el recién cargado no se escribe nada: así un
    // arranque con datos ilegibles nunca los sobrescribe con un estado vacío.
    if (state === loaded.state) return;
    const ok = writeStoredState(state, defaultStorage());
    setLastSaveFailed(!ok);
  }, [state, loaded.state]);

  const setProfile = useCallback((profile: Profile) => {
    dispatch({ type: 'SET_PROFILE', profile });
  }, []);

  const saveContract = useCallback((commitments: Commitment[], target: ContractTarget = 'current') => {
    dispatch({ type: 'SAVE_CONTRACT', contract: newContractFor(commitments, target) });
  }, []);

  const mark = useCallback(
    (commitmentId: string, status: CommitmentStatus, date?: string) => {
      const iso = date ?? today();
      dispatch({ type: 'MARK', date: iso, weekKey: currentWeekKey(), commitmentId, status });
    },
    []
  );

  const setNote = useCallback(
    (commitmentId: string, note: string, date?: string) => {
      const iso = date ?? today();
      dispatch({ type: 'NOTE', date: iso, weekKey: currentWeekKey(), commitmentId, note });
    },
    []
  );

  const saveReview = useCallback((review: Omit<WeeklyReview, 'createdAt'>) => {
    dispatch({
      type: 'SAVE_REVIEW',
      review: { ...review, createdAt: new Date().toISOString() },
    });
  }, []);

  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET_ALL' });
  }, []);

  const restore = useCallback((next: AppState) => {
    dispatch({ type: 'RESTORE', state: next });
  }, []);

  const value = useMemo<StoreValue>(() => {
    const now = new Date();
    const thisWeek = currentWeekKey();
    const activeContract = contractForWeek(state.contracts, thisWeek);
    const previousContract = latestContractBefore(state.contracts, thisWeek);
    const nextContract = contractForWeek(state.contracts, weekKey(parseISODate(nextWeekStart(now))));
    const todayISO = today();
    const todayEntry = state.days.find((d) => d.date === todayISO) ?? null;
    return {
      state,
      setProfile,
      saveContract,
      mark,
      setNote,
      saveReview,
      resetAll,
      restore,
      storage: {
        loadError: loaded.error,
        preservedKey: loaded.preservedKey,
        lastSaveFailed,
        untouched: state === loaded.state,
      },
      activeContract,
      previousContract,
      nextContract,
      todayEntry,
    };
  }, [state, setProfile, saveContract, mark, setNote, saveReview, resetAll, restore, loaded, lastSaveFailed]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

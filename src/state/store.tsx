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
import { currentWeekKey, startOfISOWeek, toISODate, today } from './date';
import { defaultStorage, emptyState, readStoredState, writeStoredState } from './storage';

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
      return { ...state, contracts: [...others, contract] };
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

export function newContractForCurrentWeek(commitments: Commitment[]): WeeklyContract {
  const wk = currentWeekKey();
  const start = startOfISOWeek(new Date());
  return {
    weekKey: wk,
    startDate: toISODate(start),
    signedAt: today(),
    commitments,
    createdAt: new Date().toISOString(),
  };
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
  saveContract: (commitments: Commitment[]) => void;
  mark: (commitmentId: string, status: CommitmentStatus, date?: string) => void;
  setNote: (commitmentId: string, note: string, date?: string) => void;
  saveReview: (review: Omit<WeeklyReview, 'createdAt'>) => void;
  resetAll: () => void;
  /** Sustituye todo el estado por una copia ya validada. */
  restore: (next: AppState) => void;
  storage: StorageStatus;
  activeContract: WeeklyContract | null;
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

  const saveContract = useCallback((commitments: Commitment[]) => {
    dispatch({ type: 'SAVE_CONTRACT', contract: newContractForCurrentWeek(commitments) });
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
    const activeContract =
      state.contracts.length > 0 ? state.contracts[state.contracts.length - 1] : null;
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

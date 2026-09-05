import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
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

const STORAGE_KEY = 'titan.v1';

const initialState: AppState = {
  profile: null,
  contracts: [],
  days: [],
  reviews: [],
};

type Action =
  | { type: 'SET_PROFILE'; profile: Profile }
  | { type: 'RESET_ALL' }
  | { type: 'SAVE_CONTRACT'; contract: WeeklyContract }
  | { type: 'MARK'; date: string; weekKey: string; commitmentId: string; status: CommitmentStatus }
  | { type: 'NOTE'; date: string; weekKey: string; commitmentId: string; note: string }
  | { type: 'SAVE_REVIEW'; review: WeeklyReview };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: action.profile };

    case 'RESET_ALL':
      return { ...initialState };

    case 'SAVE_CONTRACT': {
      // Sustituye contrato existente para el mismo weekKey, o añade uno nuevo.
      const others = state.contracts.filter((c) => c.weekKey !== action.contract.weekKey);
      return { ...state, contracts: [...others, action.contract] };
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

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    // Migración: si un contrato guardado no tiene signedAt, se le asigna
    // la fecha local de hoy. Los registros de días previos se conservan
    // en state.days aunque queden fuera del periodo evaluable.
    const todayISO = today();
    const contracts = (parsed.contracts ?? []).map((c) =>
      c.signedAt ? c : { ...c, signedAt: todayISO }
    );
    return {
      profile: parsed.profile ?? null,
      contracts,
      days: parsed.days ?? [],
      reviews: parsed.reviews ?? [],
    };
  } catch {
    return initialState;
  }
}

function save(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage puede estar lleno o desactivado; ignoramos silenciosamente */
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

type StoreValue = {
  state: AppState;
  setProfile: (p: Profile) => void;
  saveContract: (commitments: Commitment[]) => void;
  mark: (commitmentId: string, status: CommitmentStatus, date?: string) => void;
  setNote: (commitmentId: string, note: string, date?: string) => void;
  saveReview: (review: Omit<WeeklyReview, 'createdAt'>) => void;
  resetAll: () => void;
  activeContract: WeeklyContract | null;
  todayEntry: DayEntry | null;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, load);

  useEffect(() => {
    save(state);
  }, [state]);

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
      activeContract,
      todayEntry,
    };
  }, [state, setProfile, saveContract, mark, setNote, saveReview, resetAll]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

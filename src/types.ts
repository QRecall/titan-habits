export type CommitmentStatus = 'normal' | 'minimum' | 'missed' | null;

export type Commitment = {
  id: string;
  name: string;
  normal: string;
  minimum: string;
  reason: string;
};

export type WeeklyContract = {
  weekKey: string;
  startDate: string;
  /** Fecha local (YYYY-MM-DD) en que se firmó el contrato; punto inicial
   *  de evaluación. Los días previos no se computan. */
  signedAt: string;
  commitments: Commitment[];
  createdAt: string;
};

export type DayMark = {
  commitmentId: string;
  status: CommitmentStatus;
  note?: string;
};

export type DayEntry = {
  date: string;
  weekKey: string;
  marks: DayMark[];
};

export type WeeklyReview = {
  weekKey: string;
  worked: string;
  hindered: string;
  changeNext: string;
  createdAt: string;
};

export type Profile = {
  name: string;
  identity: string;
  onboardedAt: string;
};

export type AppState = {
  profile: Profile | null;
  contracts: WeeklyContract[];
  days: DayEntry[];
  reviews: WeeklyReview[];
};

export type Screen = 'arranque' | 'progreso' | 'contrato' | 'contrato-proxima' | 'revision' | 'datos';

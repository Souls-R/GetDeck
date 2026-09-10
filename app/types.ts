export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conf: number;
}

export interface Match {
  id?: number;
  password?: number;
  name: string;
  distance: number;
  cardType: string;
  dbHash: string;
}

export interface RecognizedCard {
  box: Box;
  index: number;
  matches: Match[];
  selectedMatchIndex: number;
  hashStandard: string;
  hashPendulum: string;
  isEdited?: boolean;
}

export interface CardHashEntry {
  id: number;
  name: string;
  phash: string;
  card_type: string;
}

export interface CardInfo {
  password: number;
  card_type: string;
  monster_type_line?: string;
  attribute?: string;
  level?: number;
  rank?: number;
  atk?: number;
  def?: number;
  link_arrows?: string[];
  pendulum_scale?: number;
  name: { zh: string; ja?: string; en?: string };
  text: { zh?: string; ja?: string; en?: string };
  pendulum_effect?: { zh?: string; ja?: string; en?: string };
}

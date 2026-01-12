export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conf: number;
}

export interface Match {
  id: number;
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
}

export interface CardHashEntry {
  id: number;
  name: string;
  phash: string;
  card_type: string;
}

export interface CardInfo {
  result?: {
    id: number;
    text: {
      types?: string;
      atk?: number;
      def?: number;
      desc?: string;
      marker?: number[];
    };
  }[];
}

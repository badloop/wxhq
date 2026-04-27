export interface SoundingData {
  station: string;
  timestamp: string;
  levels: SoundingLevel[];
  indices: StabilityIndices;
}

export interface SoundingLevel {
  pressure: number;
  height: number;
  temperature: number;
  dewpoint: number;
  windDirection: number;
  windSpeed: number;
}

export interface StabilityIndices {
  cape: number;
  cin: number;
  liftedIndex: number;
  precipitableWater: number;
  lcl: number;
  lfc: number;
  el: number;
}

export interface HodographPoint {
  u: number;
  v: number;
  height: number;
  pressure: number;
}

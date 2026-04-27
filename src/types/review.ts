import { Timestamp } from "firebase/firestore";

export interface Review {
  id: string;
  author: string;
  authorId?: string;
  lat: number;
  lng: number;
  date: string;
  location: string;
  addressDetail?: string;
  content: string;
  images: string[];
  likes: number;
  views: number;
  tags: string[];
  ratings: { light: number; noise: number; water: number };
  createdAt?: Timestamp;
  isVerified?: boolean;
  distance?: number;
  experienceType?: string;
  address?: string;
}

export interface LocationStats {
  address: string;
  lat: number;
  lng: number;
  count: number;
  avgRating: number;
  isBookmarked: boolean;
  hasWritten: boolean;
  isResidential?: boolean;
}

export type LocationStatsMap = Record<string, LocationStats>;

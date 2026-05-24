import { Timestamp } from "firebase/firestore";

export interface Link {
  id: string;
  url?: string;
  title: string;
  iconName: string;
  clicks: number;
  ownerId: string;
  createdAt: Timestamp;
  subLinks?: SubLink[];
}

export interface SubLink {
  id: string;
  title: string;
  url: string;
  iconName?: string;
}

export interface UserProfile {
  slug: string;
  pageTitle: string;
  authorName?: string;
  pageViews?: number;
  avatarUrl?: string;
}

export const ICONS = [
  "Link",
  "Download",
  "File",
  "FileText",
  "Image",
  "Video",
  "Music",
  "Folder",
  "Globe",
  "Github",
  "Youtube",
  "Twitter",
  "Facebook",
  "Mail",
  "Bot",
  "BrainCircuit",
  "Sparkles",
  "Wand2",
  "Cpu",
  "Atom"
];

export type YearLevel = '1st' | '2nd' | '3rd' | '4th';
export type Semester = '1st' | '2nd' | 'Summer';
export type SubjectStatus = 'not_yet' | 'in_progress' | 'done';
export type ResourceType = 'notes' | 'video' | 'reference' | 'document' | 'presentation' | 'youtube';
export type AnnouncementCategory = 'academic' | 'event' | 'reminder' | 'holiday';

export interface User {
  uid?: string;
  fullName: string;
  idNumber: string;
  email?: string;
  yearLevel?: string;
  role?: 'student' | 'admin';
  loginTime: string;
  photoURL?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string;
  units: number;
  yearLevel: YearLevel;
  semester: Semester;
  specialization?: string;
  prerequisiteIds: string[];
  syllabusUrl?: string;
  department?: string;
  rating?: number;
  reviewCount?: number;
  averageRating?: number;
  ratingCount?: number;
  slotsAvailable?: number;
  totalSlots?: number;
  isFavorite?: boolean;
  createdAt?: any;
  updatedAt?: any;
  professor?: string;
  isAvailable?: boolean;
}

export interface Rating {
  id: string;
  subjectId: string;
  userId: string;
  userName: string;
  stars: number;
  feedback: string;
  createdAt: string;
}

export interface Resource {
  id: string;
  subjectId: string;
  userId: string;
  userName: string;
  title: string;
  type: ResourceType;
  url: string;
  fileName?: string | null;
  isPublic: boolean;
  createdAt: string;
}

export interface Progress {
  subjectId: string;
  status: SubjectStatus;
  grade?: number; // Added for GPA calculation (1.0 - 5.0 scale)
  updatedAt: string;
}

export interface CareerOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  type: 'internship' | 'job' | 'certification';
  requirements: string[];
  link: string;
  createdAt: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subjectId: string;
  creatorId: string;
  members: string[]; // List of user UIDs
  createdAt: string;
}

export interface StudyPost {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  content: string;
  type: 'question' | 'resource' | 'general';
  votes: number;
  createdAt: string;
}

export interface Quiz {
  id: string;
  subjectId: string;
  title: string;
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
  }[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GradeProjection {
  semester: Semester;
  yearLevel: YearLevel;
  projectedGPA: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  isPinned: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  category: string;
  description: string;
}

export interface Notebook {
  id: string;
  userId: string;
  name: string;
  summary?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface NotebookSource {
  id: string;
  notebookId: string;
  userId: string;
  title: string;
  type: 'file' | 'link' | 'text';
  content: string;
  url?: string;
  createdAt: any;
}

export interface NotebookMessage {
  id: string;
  notebookId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[]; // Source IDs
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'user' | 'admin';
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  imageUrl?: string;
}

export interface RSVP {
  eventId: string;
  userId: string;
  userName: string;
  status: 'going' | 'maybe' | 'not_going';
  timestamp: string;
}

export interface Comment {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  timestamp: string;
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc, 
  orderBy, 
  where,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signInWithGoogle, logout } from './firebase';
import { Event, RSVP, Comment, UserProfile } from './types';
import { 
  Calendar, 
  MapPin, 
  Plus, 
  LogOut, 
  LogIn, 
  User as UserIcon, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    outline: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn('bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden', className)}
  >
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-zinc-100">
            <h3 className="text-xl font-semibold text-zinc-900">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Anonymous',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || undefined,
            role: 'user'
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Events Listener
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      setEvents(eventsData);
    });
    return unsubscribe;
  }, []);

  const upcomingEvents = useMemo(() => 
    events.filter(e => isAfter(parseISO(e.date), new Date())), 
  [events]);

  const pastEvents = useMemo(() => 
    events.filter(e => isBefore(parseISO(e.date), new Date())), 
  [events]);

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const newEvent = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      date: formData.get('date') as string,
      location: formData.get('location') as string,
      createdBy: user.uid,
      creatorName: user.displayName || 'Anonymous',
      createdAt: new Date().toISOString(),
      imageUrl: `https://picsum.photos/seed/${Math.random()}/800/400`
    };
    try {
      await addDoc(collection(db, 'events'), newEvent);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error("Error creating event:", err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'events', eventId));
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
    } catch (err) {
      console.error("Error deleting event:", err);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Evently</h1>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold">{user.displayName}</p>
                  <p className="text-xs text-zinc-500">{userProfile?.role === 'admin' ? 'Administrator' : 'Member'}</p>
                </div>
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                />
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={signInWithGoogle}>
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero / Stats */}
        <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-bold text-zinc-900 mb-2">Discover Events</h2>
            <p className="text-zinc-500 max-w-md">Join amazing events, meet new people, and create memories that last a lifetime.</p>
          </div>
          {user && (
            <Button size="lg" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-zinc-100 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'upcoming' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            Upcoming ({upcomingEvents.length})
          </button>
          <button 
            onClick={() => setActiveTab('past')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'past' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            Past ({pastEvents.length})
          </button>
        </div>

        {/* Event Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {(activeTab === 'upcoming' ? upcomingEvents : pastEvents).map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="group cursor-pointer hover:shadow-xl transition-all duration-300" onClick={() => setSelectedEvent(event)}>
                  <div className="aspect-video relative overflow-hidden">
                    <img 
                      src={event.imageUrl} 
                      alt={event.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                      <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-lg shadow-sm">
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                          {format(parseISO(event.date), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-indigo-600 transition-colors">{event.title}</h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-zinc-500 text-sm">
                        <Clock className="w-4 h-4 mr-2" />
                        {format(parseISO(event.date), 'h:mm a')}
                      </div>
                      <div className="flex items-center text-zinc-500 text-sm">
                        <MapPin className="w-4 h-4 mr-2" />
                        {event.location}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-3 h-3 text-zinc-400" />
                        </div>
                        <span className="text-xs text-zinc-500">By {event.creatorName}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {(activeTab === 'upcoming' ? upcomingEvents : pastEvents).length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">No events found</h3>
            <p className="text-zinc-500">Be the first to create an event!</p>
          </div>
        )}
      </main>

      {/* Create Modal */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Create New Event"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Event Title</label>
            <input 
              required 
              name="title" 
              className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="Summer Beach Party"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Date & Time</label>
              <input 
                required 
                type="datetime-local" 
                name="date" 
                className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Location</label>
              <input 
                required 
                name="location" 
                className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="Central Park, NY"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
            <textarea 
              name="description" 
              rows={4}
              className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="Tell people what this event is about..."
            />
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full" size="lg">Create Event</Button>
          </div>
        </form>
      </Modal>

      {/* Event Details Modal */}
      <EventDetailsModal 
        event={selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
        user={user}
        onDelete={handleDeleteEvent}
        isAdmin={userProfile?.role === 'admin'}
      />

      <footer className="bg-white border-t border-zinc-100 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span className="font-bold">Evently</span>
          </div>
          <p className="text-zinc-500 text-sm">© 2026 Evently Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function EventDetailsModal({ 
  event, 
  onClose, 
  user, 
  onDelete,
  isAdmin
}: { 
  event: Event | null; 
  onClose: () => void; 
  user: User | null;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}) {
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (!event) return;
    const rsvpsQ = query(collection(db, 'events', event.id, 'rsvps'));
    const commentsQ = query(collection(db, 'events', event.id, 'comments'), orderBy('timestamp', 'desc'));

    const unsubRsvps = onSnapshot(rsvpsQ, (s) => setRsvps(s.docs.map(d => d.data() as RSVP)));
    const unsubComments = onSnapshot(commentsQ, (s) => setComments(s.docs.map(d => ({ id: d.id, ...d.data() } as Comment))));

    return () => { unsubRsvps(); unsubComments(); };
  }, [event]);

  const userRSVP = rsvps.find(r => r.userId === user?.uid);
  const goingCount = rsvps.filter(r => r.status === 'going').length;

  const handleRSVP = async (status: RSVP['status']) => {
    if (!user || !event) return;
    const rsvpDoc = doc(db, 'events', event.id, 'rsvps', user.uid);
    await setDoc(rsvpDoc, {
      eventId: event.id,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      status,
      timestamp: new Date().toISOString()
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event || !commentText.trim()) return;
    await addDoc(collection(db, 'events', event.id, 'comments'), {
      eventId: event.id,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      userPhoto: user.photoURL || undefined,
      text: commentText,
      timestamp: new Date().toISOString()
    });
    setCommentText('');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!event) return;
    await deleteDoc(doc(db, 'events', event.id, 'comments', commentId));
  };

  if (!event) return null;

  return (
    <Modal isOpen={!!event} onClose={onClose} title={event.title}>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        <img src={event.imageUrl} className="w-full rounded-2xl aspect-video object-cover" referrerPolicy="no-referrer" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center text-zinc-500">
              <Calendar className="w-4 h-4 mr-2" />
              {format(parseISO(event.date), 'PPP')}
            </div>
            <div className="flex items-center text-zinc-500">
              <MapPin className="w-4 h-4 mr-2" />
              {event.location}
            </div>
          </div>
          {(user?.uid === event.createdBy || isAdmin) && (
            <Button variant="danger" size="sm" onClick={() => onDelete(event.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="bg-zinc-50 p-4 rounded-2xl">
          <p className="text-zinc-700 leading-relaxed">{event.description}</p>
        </div>

        {/* RSVP Section */}
        <div className="border-t border-zinc-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              RSVPs ({goingCount} going)
            </h4>
            {user && (
              <div className="flex gap-2">
                {(['going', 'maybe', 'not_going'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleRSVP(status)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                      userRSVP?.status === status 
                        ? "bg-indigo-600 text-white" 
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    )}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {rsvps.filter(r => r.status === 'going').map(r => (
              <div key={r.userId} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                {r.userName}
              </div>
            ))}
          </div>
        </div>

        {/* Comments Section */}
        <div className="border-t border-zinc-100 pt-6">
          <h4 className="font-bold flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Discussion
          </h4>
          
          {user && (
            <form onSubmit={handleAddComment} className="flex gap-2 mb-6">
              <input 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
              <Button type="submit" size="sm">Post</Button>
            </form>
          )}

          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <img 
                  src={comment.userPhoto || `https://ui-avatars.com/api/?name=${comment.userName}`} 
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex-1 bg-zinc-50 p-3 rounded-2xl relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{comment.userName}</span>
                    <span className="text-[10px] text-zinc-400">{format(parseISO(comment.timestamp), 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-sm text-zinc-700">{comment.text}</p>
                  {(user?.uid === comment.userId || isAdmin) && (
                    <button 
                      onClick={() => handleDeleteComment(comment.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

import React, { useState, useEffect } from "react";
import { Plus, Calendar, MapPin, Ticket as TicketIcon, ArrowLeft, Loader2, CheckCircle2, Trash2, User as UserIcon, LogOut, LogIn, X, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { Event, User } from "./types";

export default function App() {
  const [view, setView] = useState<"list" | "create" | "detail" | "auth" | "tickets">("list");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTicketForQR, setSelectedTicketForQR] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(user));
    if (user && view === "tickets") {
      fetchMyTickets();
    }
  }, [user, view]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTickets = async () => {
    if (!user) return;
    setTicketsLoading(true);
    try {
      const res = await fetch(`/api/tickets/${user.email}`);
      const data = await res.json();
      setMyTickets(data);
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const imageFile = formData.get("image_file") as File;
    
    let imageUrl = `https://picsum.photos/seed/${data.title}/800/400`;
    
    if (imageFile && imageFile.size > 0) {
      imageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const MAX_WIDTH = 1200;
            if (img.width > MAX_WIDTH) {
              const canvas = document.createElement('canvas');
              const scaleSize = MAX_WIDTH / img.width;
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;

              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              resolve(dataUrl);
            } else {
              resolve(e.target?.result as string);
            }
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(imageFile);
      });
    }
    
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          price: parseFloat(data.price as string),
          total_tickets: parseInt(data.total_tickets as string),
          image_url: imageUrl
        }),
      });
      if (res.ok) {
        fetchEvents();
        setView("list");
      }
    } catch (error) {
      console.error("Failed to create event:", error);
    }
  };

  const handleBuyTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEvent) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          ...data
        }),
      });
      if (res.ok) {
        alert("Ticket purchased successfully!");
        fetchEvents();
        setView("list");
      } else {
        const err = await res.json();
        alert(err.error || "Purchase failed");
      }
    } catch (error) {
      console.error("Failed to buy ticket:", error);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!user || user.role !== 'admin') {
      alert("Only admins can delete events.");
      return;
    }
    if (!confirm("Are you sure you want to delete this event? This will also delete all associated tickets.")) return;

    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEvents();
        setView("list");
        setSelectedEvent(null);
      } else {
        alert("Failed to delete event");
      }
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok) {
        setUser(result);
        setView("list");
      } else {
        setAuthError(result.error || "Authentication failed");
      }
    } catch (error) {
      setAuthError("An error occurred. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView("list");
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => setView("list")}
            className="text-2xl font-bold tracking-tighter text-emerald-600 hover:opacity-80 transition-opacity"
          >
            EVENTLY
          </button>
          <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
              <button
                onClick={() => setView("create")}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-full font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Create Event</span>
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView("tickets")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
                    view === "tickets" ? "bg-emerald-100 text-emerald-700" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <TicketIcon size={18} />
                  <span className="hidden sm:inline">My Tickets</span>
                </button>
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-tighter">Logged in as</span>
                  <span className="text-sm font-medium text-stone-600">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-stone-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setView("auth");
                }}
                className="flex items-center gap-2 text-stone-600 hover:text-emerald-600 font-medium transition-colors"
              >
                <LogIn size={20} />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold tracking-tight">Upcoming Events</h1>
                <p className="text-stone-500">Discover and join amazing experiences near you.</p>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-emerald-600" size={40} />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-300">
                  <p className="text-stone-400">No events found. Be the first to create one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <motion.div
                      key={event.id}
                      whileHover={{ y: -4 }}
                      onClick={() => {
                        setSelectedEvent(event);
                        setView("detail");
                      }}
                      className="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm cursor-pointer group"
                    >
                      <div className="aspect-video relative overflow-hidden">
                        <img
                          src={event.image_url || `https://picsum.photos/seed/${event.id}/800/400`}
                          alt={event.title}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold text-emerald-700">
                          ${event.price}
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        <h3 className="text-xl font-bold leading-tight group-hover:text-emerald-600 transition-colors">
                          {event.title}
                        </h3>
                        <div className="space-y-1.5 text-sm text-stone-500">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            <span>{new Date(event.date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={14} />
                            <span>{event.location}</span>
                          </div>
                        </div>
                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                            {event.total_tickets - event.tickets_sold} tickets left
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden hidden sm:block">
                              <div 
                                className="h-full bg-emerald-500" 
                                style={{ width: `${(event.tickets_sold / event.total_tickets) * 100}%` }}
                              />
                            </div>
                            {user?.role === 'admin' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEvent(event.id);
                                }}
                                className="p-2 text-stone-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                                title="Delete Event"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto"
            >
              <button 
                onClick={() => setView("list")}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-6 transition-colors"
              >
                <ArrowLeft size={18} />
                <span>Back to events</span>
              </button>

              <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Create New Event</h2>
                  <p className="text-stone-500">Fill in the details to launch your event.</p>
                </div>

                <form onSubmit={handleCreateEvent} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Event Title</label>
                    <input
                      required
                      name="title"
                      placeholder="Summer Music Festival"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Description</label>
                    <textarea
                      required
                      name="description"
                      rows={4}
                      placeholder="Tell people what to expect..."
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Date</label>
                      <input
                        required
                        type="datetime-local"
                        name="date"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Location</label>
                      <input
                        required
                        name="location"
                        placeholder="Central Park, NY"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Ticket Price ($)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        name="price"
                        placeholder="29.99"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Total Tickets</label>
                      <input
                        required
                        type="number"
                        name="total_tickets"
                        placeholder="100"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Event Image</label>
                    <input
                      type="file"
                      name="image_file"
                      accept="image/*"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <p className="text-xs text-stone-400">Upload a photo or leave empty for a random beautiful image.</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    Launch Event
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === "detail" && selectedEvent && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <button 
                  onClick={() => setView("list")}
                  className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors"
                >
                  <ArrowLeft size={18} />
                  <span>Back to events</span>
                </button>
                {user?.role === 'admin' && (
                  <button 
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="flex items-center gap-2 text-red-500 hover:text-red-700 transition-colors font-medium text-sm"
                  >
                    <Trash2 size={16} />
                    <span>Delete Event</span>
                  </button>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="aspect-[21/9] relative">
                  <img
                    src={selectedEvent.image_url || `https://picsum.photos/seed/${selectedEvent.id}/1200/600`}
                    alt={selectedEvent.title}
                    className="object-cover w-full h-full"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-8 left-8 right-8 text-white">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">{selectedEvent.title}</h1>
                    <div className="flex flex-wrap gap-6 text-white/90">
                      <div className="flex items-center gap-2">
                        <Calendar size={20} />
                        <span>{new Date(selectedEvent.date).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={20} />
                        <span>{selectedEvent.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold">About this event</h2>
                      <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">
                        {selectedEvent.description}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 space-y-6">
                      <div className="flex justify-between items-end">
                        <span className="text-stone-500 font-medium">Ticket Price</span>
                        <span className="text-3xl font-bold text-emerald-600">${selectedEvent.price}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-500">Availability</span>
                          <span className="font-bold">{selectedEvent.total_tickets - selectedEvent.tickets_sold} left</span>
                        </div>
                        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${(selectedEvent.tickets_sold / selectedEvent.total_tickets) * 100}%` }}
                          />
                        </div>
                      </div>

                      {!user ? (
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center space-y-4">
                          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <LogIn size={24} />
                          </div>
                          <div className="space-y-1">
                            <h3 className="font-bold text-emerald-900">Login to Buy Tickets</h3>
                            <p className="text-sm text-emerald-700">You need an account to purchase tickets for this event.</p>
                          </div>
                          <button
                            onClick={() => {
                              setAuthMode("login");
                              setView("auth");
                            }}
                            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                          >
                            Sign In Now
                          </button>
                        </div>
                      ) : selectedEvent.tickets_sold >= selectedEvent.total_tickets ? (
                        <div className="bg-stone-200 text-stone-500 py-4 rounded-xl font-bold text-center">
                          Sold Out
                        </div>
                      ) : (
                        <form onSubmit={handleBuyTicket} className="space-y-4">
                          <div className="space-y-2">
                            <input
                              required
                              name="buyer_name"
                              defaultValue={user.email.split('@')[0]}
                              placeholder="Your Name"
                              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <input
                              required
                              type="email"
                              name="buyer_email"
                              defaultValue={user.email}
                              placeholder="Email Address"
                              className="w-full px-4 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                          >
                            <TicketIcon size={20} />
                            Buy Ticket Now
                          </button>
                        </form>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-stone-400 text-sm px-2">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span>Instant ticket delivery via email</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "tickets" && (
            <motion.div
              key="tickets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">My Tickets</h2>
                  <p className="text-stone-500">View and manage your event bookings.</p>
                </div>
                <button 
                  onClick={() => setView("list")}
                  className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors font-medium"
                >
                  <ArrowLeft size={18} />
                  <span>Back to events</span>
                </button>
              </div>

              {ticketsLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-emerald-600" size={40} />
                </div>
              ) : myTickets.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-300">
                  <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TicketIcon size={32} />
                  </div>
                  <p className="text-stone-400">You haven't purchased any tickets yet.</p>
                  <button 
                    onClick={() => setView("list")}
                    className="mt-4 text-emerald-600 font-bold hover:underline"
                  >
                    Browse Events
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {myTickets.map((ticket) => (
                    <motion.div 
                      key={ticket.id} 
                      layoutId={`ticket-${ticket.id}`}
                      onClick={() => setSelectedTicketForQR(ticket)}
                      className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col sm:flex-row cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group"
                    >
                      <div className="w-full sm:w-40 h-40 sm:h-auto relative overflow-hidden">
                        <img 
                          src={ticket.event_image || `https://picsum.photos/seed/${ticket.event_id}/400/400`} 
                          alt={ticket.event_title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <QrCode className="text-white" size={32} />
                        </div>
                      </div>
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Confirmed</span>
                            <span className="text-[10px] font-mono text-stone-400">#{ticket.id.toString().padStart(6, '0')}</span>
                          </div>
                          <h3 className="text-xl font-bold leading-tight">{ticket.event_title}</h3>
                          <div className="space-y-1 text-sm text-stone-500">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} />
                              <span>{new Date(ticket.event_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin size={14} />
                              <span>{ticket.event_location}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-stone-400 tracking-tighter">Purchased on</p>
                            <p className="text-xs font-medium text-stone-600">{new Date(ticket.purchase_date).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase text-stone-400 tracking-tighter">Attendee</p>
                            <p className="text-xs font-medium text-stone-600">{ticket.buyer_name}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === "auth" && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-8">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserIcon size={32} />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">
                    {authMode === "login" ? "Welcome Back" : "Create Account"}
                  </h2>
                  <p className="text-stone-500">
                    {authMode === "login" 
                      ? "Enter your credentials to access your account." 
                      : "Join Evently to start buying tickets."}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                  {authError && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                      {authError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Email Address</label>
                    <input
                      required
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold uppercase tracking-wider text-stone-400">Password</label>
                    <input
                      required
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {authLoading ? <Loader2 className="animate-spin" size={20} /> : (authMode === "login" ? "Sign In" : "Register")}
                  </button>
                </form>

                <div className="text-center">
                  <button
                    onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                    className="text-stone-500 hover:text-emerald-600 text-sm font-medium transition-colors"
                  >
                    {authMode === "login" ? "Don't have an account? Register" : "Already have an account? Login"}
                  </button>
                </div>
                
                {authMode === "login" && (
                  <div className="pt-4 border-t border-stone-100 text-center">
                    <p className="text-xs text-stone-400">
                      Demo Admin: <span className="font-mono text-stone-600">admin@evently.com</span> / <span className="font-mono text-stone-600">admin</span>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Code Modal */}
        <AnimatePresence>
          {selectedTicketForQR && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTicketForQR(null)}
                className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm"
              />
              <motion.div
                layoutId={`ticket-${selectedTicketForQR.id}`}
                className="relative bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
              >
                <button
                  onClick={() => setSelectedTicketForQR(null)}
                  className="absolute top-6 right-6 p-2 bg-stone-100 text-stone-500 rounded-full hover:bg-stone-200 transition-colors z-10"
                >
                  <X size={20} />
                </button>

                <div className="p-8 space-y-8">
                  <div className="text-center space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Official Ticket</span>
                    <h3 className="text-2xl font-bold tracking-tight">{selectedTicketForQR.event_title}</h3>
                    <p className="text-stone-500 text-sm">{selectedTicketForQR.event_location}</p>
                  </div>

                  <div className="bg-stone-50 p-8 rounded-3xl flex flex-col items-center justify-center space-y-6 border border-stone-100">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-stone-200">
                      <QRCodeSVG 
                        value={JSON.stringify({
                          ticketId: selectedTicketForQR.id,
                          eventId: selectedTicketForQR.event_id,
                          email: selectedTicketForQR.buyer_email,
                          name: selectedTicketForQR.buyer_name
                        })}
                        size={200}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Ticket Reference</p>
                      <p className="font-mono text-lg font-bold text-stone-800">#{selectedTicketForQR.id.toString().padStart(6, '0')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Attendee</p>
                      <p className="text-sm font-bold text-stone-800 truncate">{selectedTicketForQR.buyer_name}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Date</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {new Date(selectedTicketForQR.event_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-dashed border-stone-200 text-center">
                    <p className="text-[10px] text-stone-400 leading-relaxed">
                      Present this QR code at the entrance for validation. 
                      Each ticket is valid for one entry only.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-stone-200 py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-4">
          <p className="text-stone-400 text-sm font-medium tracking-widest uppercase">Evently &copy; 2026</p>
          <p className="text-stone-500 text-sm">The world's most elegant event platform.</p>
        </div>
      </footer>
    </div>
  );
}

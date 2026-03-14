import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Calendar, ChevronRight, X, Loader2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Venue { id: string; name: string; address?: string; }
interface Event  { id: string; name: string; venue_id: string; start_date?: string; }

interface VenueEventPickerProps {
  onSelect: (venueId: string, eventId: string | undefined, venueName: string, eventName: string | undefined) => void;
  onClose: () => void;
}

const API = import.meta.env.VITE_API_URL || '/api';

const VenueEventPicker: React.FC<VenueEventPickerProps> = ({ onSelect, onClose }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'venue' | 'event'>('venue');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/venues/public`)
      .then(r => r.json())
      .then(data => setVenues(Array.isArray(data) ? data : []))
      .catch(() => setVenues([]))
      .finally(() => setLoading(false));
  }, []);

  const handleVenueSelect = async (venue: Venue) => {
    setSelectedVenue(venue);
    setLoading(true);
    try {
      const r = await fetch(`${API}/events/public?venue_id=${venue.id}`);
      const data = await r.json();
      const list: Event[] = Array.isArray(data) ? data : [];
      setEvents(list);
      if (list.length === 0) {
        // No events — go straight to venue menu
        onSelect(venue.id, undefined, venue.name, undefined);
      } else {
        setStep('event');
      }
    } catch {
      onSelect(venue.id, undefined, venue.name, undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {step === 'event' && (
              <button onClick={() => setStep('venue')} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <h2 className="text-lg font-bold text-white">
              {step === 'venue' ? t('venuePicker.selectVenue') : t('venuePicker.eventsAt', { name: selectedVenue?.name })}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {step === 'venue' && (
                <motion.div key="venues" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-2">
                  {venues.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">{t('venuePicker.noVenues')}</p>
                  ) : venues.map(venue => (
                    <button
                      key={venue.id}
                      onClick={() => handleVenueSelect(venue)}
                      className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-cyan-500/50 rounded-xl transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{venue.name}</p>
                          {venue.address && <p className="text-slate-400 text-xs">{venue.address}</p>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </motion.div>
              )}

              {step === 'event' && (
                <motion.div key="events" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                  {/* Browse venue menu without event */}
                  <button
                    onClick={() => onSelect(selectedVenue!.id, undefined, selectedVenue!.name, undefined)}
                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-cyan-500/50 rounded-xl transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-slate-300 font-medium">{t('venuePicker.generalVenueMenu')}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  {events.map(event => (
                    <button
                      key={event.id}
                      onClick={() => onSelect(selectedVenue!.id, event.id, selectedVenue!.name, event.name)}
                      className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-cyan-500/50 rounded-xl transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{event.name}</p>
                          {event.start_date && (
                            <p className="text-slate-400 text-xs">
                              {new Date(event.start_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VenueEventPicker;

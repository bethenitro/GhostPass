import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DurationOption {
  days: number;
  price: number;
}

interface DurationWheelSelectorProps {
  onSelect: (days: number, price: number) => void;
  disabled?: boolean;
}

const durationOptions: DurationOption[] = [
  { days: 1, price: 10 },
  { days: 3, price: 20 },
  { days: 5, price: 35 },
  { days: 7, price: 50 },
  { days: 10, price: 65 },
  { days: 14, price: 85 },
  { days: 30, price: 100 },
];

// Calculate price for any day value using linear interpolation
const calculatePrice = (days: number): number => {
  // Find the two options that bracket this day value
  let lowerOption = durationOptions[0];
  let upperOption = durationOptions[durationOptions.length - 1];
  
  for (let i = 0; i < durationOptions.length - 1; i++) {
    if (days >= durationOptions[i].days && days <= durationOptions[i + 1].days) {
      lowerOption = durationOptions[i];
      upperOption = durationOptions[i + 1];
      break;
    }
  }
  
  // Linear interpolation
  const ratio = (days - lowerOption.days) / (upperOption.days - lowerOption.days);
  const price = lowerOption.price + ratio * (upperOption.price - lowerOption.price);
  return Math.round(price);
};

export const DurationWheelSelector: React.FC<DurationWheelSelectorProps> = ({
  onSelect,
  disabled = false
}) => {
  const [selectedDays, setSelectedDays] = useState(5); // Start at 5 days
  const [isDragging, setIsDragging] = useState(false);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  const minDays = 1;
  const maxDays = 30;

  useEffect(() => {
    // Notify parent of initial selection
    const price = calculatePrice(selectedDays);
    onSelect(selectedDays, price);
  }, []);

  const handleDaysChange = (days: number) => {
    if (disabled) return;
    
    const clampedDays = Math.max(minDays, Math.min(days, maxDays));
    setSelectedDays(clampedDays);
    
    const price = calculatePrice(clampedDays);
    onSelect(clampedDays, price);
  };

  // Desktop wheel scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 1 : -1;
    handleDaysChange(selectedDays + delta);
  };

  // Mobile touch handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;

    // Swipe threshold
    if (Math.abs(deltaY) > 30) {
      const change = deltaY > 0 ? 1 : -1;
      handleDaysChange(selectedDays + change);
    }
  };

  // Scrollbar drag handling
  const handleScrollbarMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    updateScrollPosition(e.clientY);
  };

  const updateScrollPosition = (clientY: number) => {
    if (!scrollbarRef.current) return;
    
    const rect = scrollbarRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, y / rect.height));
    
    const days = Math.round(minDays + percentage * (maxDays - minDays));
    handleDaysChange(days);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        updateScrollPosition(e.clientY);
      };
      const handleMouseUp = () => {
        setIsDragging(false);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, selectedDays]);

  const selectedPrice = calculatePrice(selectedDays);
  const savings = selectedDays > 1 
    ? ((10 * selectedDays - selectedPrice) / (10 * selectedDays) * 100).toFixed(0)
    : '0';
  const hasSavings = parseInt(savings) > 0;

  // Find closest preset option for display
  const getClosestPresetIndex = () => {
    let closestIndex = 0;
    let minDiff = Math.abs(durationOptions[0].days - selectedDays);
    
    for (let i = 1; i < durationOptions.length; i++) {
      const diff = Math.abs(durationOptions[i].days - selectedDays);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  };

  const closestPresetIndex = getClosestPresetIndex();
  const scrollPercentage = (selectedDays - minDays) / (maxDays - minDays);

  return (
    <div className="space-y-6">
      {/* Wheel Container with Scrollbar */}
      <div className="relative flex gap-4">
        {/* Main Wheel Display */}
        <div
          className={cn(
            "flex-1 relative h-[280px] overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900",
            disabled ? "border-slate-700 opacity-50" : "border-cyan-500/30"
          )}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Holographic Effect Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
          
          {/* Center Selection Highlight - Behind content */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[120px] pointer-events-none z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent" />
            {/* Top line - above content */}
            <div className="absolute inset-x-8 top-2 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            {/* Bottom line - below content */}
            <div className="absolute inset-x-8 bottom-2 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          </div>

          {/* Options Display */}
          <AnimatePresence mode="wait">
            <motion.div
              key={closestPresetIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              {/* Previous Item (Above) */}
              {closestPresetIndex > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 0.3 }}
                  className="absolute top-[50px] text-center"
                >
                  <div className="text-sm text-slate-600 font-mono">
                    {durationOptions[closestPresetIndex - 1].days}d
                  </div>
                </motion.div>
              )}

              {/* Selected Item (Center) - Shows only days */}
              <motion.div
                key={selectedDays}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative z-10"
              >
                <div className="text-center px-4">
                  <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 font-mono leading-none">
                    {selectedDays}
                  </div>
                  <div className="text-xl text-cyan-400 font-semibold mt-1">
                    Days
                  </div>
                </div>
              </motion.div>

              {/* Next Item (Below) */}
              {closestPresetIndex < durationOptions.length - 1 && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 0.3 }}
                  className="absolute bottom-[50px] text-center"
                >
                  <div className="text-sm text-slate-600 font-mono">
                    {durationOptions[closestPresetIndex + 1].days}d
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Gradient Overlays for Depth */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-900 to-transparent pointer-events-none z-20" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none z-20" />
        </div>

        {/* Vertical Scrollbar */}
        <div className="relative w-12 h-[280px] flex items-center justify-center">
          <div
            ref={scrollbarRef}
            className={cn(
              "relative w-4 h-full bg-slate-800/50 rounded-full border border-slate-700 cursor-pointer",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onMouseDown={handleScrollbarMouseDown}
          >
            {/* Scrollbar Thumb - Perfectly centered and constrained */}
            <motion.div
              className={cn(
                "absolute w-3 h-10 rounded-full border-2 transition-colors pointer-events-none",
                isDragging
                  ? "bg-cyan-400 border-cyan-300 shadow-lg shadow-cyan-500/50"
                  : "bg-cyan-500/50 border-cyan-400 shadow-md shadow-cyan-500/30"
              )}
              style={{
                top: `calc(${scrollPercentage * 100}% - ${scrollPercentage * 40}px)`,
                left: '2px',
                right: '2px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}
              animate={{
                scale: isDragging ? 1.05 : 1
              }}
            />
          </div>
        </div>
      </div>

      {/* Helper Text */}
      <div className="text-center space-y-1">
        <p className="text-slate-400 text-sm">
          <span className="hidden sm:inline">Scroll wheel, drag slider, or swipe to select</span>
          <span className="sm:hidden">Drag slider or swipe to select</span>
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-cyan-500/50" />
          <span>{selectedDays} of {maxDays} days</span>
        </div>
      </div>

      {/* Summary Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-cyan-500/30 rounded-xl p-6 backdrop-blur-sm">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.3),transparent_50%)]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Selected Plan</div>
              <div className="text-2xl font-bold text-white">
                {selectedDays} {selectedDays === 1 ? 'Day' : 'Days'} Pass
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Total</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">
                ${selectedPrice}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
            <div>
              <div className="text-xs text-slate-500 mb-1">Daily Rate</div>
              <div className="text-lg font-semibold text-cyan-300 font-mono">
                ${(selectedPrice / selectedDays).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Duration</div>
              <div className="text-lg font-semibold text-white">
                {selectedDays * 24} hours
              </div>
            </div>
          </div>

          <AnimatePresence>
            {hasSavings && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="text-emerald-400" size={16} />
                  <span className="text-emerald-400 text-sm font-semibold">
                    You save {savings}% compared to daily rate
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

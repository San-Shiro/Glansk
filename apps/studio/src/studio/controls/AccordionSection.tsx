import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Authentic WordPress Elementor Accordion Section.
 * Full-width collapsible drawer with chevron indicator, bold title, and subtle bottom divider.
 */
export default function AccordionSection({
  title,
  defaultOpen = true,
  isOpen,
  onToggle,
  actions,
  badge,
  children,
  className = "",
}: AccordionSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isOpen !== undefined ? isOpen : internalOpen;

  const handleToggle = () => {
    const next = !open;
    if (isOpen === undefined) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  return (
    <div className={`border-b select-none ${className}`} style={{ borderColor: "var(--line)" }}>
      {/* Accordion Title Bar */}
      <div
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-[var(--panel-2)] cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--ink-3)] shrink-0">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink)] truncate">
            {title}
          </span>
          {badge}
        </div>

        {actions && (
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Accordion Body */}
      {open && (
        <div className="px-3.5 py-3 space-y-3.5 bg-[var(--panel)] animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

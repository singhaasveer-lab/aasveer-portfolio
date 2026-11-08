"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { EASE_OUT } from "@/lib/motion";

interface OverlayProps {
  open: boolean;
  /** Asks the owner to close (Escape, scrim click). */
  onClose: () => void;
  /** Runs once the exit transition has finished and focus has been restored. */
  onClosed?: () => void;
  labelledBy: string;
  panelClassName: string;
  testId?: string;
  children: React.ReactNode;
}

/**
 * A modal layer built on the native <dialog>: showModal() supplies the focus trap, makes the page
 * behind it inert and puts focus back on the opener when closed. The element stays open during
 * the exit transition, and closes only when that has finished.
 */
export function Overlay({
  open,
  onClose,
  onClosed,
  labelledBy,
  panelClassName,
  testId,
  children,
}: OverlayProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open || dialog.current?.open) return;
    dialog.current?.showModal();
    document.documentElement.classList.add("overlay-open");
  }, [open]);

  function finishClosing() {
    dialog.current?.close();
    if (!document.querySelector("dialog[open]")) {
      document.documentElement.classList.remove("overlay-open");
    }
    onClosed?.();
  }

  return (
    <dialog
      ref={dialog}
      className="overlay"
      aria-labelledby={labelledBy}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <AnimatePresence onExitComplete={finishClosing}>
        {open && (
          <motion.div
            key="layer"
            className="overlay-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <div className="overlay-scrim" aria-hidden="true" onClick={onClose} />
            <motion.div
              className={panelClassName}
              initial={{ y: 22, scale: 0.985 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 12, scale: 0.99 }}
              transition={{ duration: 0.34, ease: EASE_OUT }}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

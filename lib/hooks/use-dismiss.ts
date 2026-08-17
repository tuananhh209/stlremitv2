"use client";

import { useEffect } from "react";

/**
 * Close an overlay with the Escape key.
 *
 * Clicking outside is the only way these dialogs used to be dismissed, which
 * left keyboard users stuck inside them.
 */
export function useDismissOnEscape(isOpen: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onDismiss]);
}

/**
 * Dismiss when the backdrop itself is clicked.
 * Clicks that bubble up from the dialog contents are ignored.
 */
export function backdropDismissHandler(onDismiss: () => void) {
  return (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onDismiss();
  };
}

"use client";
import { AnimatePresence, motion } from "motion/react";

// Split-flap style: the old text flips away, the new one flips in.
export function FlipText({ text, className = "", wrap }: { text: string; className?: string; wrap?: boolean }) {
  return (
    <span className={`inline-grid overflow-hidden align-bottom [perspective:300px] ${wrap ? "" : "whitespace-nowrap"} ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className="col-start-1 row-start-1"
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

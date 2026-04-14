import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop: fixed inset-0 bg-black z-40, opacity 0→0.4 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bs-overlay"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bs-sheet"
          >
            <div className="bs-header">
              <h2 className="bs-header__title">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="bs-header__close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="bs-body">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

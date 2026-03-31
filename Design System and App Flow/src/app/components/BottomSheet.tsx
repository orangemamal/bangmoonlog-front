import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 w-full h-[85vh] bg-white rounded-t-[24px] z-50 flex flex-col shadow-xl"
          >
            <div className="flex items-center justify-between p-6 pb-2 shrink-0">
              <h2 className="text-[20px] font-bold text-[#333D4B] leading-snug">{title}</h2>
              <button onClick={onClose} className="p-2 -mr-2 text-[#6B7684]">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-24">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

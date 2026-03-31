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
          {/* Backdrop: fixed inset-0 bg-black z-40, opacity 0→0.4 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "black",
              zIndex: 40,
            }}
          />

          {/* Sheet: fixed bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-[24px] z-50 flex flex-col shadow-xl */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              width: "100%",
              height: "85vh",
              backgroundColor: "white",
              borderTopLeftRadius: "24px",
              borderTopRightRadius: "24px",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Header: p-6 pb-2, flex items-center justify-between */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 24px 8px", flexShrink: 0 }}>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#333D4B", lineHeight: "1.3", margin: 0 }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                style={{ padding: "8px", marginRight: "-8px", background: "none", border: "none", color: "#6B7684", cursor: "pointer", display: "flex" }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Scrollable Content: flex-1 overflow-y-auto px-6 pb-24 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 96px" }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import "../styles/fonts.css";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-center" />
    </>
  );
}

import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Feed } from "./pages/Feed";
import { Notifications } from "./pages/Notifications";
import { MyPage } from "./pages/MyPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "feed", Component: Feed },
      { path: "notifications", Component: Notifications },
      { path: "mypage", Component: MyPage },
    ],
  },
]);

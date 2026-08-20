import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import Editor from "./pages/Editor";
import BugReport from "./pages/BugReport";
import Templates from "./pages/Templates";
import Users from "./pages/Users";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AuthContextProvider from "./context/AuthContext";
import SettingsContextProvider from "./context/SettingsContext";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <AuthContextProvider>
        <SettingsContextProvider>
          <RestoreScroll />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/editor"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/editor/diagrams/:id"
              element={
                <RequireAuth>
                  <Editor />
                </RequireAuth>
              }
            />
            <Route
              path="/editor/templates/:id"
              element={
                <RequireAuth>
                  <Editor />
                </RequireAuth>
              }
            />
            <Route
              path="/bug-report"
              element={
                <RequireAuth>
                  <BugReport />
                </RequireAuth>
              }
            />
            <Route
              path="/templates"
              element={
                <RequireAuth>
                  <Templates />
                </RequireAuth>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAdmin>
                  <Users />
                </RequireAdmin>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SettingsContextProvider>
      </AuthContextProvider>
    </BrowserRouter>
  );
}

function RestoreScroll() {
  const location = useLocation();
  useLayoutEffect(() => {
    window.scroll(0, 0);
  }, [location.pathname]);
  return null;
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthBlock } from "./components/AuthBlock";
import { Dashboard } from "./components/Dashboard";
import { PublicShare } from "./components/PublicShare";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicShare isRoot={true} />} />
        <Route path="/dashboard" element={
          <AuthBlock>
            <Dashboard />
          </AuthBlock>
        } />
        <Route path="/share/:userId" element={<PublicShare />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { Routes, Route, useLocation } from "react-router-dom";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import CreateOpportunity from "./pages/CreateOpportunity";
import OpportunityDetail from "./pages/OpportunityDetail";
import Faculty from "./pages/Faculty";
import EditOpportunity from "./pages/EditOpportunity";
import MyApplications from "./pages/MyApplications";
import Applicants from "./pages/Applicants";
import Approvals from "./pages/Approvals";
import Messages from "./pages/Messages";
import Analytics from "./pages/Analytics";
import Footer from "./pages/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const location = useLocation();
  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/register";

  return (
    <div className="page-shell">
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Any signed-in user */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/opportunity/:id"
          element={
            <ProtectedRoute>
              <OpportunityDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:id"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />

        {/* Faculty only */}
        <Route
          path="/create-opportunity"
          element={
            <ProtectedRoute role={["Faculty", "Coordinator"]}>
              <CreateOpportunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-opportunity/:id"
          element={
            <ProtectedRoute role={["Faculty", "Coordinator"]}>
              <EditOpportunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/opportunity/:id/applicants"
          element={
            <ProtectedRoute role={["Faculty", "Coordinator"]}>
              <Applicants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty"
          element={
            <ProtectedRoute role={["Faculty", "Coordinator"]}>
              <Faculty />
            </ProtectedRoute>
          }
        />

        {/* Student only */}
        <Route
          path="/my-applications"
          element={
            <ProtectedRoute role="Student">
              <MyApplications />
            </ProtectedRoute>
          }
        />

        {/* Coordinator only */}
        <Route
          path="/approvals"
          element={
            <ProtectedRoute role="Coordinator">
              <Approvals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute role="Coordinator">
              <Analytics />
            </ProtectedRoute>
          }
        />
      </Routes>
      {!isAuthPage && <Footer />}
    </div>
  );
}

export default App;

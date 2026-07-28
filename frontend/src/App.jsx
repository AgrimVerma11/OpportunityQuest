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

        {/* Faculty only */}
        <Route
          path="/create-opportunity"
          element={
            <ProtectedRoute role="Faculty">
              <CreateOpportunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-opportunity/:id"
          element={
            <ProtectedRoute role="Faculty">
              <EditOpportunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/opportunity/:id/applicants"
          element={
            <ProtectedRoute role="Faculty">
              <Applicants />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty"
          element={
            <ProtectedRoute role="Faculty">
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
      </Routes>
      {!isAuthPage && <Footer />}
    </div>
  );
}

export default App;

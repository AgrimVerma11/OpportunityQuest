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

function App() {
  const location = useLocation();
  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/register";

  return (
    <div className="page-shell">
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/home" element={<Home />} />

      <Route
        path="/create-opportunity"
        element={<CreateOpportunity />}
      />

      <Route
        path="/edit-opportunity/:id"
        element={<EditOpportunity />}
      />

      <Route
        path="/opportunity/:id"
        element={<OpportunityDetail />}
      />

      <Route
        path="/opportunity/:id/applicants"
        element={<Applicants />}
      />

      <Route
        path="/my-applications"
        element={<MyApplications />}
      />

      <Route
        path="/faculty"
        element={<Faculty />}
      />

      <Route
        path="/profile"
        element={<Profile />}
      />
    </Routes>
    {!isAuthPage && <Footer />}
    </div>
  );
}

export default App;
import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import CreateOpportunity from "./pages/CreateOpportunity";
import OpportunityDetail from "./pages/OpportunityDetail";
import Faculty from "./pages/Faculty";
import Footer from "./pages/Footer";

function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/home" element={<Home />} />
      <Route path="/create" element={<CreateOpportunity />} />
      <Route path="/opportunity/:id" element={<OpportunityDetail />} />
      <Route path="/faculty" element={<Faculty />} />
    </Routes>
    <Footer />
    </>
  );
}

export default App;
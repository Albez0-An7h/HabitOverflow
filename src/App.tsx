import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './Components/Navbar';
// Import your page components
// import Home from './pages/Home';
// import Dashboard from './pages/Dashboard';
// ... other imports

function App() {
  return (
    <Router>
      <Navbar />
      <div className="content">
        <Routes>
          {/* <Route path="/" element={<Home />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} /> */}
          {/* Add your actual routes here */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;

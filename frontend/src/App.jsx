import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import EPUBReader from './components/EPUBReader';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/read/:slug" element={<EPUBReader />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
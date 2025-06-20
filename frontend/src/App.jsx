import React, { useState } from 'react';
import UploadPage from './components/UploadPage';
import EPUBReader from './components/EPUBReader';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('upload');
  const [bookData, setBookData] = useState(null);

  const handleBookUploaded = (data) => {
    setBookData(data);
    setCurrentView('reader');
  };

  const handleBackToUpload = () => {
    setCurrentView('upload');
    setBookData(null);
  };

  return (
    <div className="App">
      {currentView === 'upload' ? (
        <UploadPage onBookUploaded={handleBookUploaded} />
      ) : (
        <div className="reader-container">
          <button 
            onClick={handleBackToUpload}
            className="back-button"
          >
            ← Back to Upload
          </button>
          <EPUBReader bookData={bookData} />
        </div>
      )}
    </div>
  );
}

export default App;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    console.log('File selected:', selectedFile);
    if (selectedFile) {
      if (selectedFile.type === 'application/epub+zip' || selectedFile.name.endsWith('.epub')) {
        setFile(selectedFile);
        setError('');
        console.log('✅ Valid EPUB file selected');
      } else {
        setError('Please select a valid EPUB file');
        setFile(null);
        console.log('❌ Invalid file type');
      }
    }
  };

  const handleUpload = async () => {
    console.log('=== UPLOAD STARTED ===');
    console.log('File to upload:', file);
    
    if (!file) {
      setError('Please select a file first');
      console.log('❌ No file selected');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('epub', file);
    console.log('FormData created');

    try {
      console.log('Sending request to: http://localhost:3001/api/upload');
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Response received:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        console.log('✅ Upload successful:', data);
        // Redirect to the unique URL
        navigate(`/read/${data.slug}`);
      } else {
        setError(data.error || 'Upload failed');
        console.log('❌ Upload failed:', data.error);
      }
    } catch (err) {
      console.error('❌ Network error:', err);
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Upload EPUB Book</h1>
      <p>Upload an EPUB file to start collaborative reading</p>
      
      <div style={{ margin: '20px 0' }}>
        <input
          type="file"
          accept=".epub"
          onChange={handleFileSelect}
        />
      </div>

      {file && (
        <div style={{ margin: '20px 0' }}>
          <p>Selected: {file.name}</p>
          <p>Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
        </div>
      )}

      {error && (
        <div style={{ color: 'red', margin: '20px 0' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        {uploading ? 'Uploading...' : 'Upload Book'}
      </button>
    </div>
  );
}

export default UploadPage;
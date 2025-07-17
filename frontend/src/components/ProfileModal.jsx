import React, { useState, useEffect } from 'react';

function ProfileModal({ bookId, onProfileSelected }) {
  const [existingProfiles, setExistingProfiles] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExistingProfiles();
  }, [bookId]);

  const loadExistingProfiles = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/books/${bookId}/profiles`);
      if (response.ok) {
        const data = await response.json();
        setExistingProfiles(data.profiles);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const handleSelectProfile = async (profile) => {
    setIsLoading(true);
    try {
      // Update last_used timestamp
      await fetch(`http://localhost:3001/api/books/${bookId}/profiles/${profile.id}/use`, {
        method: 'PUT'
      });
      
      // Store in localStorage
      localStorage.setItem('current_profile', JSON.stringify({
        ...profile,
        book_id: bookId
      }));
      
      onProfileSelected(profile);
    } catch (error) {
      console.error('Error selecting profile:', error);
      setError('Failed to select profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`http://localhost:3001/api/books/${bookId}/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: newUsername.trim()
        })
      });
      
      if (response.ok) {
        const newProfile = await response.json();
        
        // Store in localStorage
        localStorage.setItem('current_profile', JSON.stringify({
          ...newProfile,
          book_id: bookId
        }));
        
        onProfileSelected(newProfile);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create profile');
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      setError('Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        minWidth: '400px',
        maxWidth: '500px'
      }}>
        <h3 style={{ marginTop: 0 }}>Choose Your Reading Profile</h3>
        
        {!showCreateForm ? (
          <>
            {/* Existing Profiles */}
            {existingProfiles.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Select Existing Profile:</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {existingProfiles.map(profile => (
                    <div
                      key={profile.id}
                      onClick={() => handleSelectProfile(profile)}
                      style={{
                        padding: '12px',
                        margin: '5px 0',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: profile.color
                        }}
                      />
                      <span style={{ fontWeight: 'bold' }}>{profile.username}</span>
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: 'auto' }}>
                        {new Date(profile.last_used).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Create New Profile Button */}
            <button
              onClick={() => setShowCreateForm(true)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                background: '#4ECDC4',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? 'Loading...' : 'Create New Profile'}
            </button>
          </>
        ) : (
          <>
            {/* Create Profile Form */}
            <form onSubmit={handleCreateProfile}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Username:
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter your username"
                  maxLength={50}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>
              
              {error && (
                <div style={{ color: 'red', fontSize: '14px', marginBottom: '10px' }}>
                  {error}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setError('');
                    setNewUsername('');
                  }}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: isLoading ? 0.6 : 1
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!newUsername.trim() || isLoading}
                  style={{
                    flex: 2,
                    padding: '10px',
                    background: '#4ECDC4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: (!newUsername.trim() || isLoading) ? 0.6 : 1
                  }}
                >
                  {isLoading ? 'Creating...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfileModal; 
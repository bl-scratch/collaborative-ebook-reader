import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProfileModal from './ProfileModal';

function EPUBReader() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [bookData, setBookData] = useState(null);
  const [bookContent, setBookContent] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [convertingBookId, setConvertingBookId] = useState(null);
  const conversionInProgress = useRef(false);
  
  // Add highlighting and commenting state
  const [selectedText, setSelectedText] = useState('');
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [actionButtonPosition, setActionButtonPosition] = useState({ x: 0, y: 0 });
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [comments, setComments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState(null);
  const [highlightComments, setHighlightComments] = useState([]);
  const [showCommentsPopup, setShowCommentsPopup] = useState(false);
  
  // Add progress tracking state
  const [readingProgress, setReadingProgress] = useState(0);
  const [furthestProgress, setFurthestProgress] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [otherUsers, setOtherUsers] = useState([]);
  const [userPositions, setUserPositions] = useState({});
  const [lastProgressUpdate, setLastProgressUpdate] = useState(0);
  const PROGRESS_UPDATE_THROTTLE = 2000; // 2 seconds



  // Add profile state
  const [currentProfile, setCurrentProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Add scorecard state
  const [readingStats, setReadingStats] = useState({
    daysReading: 0,
    totalReactions: 0
  });

  // Initialize profile on component mount
  useEffect(() => {
    if (bookData?.id) {
      // Check if we have a stored profile for this book
      const storedProfile = localStorage.getItem('current_profile');
      
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        // Check if this profile is for the current book
        if (profile.book_id === bookData.id) {
          setCurrentProfile(profile);
          setCurrentUser({
            id: profile.id,
            username: profile.username,
            color: profile.color
          });
        } else {
          // Different book, show profile modal
          setShowProfileModal(true);
        }
      } else {
        // No stored profile, show modal
        setShowProfileModal(true);
      }
    }
  }, [bookData?.id]);

  // Profile selection handler
  const handleProfileSelected = (profile) => {
    setCurrentProfile(profile);
    setCurrentUser({
      id: profile.id,
      username: profile.username,
      color: profile.color
    });
    setShowProfileModal(false);
  };

  // Load book data by slug
  useEffect(() => {
    if (slug) {
      loadBookBySlug();
    }
  }, [slug]);

  const loadBookBySlug = async () => {
    try {
      console.log('🔍 Loading book by slug:', slug);
      const response = await fetch(`http://localhost:3001/api/book/slug/${slug}`);
      
      if (response.ok) {
        const book = await response.json();
        console.log('✅ Book loaded:', book);
        setBookData(book);
      } else {
        console.error('❌ Failed to load book:', response.status);
        setError('Book not found');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ Error loading book:', error);
      setError('Failed to load book');
      setIsLoading(false);
    }
  };

  // Load book content when bookData is available
  useEffect(() => {
    if (bookData?.id && !conversionInProgress.current) {
      conversionInProgress.current = true;
      setConvertingBookId(bookData.id);
      loadBookContent();
    }
  }, [bookData?.id]);

  const loadBookContent = async () => {
    try {
      console.log('Converting EPUB using Calibre for book:', bookData.id);
      
      const response = await fetch(`http://localhost:3001/api/convert-epub/${bookData.id}`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Calibre conversion successful:', result);
        
        if (result.success) {
          setBookContent(result);
          setIsLoading(false);
        } else {
          throw new Error('Failed to convert EPUB: ' + result.error);
        }
      } else {
        throw new Error('Failed to convert EPUB');
      }
    } catch (error) {
      console.error('Error converting EPUB:', error);
      setError(error.message);
      setIsLoading(false);
    } finally {
      conversionInProgress.current = false;
      setConvertingBookId(null);
    }
  };

  // Add share function
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/read/${slug}`;
    
    if (navigator.share) {
      navigator.share({
        title: bookData?.title || 'Collaborative Reading Session',
        text: `Join me in reading "${bookData?.title}"`,
        url: shareUrl
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link copied to clipboard!');
      });
    }
  };

  // Handle text selection
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      setSelectedText(selectedText);
      
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setActionButtonPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 50
      });
      
      setShowActionButtons(true);
    } else {
      setShowActionButtons(false);
    }
  };

  // Simple approach: Remove useCallback and just fix the immediate issues
  const updateReadingProgress = () => {
    const contentDiv = document.querySelector('[data-content="chapter-content"]');
    if (!contentDiv) {
      return;
    }
    
    // Try different scroll containers
    let scrollContainer = contentDiv;
    let scrollTop = 0;
    let scrollHeight = 0;
    let clientHeight = 0;
    
    // Check if the content div itself is scrollable
    if (contentDiv.scrollHeight > contentDiv.clientHeight) {
      scrollContainer = contentDiv;
    } else {
      // Look for a parent scrollable container
      const parentContainer = contentDiv.closest('.scrollable-content') || 
                             contentDiv.parentElement?.closest('[style*="overflow"]') ||
                             document.querySelector('[style*="overflow: auto"]');
      if (parentContainer) {
        scrollContainer = parentContainer;
      }
    }
    
    scrollTop = scrollContainer.scrollTop;
    scrollHeight = scrollContainer.scrollHeight;
    clientHeight = scrollContainer.clientHeight;
    
    if (scrollHeight > clientHeight) {
      const currentProgress = Math.min(100, Math.max(0, (scrollTop / (scrollHeight - clientHeight)) * 100));
      
      // Only update furthest progress if we've gone further (forward progress only)
      if (currentProgress > furthestProgress) {
        console.log('📈 New furthest progress:', currentProgress.toFixed(1) + '%');
        setFurthestProgress(currentProgress);
        
        // Send progress update to backend (throttled)
        sendProgressUpdate(currentProgress);
      }
    }
  };

  // Send progress update to backend
  const sendProgressUpdate = async (progress) => {
    if (!currentProfile || !bookData?.id) return;
    
    const now = Date.now();
    if (now - lastProgressUpdate < PROGRESS_UPDATE_THROTTLE) {
      console.log('⏱️ Throttling progress update');
      return; // Skip this update
    }
    
    try {
      console.log('📤 Sending furthest progress update:', progress.toFixed(1) + '%');
      const response = await fetch(`http://localhost:3001/api/books/${bookData.id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile_id: currentProfile.id,
          username: currentProfile.username,
          progress: progress,
          chapter: currentChapter + 1
        })
      });
      
      if (response.ok) {
        setLastProgressUpdate(now);
        console.log('✅ Furthest progress update sent successfully');
      } else {
        console.error('❌ Failed to send progress update:', response.status);
      }
    } catch (error) {
      console.error('❌ Error sending progress update:', error);
    }
  };

  // Load other users' progress
  const loadUserProgress = async () => {
    if (!bookData?.id) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/books/${bookData.id}/progress`);
      if (response.ok) {
        const data = await response.json();
        setOtherUsers(data.users || []);
        
        // Create positions object for easy lookup
        const positions = {};
        data.users.forEach(user => {
          positions[user.user_id] = user.progress;
        });
        setUserPositions(positions);
      }
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };

  // Add scroll event listener with proper cleanup
  useEffect(() => {
    const timer = setTimeout(() => {
      const contentDiv = document.querySelector('[data-content="chapter-content"]');
      if (contentDiv) {
        console.log('🎯 Attaching scroll listener to content div');
        
        const handleScroll = () => {
          updateReadingProgress();
        };
        
        contentDiv.addEventListener('scroll', handleScroll);
        
        return () => {
          contentDiv.removeEventListener('scroll', handleScroll);
        };
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentChapter, bookContent]); // Keep original dependencies

  // Load user progress when component mounts and when chapter changes
  useEffect(() => {
    loadUserProgress();
    
    // Set up interval to refresh user progress
    const interval = setInterval(loadUserProgress, 10000);
    
    return () => clearInterval(interval);
  }, [bookData?.id, currentChapter]); // Keep original dependencies

  // Add effect to load reading stats
  useEffect(() => {
    if (currentProfile?.id && bookData?.id) {
      loadReadingStats();
    }
  }, [currentProfile?.id, bookData?.id, highlights.length, comments.length]);

  const loadReadingStats = async () => {
    try {
      // Calculate days reading (from first progress update to now)
      const progressResponse = await fetch(`http://localhost:3001/api/progress/${bookData.id}/${currentProfile.id}`);
      const progressData = await progressResponse.json();
      
      // Calculate total reactions (highlights + comments)
      const highlightsResponse = await fetch(`http://localhost:3001/api/highlights/${bookData.id}?profile_id=${currentProfile.id}`);
      const highlightsData = await highlightsResponse.json();
      
      const commentsResponse = await fetch(`http://localhost:3001/api/comments/${bookData.id}?profile_id=${currentProfile.id}`);
      const commentsData = await commentsResponse.json();
      
      // Calculate days reading
      let daysReading = 1; // Default to 1 day for anyone with a profile
      if (progressData.first_session) {
        const firstSession = new Date(progressData.first_session);
        const now = new Date();
        const daysDiff = Math.floor((now - firstSession) / (1000 * 60 * 60 * 24));
        daysReading = daysDiff + 1; // First day = 1, second day = 2, etc.
      } else if (currentProfile.created_at) {
        // If no progress yet, but user has a profile, calculate from profile creation
        const profileCreated = new Date(currentProfile.created_at);
        const now = new Date();
        const daysDiff = Math.floor((now - profileCreated) / (1000 * 60 * 60 * 24));
        daysReading = daysDiff + 1; // First day = 1, second day = 2, etc.
      }
      
      const totalReactions = highlightsData.length + commentsData.length;
      
      setReadingStats({
        daysReading,
        totalReactions
      });
    } catch (error) {
      console.error('Error loading reading stats:', error);
    }
  };

  // Handle highlight action
  const handleHighlight = async () => {
    if (!selectedText.trim() || !currentProfile) return;
    
    setIsSubmitting(true);
    
    try {
      console.log('🚀 Adding highlight for text:', selectedText);
      console.log('📚 Book ID:', bookData.id);
      console.log(' Chapter:', currentChapter + 1);
      console.log(' Position:', window.getSelection().getRangeAt(0).startOffset);
      
      const response = await fetch(`http://localhost:3001/api/books/${bookData.id}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: selectedText,
          chapter: currentChapter + 1,
          position: window.getSelection().getRangeAt(0).startOffset,
          color: currentProfile.color,
          profile_id: currentProfile.id,
          username: currentProfile.username
        })
      });

      if (response.ok) {
        const newHighlight = await response.json();
        console.log('✅ Highlight successfully stored:', newHighlight);
        
        // Add to highlights state
        setHighlights([...highlights, newHighlight]);
        
        // Visually highlight the text in the DOM
        highlightTextInDOM(selectedText, currentProfile.color, false, newHighlight.id);
        
        clearSelection();
      } else {
        throw new Error('Failed to add highlight');
      }
    } catch (error) {
      console.error('❌ Error adding highlight:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle comment action
  const handleComment = () => {
    setShowCommentBox(true);
    setShowActionButtons(false);
  };

  // Submit comment
  const handleSubmitComment = async () => {
    if (!commentText.trim() || !selectedText.trim() || !currentProfile) return;
    
    setIsSubmitting(true);
    
    try {
      // First add highlight
      const highlightResponse = await fetch(`http://localhost:3001/api/books/${bookData.id}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: selectedText,
          chapter: currentChapter + 1,
          position: window.getSelection().getRangeAt(0).startOffset,
          color: currentProfile.color,
          profile_id: currentProfile.id,
          username: currentProfile.username
        })
      });

      if (highlightResponse.ok) {
        const newHighlight = await highlightResponse.json();
        console.log('✅ Highlight created for comment:', newHighlight);
        setHighlights([...highlights, newHighlight]);
        
        // Then add comment
        const commentResponse = await fetch(`http://localhost:3001/api/books/${bookData.id}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: commentText,
            selectedText: selectedText,
            chapter: currentChapter + 1,
            position: window.getSelection().getRangeAt(0).startOffset,
            highlightId: newHighlight.id,
            profile_id: currentProfile.id,
            username: currentProfile.username
          })
        });

        if (commentResponse.ok) {
          const newComment = await commentResponse.json();
          console.log('✅ Comment successfully added:', newComment);
          setComments([...comments, newComment]);
          
          // Visually highlight the text with star indicator
          highlightTextInDOM(selectedText, currentProfile.color, true, newHighlight.id);
          
          clearSelection();
        } else {
          throw new Error('Failed to add comment');
        }
      } else {
        throw new Error('Failed to add highlight');
      }
    } catch (error) {
      console.error('❌ Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear selection and hide UI elements
  const clearSelection = () => {
    setShowActionButtons(false);
    setShowCommentBox(false);
    setCommentText('');
    setSelectedText('');
    window.getSelection().removeAllRanges();
  };

  // Cancel comment
  const handleCancelComment = () => {
    clearSelection();
  };

  // Function to highlight text in the DOM
  const highlightTextInDOM = (text, color = '#ffeb3b', hasComments = false, highlightId = null) => {
    const contentDiv = document.querySelector('[data-content="chapter-content"]');
    if (!contentDiv) return;
    
    const walker = document.createTreeWalker(
      contentDiv,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    // Find and highlight the selected text
    textNodes.forEach(textNode => {
      const nodeText = textNode.textContent;
      const index = nodeText.indexOf(text);
      
      if (index !== -1) {
        const parent = textNode.parentNode;
        const before = document.createTextNode(nodeText.substring(0, index));
        const highlighted = document.createElement('span');
        highlighted.style.backgroundColor = color;
        highlighted.style.borderRadius = '2px';
        highlighted.style.padding = '1px 2px';
        highlighted.style.position = 'relative';
        highlighted.style.display = 'inline';
        highlighted.textContent = text;
        
        // Add star indicator if this highlight has comments
        if (hasComments && highlightId) {
          const star = document.createElement('span');
          star.innerHTML = '⭐';
          star.style.position = 'absolute';
          star.style.top = '-8px';
          star.style.right = '-12px';
          star.style.fontSize = '12px';
          star.style.cursor = 'pointer';
          star.style.zIndex = '10';
          star.style.pointerEvents = 'auto';
          star.style.backgroundColor = 'white';
          star.style.borderRadius = '50%';
          star.style.padding = '1px';
          star.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
          star.title = 'View comments';
          star.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            loadCommentsForHighlight(highlightId);
          };
          highlighted.appendChild(star);
        }
        
        const after = document.createTextNode(nodeText.substring(index + text.length));
        
        parent.replaceChild(after, textNode);
        parent.insertBefore(highlighted, after);
        parent.insertBefore(before, highlighted);
      }
    });
  };

  // Function to load comments for a highlight
  const loadCommentsForHighlight = async (highlightId) => {
    try {
      console.log('🔍 Loading comments for highlight:', highlightId);
      
      const response = await fetch(`http://localhost:3001/api/highlight/${highlightId}/comments`);
      if (response.ok) {
        const comments = await response.json();
        console.log(' Loaded comments:', comments);
        
        // Show comments in popup
        setSelectedHighlightId(highlightId);
        setHighlightComments(comments);
        setShowCommentsPopup(true);
      } else {
        console.error('❌ Failed to load comments');
      }
    } catch (error) {
      console.error('❌ Error loading comments:', error);
    }
  };

  // Load highlights and comments for current chapter
  useEffect(() => {
    if (bookData?.id) {
      // Load highlights
      fetch(`http://localhost:3001/api/books/${bookData.id}/highlights?chapter=${currentChapter + 1}`)
        .then(res => res.json())
        .then(data => {
          console.log('📚 Loaded highlights:', data);
          setHighlights(Array.isArray(data) ? data : []);
        })
        .catch(err => {
          console.error('Error loading highlights:', err);
          setHighlights([]);
        });
      
      // Load comments
      fetch(`http://localhost:3001/api/books/${bookData.id}/comments?chapter=${currentChapter + 1}`)
        .then(res => res.json())
        .then(data => {
          console.log(' Loaded comments:', data);
          setComments(Array.isArray(data) ? data : []);
          
          // Restore highlights with comment indicators after both highlights and comments are loaded
          setTimeout(() => {
            if (Array.isArray(data) && highlights.length > 0) {
              highlights.forEach(highlight => {
                const hasComments = data.some(comment => comment.highlight_id === highlight.id);
                highlightTextInDOM(highlight.text, highlight.color, hasComments, highlight.id);
              });
            }
          }, 200);
        })
        .catch(err => {
          console.error('Error loading comments:', err);
          setComments([]);
        });
    }
  }, [bookData?.id, currentChapter]);

  const nextChapter = () => {
    if (bookContent && currentChapter < bookContent.chapters.length - 1) {
      setCurrentChapter(currentChapter + 1);
    }
  };

  const prevChapter = () => {
    if (currentChapter > 0) {
      setCurrentChapter(currentChapter - 1);
    }
  };

  // ProgressBar component
  const ProgressBar = () => {
    const allUsers = [
      { user_id: currentUser?.id, username: currentUser?.username, progress: furthestProgress, isCurrentUser: true },
      ...otherUsers.filter(user => user.user_id !== currentUser?.id)
    ];

    if (!showProgressBar) {
      return (
        <div style={{
          background: 'white',
          padding: '5px 15px',
          borderBottom: '1px solid #e0e0e0',
          position: 'relative'
        }}>
          <button
            onClick={() => setShowProgressBar(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: '#666',
              padding: '5px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            title="Show progress bar"
          >
            📊 Show Progress
          </button>
        </div>
      );
    }

    return (
      <div style={{
        background: 'white',
        padding: '10px 15px',
        borderBottom: '1px solid #e0e0e0',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '12px', color: '#666', minWidth: '60px' }}>
            Progress
          </span>
          
          <div style={{
            flex: 1,
            height: '8px',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px',
            position: 'relative',
            overflow: 'visible'
          }}>
            {/* Background progress bar - shows furthest progress only */}
            <div style={{
              width: `${furthestProgress}%`,
              height: '100%',
              backgroundColor: '#4ECDC4',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
            
            {/* User position indicators - show furthest progress for each user */}
            {allUsers.map((user, index) => (
              <div
                key={user.user_id}
                style={{
                  position: 'absolute',
                  left: `${user.progress}%`,
                  top: '-4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: user.isCurrentUser ? '#FF6B6B' : '#45B7D1',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transform: 'translateX(-50%)',
                  cursor: 'pointer',
                  zIndex: 10
                }}
                title={`${user.username}: ${user.progress.toFixed(1)}% (furthest)`}
              >
                {user.isCurrentUser && (
                  <span style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '10px',
                    backgroundColor: '#FF6B6B',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    whiteSpace: 'nowrap'
                  }}>
                    You
                  </span>
                )}
              </div>
            ))}
          </div>
          
          <span style={{ fontSize: '12px', color: '#666', minWidth: '40px' }}>
            {furthestProgress.toFixed(1)}%
          </span>
          
          <button
            onClick={() => setShowProgressBar(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#999',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            title="Hide progress bar"
          >
            ✕
          </button>
        </div>
        
        {/* User legend */}
        {otherUsers.length > 0 && (
          <div style={{
            marginTop: '8px',
            display: 'flex',
            gap: '15px',
            flexWrap: 'wrap'
          }}>
            {otherUsers.map(user => (
              <div key={user.user_id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                color: '#666'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#45B7D1'
                }} />
                <span>{user.username}</span>
                <span>({user.progress.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Progress explanation */}
        <div style={{
          marginTop: '5px',
          fontSize: '10px',
          color: '#999',
          fontStyle: 'italic'
        }}>
          Shows furthest reading progress for all users.
        </div>
      </div>
    );
  };

  // Scorecard component
  const ReadingScorecard = () => {
    const progressPercent = Math.round(furthestProgress);
    const progressBlocks = 10;
    const filledBlocks = Math.floor((progressPercent / 100) * progressBlocks);
    
    const progressBar = '━'.repeat(filledBlocks) + '░'.repeat(progressBlocks - filledBlocks);
    
    return (
      <div style={{
        background: '#f8f9fa',
        padding: '12px 15px',
        borderBottom: '1px solid #e0e0e0',
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#333'
      }}>
        <div>
          👤 {currentProfile.username}
        </div>
        <div style={{ marginTop: '4px' }}>
          {progressBar} {progressPercent}% • ⏰ {readingStats.daysReading} days • 💬 {readingStats.totalReactions} reactions
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div>Loading book...</div>
        {bookData && <p>Book: {bookData.title}</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Back to Upload</button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showProfileModal && bookData?.id && (
        <ProfileModal 
          bookId={bookData.id}
          onProfileSelected={handleProfileSelected}
        />
      )}
      
      {!showProfileModal && currentProfile && (
        <>
          {/* Book Header */}
          <div style={{ background: 'white', padding: '15px', borderBottom: '1px solid #e0e0e0' }}>
            <h2>
              {bookData?.title || 'EPUB Reader'}
              {bookData?.author && bookData.author !== 'Unknown Author' && (
                <span style={{ color: '#666', fontSize: '0.8em', fontWeight: 'normal' }}>
                  {' '}by {bookData.author}
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <button onClick={() => navigate('/')}>
                ← Back to Upload
              </button>
              <button onClick={prevChapter} disabled={currentChapter === 0}>
                ← Previous Chapter
              </button>
              <span>Chapter {currentChapter + 1} of {bookContent?.chapters?.length || 0}</span>
              <button onClick={nextChapter} disabled={currentChapter >= (bookContent?.chapters?.length - 1) || 0}>
                Next Chapter →
              </button>
              <button 
                onClick={handleShare}
                style={{
                  background: '#4ECDC4',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginLeft: '10px'
                }}
              >
                Share
              </button>
            </div>
          </div>

          {/* Reading Scorecard */}
          <ReadingScorecard />
      
          {/* Progress Bar */}
          <ProgressBar />
      
      <div style={{ flex: 1, overflow: 'auto', padding: '20px', backgroundColor: '#f9f9f9', position: 'relative' }}>
        {bookContent && bookContent.chapters[currentChapter] && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h3>{bookContent.chapters[currentChapter].title}</h3>
            <div 
              data-content="chapter-content"
              className="scrollable-content"
              dangerouslySetInnerHTML={{ __html: bookContent.chapters[currentChapter].content }}
              style={{ 
                lineHeight: '1.6', 
                fontSize: '16px', 
                fontFamily: 'Georgia, serif',
                textAlign: 'justify',
                userSelect: 'text',
                maxHeight: '60vh',
                overflow: 'auto'
              }}
              onMouseUp={handleTextSelection}
            />
            
            {/* Floating Action Buttons */}
            {showActionButtons && (
              <div style={{
                position: 'fixed',
                left: actionButtonPosition.x - 60,
                top: actionButtonPosition.y,
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                padding: '8px',
                display: 'flex',
                gap: '8px',
                zIndex: 1000
              }}>
                <button
                  onClick={handleHighlight}
                  disabled={isSubmitting}
                  style={{
                    width: '40px',
                    height: '40px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#FFD700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    opacity: isSubmitting ? 0.6 : 1
                  }}
                  title="Highlight text"
                >
                  🖍️
                </button>
                <button
                  onClick={handleComment}
                  disabled={isSubmitting}
                  style={{
                    width: '40px',
                    height: '40px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#4ECDC4',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    opacity: isSubmitting ? 0.6 : 1
                  }}
                  title="Add comment"
                >
                  ✏️
                </button>
              </div>
            )}
            
            {/* Comment Box */}
            {showCommentBox && (
              <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                zIndex: 1001,
                minWidth: '400px'
              }}>
                <h4>Add Comment</h4>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                  Selected text: "{selectedText}"
                </p>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write your comment..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleCancelComment}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || isSubmitting}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: '#4ECDC4',
                      color: 'white',
                      cursor: 'pointer',
                      opacity: (!commentText.trim() || isSubmitting) ? 0.6 : 1
                    }}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Highlights and Comments Section */}
            {(highlights.length > 0 || comments.length > 0) && (
              <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <h4>Highlights & Comments</h4>
                
                {/* Highlights */}
                {highlights.map((highlight, index) => (
                  <div key={index} style={{
                    backgroundColor: highlight.color + '20',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    borderLeft: `3px solid ${highlight.color}`
                  }}>
                    <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                      "{highlight.text}"
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                      <span>by <strong>{highlight.username}</strong></span>
                      <span>{new Date(highlight.created_date).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                
                {/* Comments */}
                {comments.map((comment, index) => (
                  <div key={index} style={{
                    backgroundColor: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    borderLeft: '3px solid #667eea'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                      "{comment.selected_text || comment.text}"
                    </div>
                    <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                      {comment.comment || comment.text}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                      <span>by <strong>{comment.username}</strong></span>
                      <span>{new Date(comment.created_date || comment.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Comments Popup */}
      {showCommentsPopup && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 1002,
          minWidth: '400px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3>Comments</h3>
            <button 
              onClick={() => setShowCommentsPopup(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '5px'
              }}
            >
              ✕
            </button>
          </div>
          
          {highlightComments.length > 0 ? (
            <div>
              {highlightComments.map((comment, index) => (
                <div key={index} style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  borderLeft: '3px solid #667eea'
                }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                    "{comment.text || comment.selected_text}"
                  </div>
                  <div style={{ fontSize: '16px', marginBottom: '5px' }}>
                    {comment.comment || comment.content}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                    <span>by <strong>{comment.username}</strong></span>
                    <span>{new Date(comment.created_at || comment.created_date).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666', textAlign: 'center' }}>No comments yet.</p>
          )}
        </div>
      )}

      {/* Overlay for popup */}
      {showCommentsPopup && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1001
          }}
          onClick={() => setShowCommentsPopup(false)}
        />
      )}
      
          <div style={{ background: 'white', padding: '10px', borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
            <p>Powered by Calibre - Professional EPUB conversion</p>
          </div>
        </>
      )}
    </div>
  );
}

export default EPUBReader;
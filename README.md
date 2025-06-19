# Collaborative E-Book Reader

A real-time collaborative e-book reading platform where multiple users can read, highlight, and comment on EPUB files together through unique shareable links.

## 🚀 Features

### Core Functionality
- **EPUB Upload & Rendering**: Upload EPUB files and render them using EPUB.js
- **Real-time Collaboration**: Multiple users can read the same book simultaneously
- **Text Highlighting**: Users can highlight text with their unique colors
- **Comments & Replies**: Add comments to highlights with threaded discussions
- **Progress Tracking**: See where other users are in the book
- **Anonymous Users**: No registration required - users get random profiles

### User Experience
- **Unique Shareable Links**: Each uploaded book gets a unique URL
- **User Profiles**: Anonymous users get fun names like "Cheerful Penguin" with unique colors
- **Progress Visualization**: See all users' reading progress on a progress bar
- **Table of Contents**: Navigate through chapters easily
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React with EPUB.js for rendering
- **Backend**: Node.js/Express server
- **Database**: SQLite (MVP), scalable to PostgreSQL
- **Real-time**: WebSocket connections via Socket.io
- **File Storage**: Local file system for EPUB files

### Key Components
1. **EPUB.js Integration**: Robust EPUB parsing and rendering
2. **WebSocket Management**: Real-time collaboration features
3. **Configurable Limits**: Scalable constraints for MVP and beyond
4. **Error Handling**: Comprehensive error recovery and graceful degradation
5. **Performance Monitoring**: Memory and resource management

## 📋 MVP Limits

### Current Constraints (Phase 1)
- **File Size**: 25MB maximum per EPUB
- **Users**: 5 concurrent users per session
- **Highlights**: 100 per user per book
- **Comments**: 500 characters maximum, 5 per highlight
- **Replies**: 2 levels deep maximum
- **Pages**: 1000 pages maximum per book

### Scaling Phases
- **Phase 2**: 50MB files, 10 users, 200 highlights
- **Phase 3**: 100MB files, 25 users, 500 highlights

## 📚 Documentation

### Design Documents
- **[Pseudocode](pseudocode.md)**: Complete application flow with error handling
- **[Anticipated Issues](anticipated_issues.md)**: Comprehensive error analysis and solutions
- **[MVP Limits](mvp_limits.md)**: Detailed constraints and scaling strategy

### Configuration
- **[Limits Configuration](config/limits.js)**: Centralized configurable limits system
- **[Usage Examples](config/usage-example.js)**: How to use the configuration system

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd collaborative-ebook-reader

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=sqlite:./database/ebooks.db
UPLOAD_DIR=./uploads
```

## 🏃‍♂️ Development Roadmap

### Phase 1: MVP (Current)
- [x] System architecture design
- [x] Error handling strategy
- [x] Configuration system
- [ ] Basic EPUB upload and rendering
- [ ] User session management
- [ ] Real-time highlighting
- [ ] Comments system
- [ ] Progress tracking

### Phase 2: Enhanced Features
- [ ] Advanced navigation
- [ ] Search functionality
- [ ] Export features
- [ ] Offline support
- [ ] User authentication

### Phase 3: Scale & Optimize
- [ ] Database optimization
- [ ] Performance monitoring
- [ ] Advanced collaboration features
- [ ] Mobile app

## 🛠️ Technical Implementation

### Error Handling Strategy
- **Graceful Degradation**: Fallback modes when features fail
- **Comprehensive Logging**: Track all errors for debugging
- **User-Friendly Messages**: Clear, actionable error messages
- **Recovery Mechanisms**: Automatic retry and data recovery

### Performance Considerations
- **Memory Management**: Efficient EPUB rendering and cleanup
- **Rate Limiting**: Prevent abuse and ensure stability
- **Caching Strategy**: Reduce server load and improve response times
- **Database Optimization**: Efficient queries and indexing

### Security Measures
- **Input Validation**: Sanitize all user inputs
- **File Upload Security**: Validate EPUB files thoroughly
- **Session Management**: Secure anonymous user sessions
- **Rate Limiting**: Prevent abuse and DDoS attacks

## 🤝 Contributing

### Development Guidelines
1. Follow the established error handling patterns
2. Use the centralized configuration system
3. Implement comprehensive testing
4. Document all new features
5. Follow the scaling phases for new limits

### Code Style
- Use TypeScript for type safety
- Follow React best practices
- Implement proper error boundaries
- Write comprehensive tests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **EPUB.js**: For robust EPUB rendering capabilities
- **Socket.io**: For real-time communication features
- **React**: For the frontend framework
- **SQLite**: For lightweight database solution

## 📞 Support

For questions, issues, or contributions, please:
1. Check the documentation first
2. Search existing issues
3. Create a new issue with detailed information
4. Follow the contribution guidelines

---

**Note**: This is a collaborative project designed for educational and research purposes. Please respect copyright laws when uploading EPUB files. 
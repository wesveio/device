# Device Information Dashboard

A beautiful, responsive web application that displays comprehensive device and browser information in real-time. Built for Netlify deployment.

## Features

- **Session Management**: Displays Session ID (SID) and Session Fingerprint (SFP)
- **Device Information**: Shows timezone, language settings, and browser details
- **Hardware Capabilities**: CPU cores, device memory, touch points
- **Display Information**: Screen resolution, color depth, and pixel depth
- **Raw Data**: Complete signal string for debugging purposes

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Device Fingerprinting**: Custom implementation using browser APIs
- **Deployment**: Netlify-ready configuration
- **Security**: HTTPS-only cookies, secure headers

## Local Development

1. Clone the repository
2. Open `index.html` in your browser
3. Or serve with a local server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

## Deployment

This project is configured for Netlify deployment:

1. Push your code to a Git repository
2. Connect the repository to Netlify
3. Deploy automatically

The `netlify.toml` file includes:
- Security headers
- Proper routing configuration
- Build settings

## Privacy & Security

- Uses session-only cookies (expire when browser closes)
- Implements Do Not Track respect
- No external tracking or analytics
- All data processing happens client-side

## Browser Compatibility

- Modern browsers with ES6+ support
- Requires JavaScript enabled
- Responsive design for mobile and desktop

## License

MIT License - feel free to use and modify as needed.

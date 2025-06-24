# Let Me Take A Look AI Vision Studio - Eyes for the Blind

**AI-powered vision assistance for blind and visually impaired users with comprehensive voice feedback.**

## Purpose

This application serves as digital eyes for blind and visually impaired individuals, using artificial intelligence to:

- **See and describe** the world around you through your camera
- **Read text aloud** from documents, signs, menus, and labels
- **Navigate safely** by identifying obstacles and pathways
- **Shop independently** by identifying products and prices
- **Understand social situations** and describe people and activities
- **Access technology** by reading screens and interfaces

## Accessibility Features

### Voice Feedback System

- **Automatic voice announcements** for all AI analysis results
- **Customizable speech rate, pitch, and volume**
- **High-quality text-to-speech** with natural voices
- **Interrupt and repeat** functionality for better control

### Specialized Analysis Modes

1. **Complete Scene Description** - Comprehensive overview of everything visible
2. **Navigation & Mobility Help** - Focus on safe pathways and obstacles
3. **Read All Text** - OCR and reading of all visible text
4. **Shopping Assistant** - Product identification and price reading
5. **Social Situation** - Describe people and social contexts
6. **Clothing & Appearance** - Detailed clothing and style descriptions
7. **Document Reader** - Complete document and form reading
8. **Food & Cooking Helper** - Food safety and cooking assistance
9. **Safety & Emergency** - Hazard identification and safety alerts
10. **Technology Assistant** - Screen and device interface help

### Keyboard Accessibility

All functions accessible via keyboard shortcuts for screen reader users:

## Keyboard Shortcuts

### Basic Camera Controls

- **`Ctrl + C`** - Start/Stop Camera
- **`Spacebar`** - Capture Frame for Analysis
- **`Ctrl + R`** - Toggle Real-time Analysis
- **`Ctrl + A`** - Analyze Current Frame

### Voice & Accessibility Controls

- **`Ctrl + Shift + V`** - Toggle Voice On/Off
- **`Ctrl + Shift + A`** - Read Current Analysis Result
- **`Ctrl + Shift + H`** - Read Full Instructions
- **`Ctrl + Shift + R`** - Repeat Last Message
- **`Escape`** - Stop Voice Reading
- **`Ctrl + Shift + =`** - Speed Up Voice
- **`Ctrl + Shift + -`** - Slow Down Voice

### Quick Actions

- **`F1`** - Quick Analysis with Voice (Take picture & analyze immediately)
- **`F2`** - Read System Status
- **`F3`** - Read Camera Stats
- **`F4`** - Emergency Stop (Stop all audio and processing)

## Demo

![alt text](/public/image.jpg)
![alt text](/public/image-1.jpg)
![alt text](/public/image-2.jpg)

## Getting Started

### 1. Setup Requirements

- **Modern web browser** with camera access
- **AI server running** (SmolVLM or compatible model)
- **Audio enabled** for text-to-speech functionality
- **Microphone permissions** (optional, for future voice commands)

### 2. First Time Setup

1. **Allow camera access** when prompted by browser
2. **Allow audio playback** for voice feedback
3. **Test voice system** using the voice controls panel
4. **Configure AI server** URL (default: localhost:8000)
5. **Choose analysis type** based on your needs

### 3. Basic Usage Flow

1. **Start camera** (Ctrl+C or click Start Camera button)
2. **Point camera** at what you want to understand
3. **Capture frame** (Spacebar) or enable real-time analysis
4. **Listen to description** - AI will automatically speak results
5. **Ask for repeats** (Ctrl+Shift+R) if needed

## Usage Scenarios

### Reading Documents & Text

- Point camera at documents, menus, signs, labels
- Use "Read All Text" analysis mode
- AI will read everything aloud clearly
- Perfect for mail, bills, restaurant menus, store signs

### Navigation & Mobility

- Use "Navigation & Mobility Help" mode
- Point camera down hallways, at doorways, stairs
- Get safety warnings about obstacles
- Understand your environment for safe movement

### Shopping Assistance

- Use "Shopping Assistant" mode
- Point at products, price tags, labels
- Get product names, prices, expiration dates
- Make informed purchasing decisions independently

### Social Situations

- Use "Social Situation" mode
- Understand who's present and what they're doing
- Get context for social interactions
- Know about seating arrangements and activities

### Technology Help

- Use "Technology Assistant" mode
- Point at computer screens, phone displays, control panels
- Get help with buttons, settings, error messages
- Navigate digital interfaces with confidence

## Advanced Configuration

### Voice Settings

- **Speech Rate**: 0.5x to 2.0x speed
- **Voice Selection**: Choose from available system voices
- **Auto-read**: Toggle automatic reading of results
- **Volume Control**: Adjust speech volume

### Analysis Settings

- **Real-time Analysis**: Continuous vs. on-demand analysis
- **Analysis Frequency**: Every 0.5-5 seconds for real-time
- **Custom Prompts**: Create specialized analysis requests
- **Confidence Thresholds**: Filter low-confidence results

### Privacy & Security

- **Local Processing**: Camera feed stays on your device
- **No Data Storage**: Images are not saved or transmitted
- **Secure Connection**: Encrypted communication with AI server
- **Offline Capable**: Core functionality works without internet

## Technical Setup

### Running the AI Server

```bash
# Install requirements
pip install transformers torch flask flask-cors pillow

# Run the server
python server_working.py
```

### Running the Web Application

```bash
# Serve the files (any static server)
python -m http.server 8080
# or
npx serve .
# or
live-server
```

### Browser Compatibility

- **Chrome/Edge**: Full support with best voice quality
- **Firefox**: Full support with good voice quality
- **Safari**: Full support on macOS/iOS
- **Mobile browsers**: Optimized for touch devices

## Troubleshooting

### Camera Issues

- **"Camera access denied"**: Click camera icon in address bar, allow access
- **"No camera found"**: Check device has working camera, close other apps using camera
- **"Camera not starting"**: Try refreshing page, check browser permissions

### Voice Issues

- **"No voice output"**: Check system volume, browser audio permissions
- **"Robot-like voice"**: Try different voice in settings, update browser
- **"Voice too fast/slow"**: Use Ctrl+Shift+=/- or adjust in voice settings

### AI Server Issues

- **"AI service not connected"**: Check server URL, ensure server is running
- **"Analysis taking too long"**: Check internet connection, server performance
- **"Poor analysis quality"**: Try different analysis modes, better lighting

### General Troubleshooting

1. **Refresh the page** and try again
2. **Check browser console** for error messages (F12)
3. **Test with different browsers**
4. **Ensure good lighting** for camera
5. **Check system audio settings**

## Privacy & Ethics

### Data Protection

- **No image storage**: Photos are processed and immediately discarded
- **Local processing**: Camera feed never leaves your device
- **No user tracking**: No analytics or user behavior monitoring
- **Open source**: Full transparency in code and functionality

### Responsible AI Use

- **Accuracy limitations**: AI descriptions may not be 100% accurate
- **Safety awareness**: Don't rely solely on AI for safety-critical decisions
- **Human verification**: Confirm important information when possible
- **Bias awareness**: AI may have biases in descriptions

## Tips for Best Results

### Camera Positioning

- **Steady hands**: Keep camera as still as possible
- **Good lighting**: Ensure adequate lighting for clear images
- **Close enough**: Get close enough for text to be readable
- **Clean lens**: Keep camera lens clean for best image quality

### Using Voice Feedback

- **Quiet environment**: Use in relatively quiet spaces for best speech clarity
- **Headphones**: Consider headphones for privacy and better audio
- **Interrupt when needed**: Don't hesitate to stop speech (Escape) and ask for repeats
- **Practice shortcuts**: Learn keyboard shortcuts for faster access

### Analysis Optimization

- **Choose right mode**: Select the analysis mode that matches your need
- **Be specific**: Use custom prompts for very specific requirements
- **Real-time vs. single**: Use real-time for continuous monitoring, single shots for detailed analysis
- **Lighting matters**: Better lighting = better AI analysis

## Support & Community

### Getting Help

- **Documentation**: Full setup and usage guides available
- **Issue reporting**: Report bugs and request features
- **Community support**: Connect with other users
- **Accessibility feedback**: Help improve features for blind users

### Contributing

- **Code contributions**: Help improve the application
- **Testing**: Test with different devices and scenarios
- **Documentation**: Help improve guides and instructions
- **Accessibility consulting**: Provide feedback from user experience

## Mobile Usage

### Mobile-Specific Features

- **Touch-optimized controls** for mobile devices
- **Orientation support** for portrait and landscape
- **Gesture shortcuts** for common actions
- **Battery optimization** for extended use

### Mobile Tips

- **Stable mounting**: Use phone tripod or stable surface when possible
- **Voice activation**: Rely more on voice feedback than visual interface
- **Battery management**: Monitor battery life during extended use
- **Network awareness**: Consider data usage with real-time analysis

## Future Enhancements

### Planned Features

- **Voice commands**: Control app with spoken commands
- **Object recognition**: Identify specific objects and their locations
- **Scene understanding**: Better context and spatial relationships
- **Multi-language support**: Analysis and voice feedback in multiple languages
- **Offline AI**: Local AI models for complete offline functionality

### Advanced Capabilities

- **Depth perception**: 3D spatial understanding for better navigation
- **Person identification**: Recognize familiar faces (with permission)
- **Brand recognition**: Enhanced product identification
- **Sign language**: Recognition and interpretation of sign language

---

## Acknowledgments

This application is designed with and for the blind and visually impaired community. Special thanks to accessibility advocates, testers, and contributors who help make technology more inclusive.

**Remember**: This AI vision system is a powerful assistant, but always prioritize your safety and use your best judgment in any situation. The goal is to enhance your independence while maintaining your safety and security.

---

_AI Vision Studio - Empowering independence through artificial intelligence_ 🌟

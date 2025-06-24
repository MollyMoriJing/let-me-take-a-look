/**
 * TextToSpeechManager - Handles text-to-speech functionality for accessibility
 * Provides voice output for analysis results, UI feedback, and navigation
 */
export class TextToSpeechManager {
    constructor(config = {}) {
      this.config = {
        enabled: true,
        autoRead: true,
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        voice: null, // Will be set to best available voice
        language: 'en-US',
        ...config
      }
      
      this.eventBus = config.eventBus
      this.isInitialized = false
      this.isSupported = false
      
      // Speech synthesis
      this.synthesis = null
      this.availableVoices = []
      this.currentUtterance = null
      this.speechQueue = []
      this.isSpeaking = false
      
      // Voice preferences
      this.preferredVoices = [
        'Microsoft Zira - English (United States)',
        'Microsoft David - English (United States)', 
        'Google US English',
        'Alex',
        'Samantha',
        'Karen'
      ]
      
      // Reading modes
      this.readingModes = {
        ANALYSIS: 'analysis',
        UI_FEEDBACK: 'ui_feedback', 
        INSTRUCTIONS: 'instructions',
        ERROR: 'error',
        STATUS: 'status'
      }
      
      // Keyboard shortcuts for voice control
      this.shortcuts = {
        toggleSpeech: 'KeyV',
        stopSpeech: 'Escape',
        repeatLast: 'KeyR',
        speedUp: 'Equal',
        slowDown: 'Minus'
      }
    }
  
    /**
     * Initialize Text-to-Speech Manager
     */
    async initialize() {
      try {
        console.log('🔊 Initializing Text-to-Speech Manager...')
        
        // Check browser support
        this.checkBrowserSupport()
        
        if (!this.isSupported) {
          console.warn('🔊 Speech synthesis not supported in this browser')
          return
        }
        
        // Initialize speech synthesis
        this.synthesis = window.speechSynthesis
        
        // Load available voices
        await this.loadVoices()
        
        // Setup event listeners
        this.setupEventListeners()
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts()
        
        // FIXED: Setup UI controls using existing HTML (don't inject new ones)
        this.setupExistingUIControls()
        
        this.isInitialized = true
        console.log('✅ Text-to-Speech Manager initialized')
        
        // Welcome message
        if (this.config.enabled) {
          this.speak('AI Vision Studio is ready. Text-to-speech is enabled.', {
            mode: this.readingModes.STATUS,
            priority: 'high'
          })
        }
        
      } catch (error) {
        console.error('❌ Text-to-Speech Manager initialization failed:', error)
        throw error
      }
    }
  
    /**
     * Check browser support for speech synthesis
     */
    checkBrowserSupport() {
      this.isSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
      
      if (this.isSupported) {
        console.log('✅ Speech synthesis supported')
      } else {
        console.warn('❌ Speech synthesis not supported')
      }
    }
  
    /**
     * Load available voices
     */
    async loadVoices() {
      return new Promise((resolve) => {
        const loadVoicesImpl = () => {
          this.availableVoices = this.synthesis.getVoices()
          
          if (this.availableVoices.length > 0) {
            console.log(`🔊 Found ${this.availableVoices.length} voices:`)
            this.availableVoices.forEach((voice, index) => {
              console.log(`  ${index + 1}. ${voice.name} (${voice.lang})`)
            })
            
            // Select best voice
            this.selectBestVoice()
            
            // Update voice dropdown if it exists
            this.updateVoiceDropdown()
            
            resolve()
          } else {
            // Voices might not be loaded yet, try again
            setTimeout(loadVoicesImpl, 100)
          }
        }
        
        // Handle voices changed event
        this.synthesis.onvoiceschanged = loadVoicesImpl
        
        // Try to load immediately
        loadVoicesImpl()
      })
    }
  
    /**
     * Select the best available voice
     */
    selectBestVoice() {
      // Filter English voices
      const englishVoices = this.availableVoices.filter(voice => 
        voice.lang.startsWith('en') && !voice.name.includes('Google')
      )
      
      // Try preferred voices first
      for (const preferredName of this.preferredVoices) {
        const voice = englishVoices.find(v => v.name.includes(preferredName))
        if (voice) {
          this.config.voice = voice
          console.log(`🔊 Selected voice: ${voice.name}`)
          return
        }
      }
      
      // Fallback to first English voice
      if (englishVoices.length > 0) {
        this.config.voice = englishVoices[0]
        console.log(`🔊 Selected fallback voice: ${englishVoices[0].name}`)
      } else if (this.availableVoices.length > 0) {
        this.config.voice = this.availableVoices[0]
        console.log(`🔊 Selected default voice: ${this.availableVoices[0].name}`)
      }
    }
  
    /**
     * Update voice dropdown with available voices
     */
    updateVoiceDropdown() {
      const voiceSelect = document.getElementById('voiceSelect')
      if (voiceSelect && this.availableVoices.length > 0) {
        voiceSelect.innerHTML = this.availableVoices.map(voice => 
          `<option value="${voice.name}" ${voice === this.config.voice ? 'selected' : ''}>
            ${voice.name} (${voice.lang})
          </option>`
        ).join('')
      }
    }
  
    /**
     * Setup event listeners
     */
    setupEventListeners() {
      // Listen for analysis results
      this.eventBus?.on('analysis:completed', (event) => {
        if (this.config.autoRead && this.config.enabled) {
          this.readAnalysisResult(event.data)
        }
      })
  
      // Listen for analysis errors
      this.eventBus?.on('analysis:error', (event) => {
        if (this.config.enabled) {
          this.speak(`Analysis error: ${event.data.error}`, {
            mode: this.readingModes.ERROR,
            priority: 'high'
          })
        }
      })
  
      // Listen for camera status changes
      this.eventBus?.on('camera:started', () => {
        if (this.config.enabled) {
          this.speak('Camera started successfully', {
            mode: this.readingModes.STATUS
          })
        }
      })
  
      this.eventBus?.on('camera:stopped', () => {
        if (this.config.enabled) {
          this.speak('Camera stopped', {
            mode: this.readingModes.STATUS
          })
        }
      })
  
      this.eventBus?.on('camera:error', (event) => {
        if (this.config.enabled) {
          this.speak(`Camera error: ${event.data.message}`, {
            mode: this.readingModes.ERROR,
            priority: 'high'
          })
        }
      })
  
      // Listen for AI service status
      this.eventBus?.on('ai:connected', () => {
        if (this.config.enabled) {
          this.speak('AI service connected', {
            mode: this.readingModes.STATUS
          })
        }
      })
  
      this.eventBus?.on('ai:disconnected', () => {
        if (this.config.enabled) {
          this.speak('AI service disconnected', {
            mode: this.readingModes.ERROR
          })
        }
      })
  
      // Listen for realtime analysis toggle
      this.eventBus?.on('realtime:started', () => {
        if (this.config.enabled) {
          this.speak('Real-time analysis started', {
            mode: this.readingModes.STATUS
          })
        }
      })
  
      this.eventBus?.on('realtime:stopped', () => {
        if (this.config.enabled) {
          this.speak('Real-time analysis stopped', {
            mode: this.readingModes.STATUS
          })
        }
      })
  
      // Listen for UI interactions
      this.eventBus?.on('ui:button-clicked', (event) => {
        if (this.config.enabled && event.data.announce) {
          this.speak(event.data.announce, {
            mode: this.readingModes.UI_FEEDBACK
          })
        }
      })
    }
  
    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (event) => {
        // Only handle shortcuts when not typing in inputs
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
          return
        }
  
        const { code, ctrlKey, shiftKey } = event
        
        // Toggle speech (Ctrl+Shift+V)
        if (code === this.shortcuts.toggleSpeech && ctrlKey && shiftKey) {
          event.preventDefault()
          this.toggleSpeech()
        }
        
        // Stop speech (Escape)
        if (code === this.shortcuts.stopSpeech) {
          event.preventDefault()
          this.stopSpeaking()
        }
        
        // Repeat last message (Ctrl+Shift+R)
        if (code === this.shortcuts.repeatLast && ctrlKey && shiftKey) {
          event.preventDefault()
          this.repeatLastMessage()
        }
        
        // Speed up (Ctrl+Shift+=)
        if (code === this.shortcuts.speedUp && ctrlKey && shiftKey) {
          event.preventDefault()
          this.adjustSpeed(0.1)
        }
        
        // Slow down (Ctrl+Shift+-)
        if (code === this.shortcuts.slowDown && ctrlKey && shiftKey) {
          event.preventDefault()
          this.adjustSpeed(-0.1)
        }
  
        // Read current analysis result (Ctrl+Shift+A)
        if (code === 'KeyA' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.readCurrentAnalysis()
        }
  
        // Read instructions (Ctrl+Shift+H)
        if (code === 'KeyH' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.readInstructions()
        }
      })
    }
  
    /**
     * FIXED: Setup UI controls using existing HTML elements (don't inject new ones)
     */
    setupExistingUIControls() {
      console.log('🔊 Setting up existing UI controls...')
      
      // Enable/disable voice
      const enableVoice = document.getElementById('enableVoice')
      if (enableVoice) {
        enableVoice.checked = this.config.enabled
        enableVoice.addEventListener('change', (e) => {
          this.config.enabled = e.target.checked
          this.updateVoiceStatus()
          
          if (this.config.enabled) {
            this.speak('Text-to-speech enabled')
          }
        })
      }
  
      // Auto-read toggle
      const autoRead = document.getElementById('autoReadResults')
      if (autoRead) {
        autoRead.checked = this.config.autoRead
        autoRead.addEventListener('change', (e) => {
          this.config.autoRead = e.target.checked
          
          if (this.config.enabled) {
            this.speak(this.config.autoRead ? 'Auto-read enabled' : 'Auto-read disabled')
          }
        })
      }
  
      // Speech rate slider
      const rateSlider = document.getElementById('speechRate')
      const rateValue = document.querySelector('.slider-value, .mobile-slider-value')
      if (rateSlider) {
        rateSlider.value = this.config.rate
        if (rateValue) rateValue.textContent = `${this.config.rate}x`
        
        rateSlider.addEventListener('input', (e) => {
          this.config.rate = parseFloat(e.target.value)
          if (rateValue) rateValue.textContent = `${this.config.rate}x`
        })
      }
  
      // Voice selection dropdown
      const voiceSelect = document.getElementById('voiceSelect')
      if (voiceSelect) {
        voiceSelect.addEventListener('change', (e) => {
          const selectedVoice = this.availableVoices.find(voice => voice.name === e.target.value)
          if (selectedVoice) {
            this.config.voice = selectedVoice
            console.log(`🔊 Voice changed to: ${selectedVoice.name}`)
          }
        })
      }
  
      // Test voice button
      const testBtn = document.getElementById('testVoiceBtn')
      if (testBtn) {
        testBtn.addEventListener('click', () => {
          this.speak('This is a test of the text-to-speech system. The AI can now describe what it sees and read it aloud for accessibility.', {
            priority: 'high'
          })
        })
      }
  
      // Stop voice button
      const stopBtn = document.getElementById('stopVoiceBtn')
      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          this.stopSpeaking()
        })
      }
  
      // Update initial status
      this.updateVoiceStatus()
    }
  
    /**
     * Main speak function
     */
    speak(text, options = {}) {
      if (!this.isSupported || !this.config.enabled || !text) {
        return Promise.resolve()
      }
  
      const {
        mode = this.readingModes.ANALYSIS,
        priority = 'normal',
        rate = this.config.rate,
        pitch = this.config.pitch,
        volume = this.config.volume,
        interrupt = priority === 'high'
      } = options
  
      return new Promise((resolve, reject) => {
        // Stop current speech if high priority or interrupt requested
        if (interrupt && this.isSpeaking) {
          this.synthesis.cancel()
        }
  
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text)
        
        // Configure utterance
        utterance.voice = this.config.voice
        utterance.rate = rate
        utterance.pitch = pitch
        utterance.volume = volume
        utterance.lang = this.config.language
  
        // Event handlers
        utterance.onstart = () => {
          this.isSpeaking = true
          this.currentUtterance = utterance
          console.log(`🔊 Speaking: ${text.substring(0, 50)}...`)
        }
  
        utterance.onend = () => {
          this.isSpeaking = false
          this.currentUtterance = null
          resolve()
        }
  
        utterance.onerror = (error) => {
          this.isSpeaking = false
          this.currentUtterance = null
          console.error('🔊 Speech error:', error)
          reject(error)
        }
  
        // Store last message for repeat functionality
        this.lastMessage = { text, options }
  
        // Speak
        this.synthesis.speak(utterance)
      })
    }
  
    /**
     * Read analysis result with appropriate formatting
     */
    readAnalysisResult(analysisData) {
      if (!analysisData || !analysisData.content) return
  
      let textToRead = analysisData.content
  
      // Add context for better understanding
      if (analysisData.realtime) {
        textToRead = `Live analysis: ${textToRead}`
      } else {
        textToRead = `Analysis result: ${textToRead}`
      }
  
      // Add confidence information if available
      if (analysisData.confidence && analysisData.confidence > 0) {
        textToRead += ` Confidence: ${Math.round(analysisData.confidence)}%`
      }
  
      this.speak(textToRead, {
        mode: this.readingModes.ANALYSIS,
        priority: analysisData.realtime ? 'normal' : 'high'
      })
    }
  
    /**
     * Read current analysis result
     */
    readCurrentAnalysis() {
      const analysisContent = document.getElementById('analysisContent')
      if (!analysisContent || !analysisContent.textContent.trim()) {
        this.speak('No analysis result available', {
          mode: this.readingModes.UI_FEEDBACK,
          priority: 'high'
        })
        return
      }
  
      const text = analysisContent.textContent.trim()
      this.speak(`Current analysis: ${text}`, {
        mode: this.readingModes.ANALYSIS,
        priority: 'high'
      })
    }
  
    /**
     * Read instructions for blind users
     */
    readInstructions() {
      const instructions = `
  AI Vision Studio Instructions:
  Use Ctrl+C to start or stop the camera.
  Press Spacebar to capture a frame.
  Use Ctrl+R to toggle real-time analysis.
  Press Ctrl+A to analyze the current frame.
  Use Ctrl+Shift+V to toggle text-to-speech.
  Press Escape to stop speech.
  Use Ctrl+Shift+R to repeat the last message.
  Use Ctrl+Shift+A to read the current analysis result.
  The AI will automatically describe what it sees when analysis completes.
      `
  
      this.speak(instructions, {
        mode: this.readingModes.INSTRUCTIONS,
        priority: 'high'
      })
    }
  
    /**
     * Toggle speech on/off
     */
    toggleSpeech() {
      this.config.enabled = !this.config.enabled
      this.updateVoiceStatus()
  
      const enableToggle = document.getElementById('enableVoice')
      if (enableToggle) {
        enableToggle.checked = this.config.enabled
      }
  
      if (this.config.enabled) {
        this.speak('Text-to-speech enabled')
      } else {
        // Can't speak when disabled, so just update UI
        console.log('🔊 Text-to-speech disabled')
      }
    }
  
    /**
     * Stop current speech
     */
    stopSpeaking() {
      if (this.synthesis) {
        this.synthesis.cancel()
        this.isSpeaking = false
        this.currentUtterance = null
        console.log('🔊 Speech stopped')
      }
    }
  
    /**
     * Repeat last message
     */
    repeatLastMessage() {
      if (this.lastMessage) {
        this.speak(this.lastMessage.text, {
          ...this.lastMessage.options,
          priority: 'high'
        })
      } else {
        this.speak('No previous message to repeat', {
          mode: this.readingModes.UI_FEEDBACK,
          priority: 'high'
        })
      }
    }
  
    /**
     * Adjust speech rate
     */
    adjustSpeed(delta) {
      this.config.rate = Math.max(0.5, Math.min(2.0, this.config.rate + delta))
      
      const rateSlider = document.getElementById('speechRate')
      const rateValue = document.querySelector('.slider-value, .mobile-slider-value')
      
      if (rateSlider) rateSlider.value = this.config.rate
      if (rateValue) rateValue.textContent = `${this.config.rate}x`
  
      this.speak(`Speech rate: ${this.config.rate.toFixed(1)}x`, {
        mode: this.readingModes.UI_FEEDBACK
      })
    }
  
    /**
     * Update voice status in UI
     */
    updateVoiceStatus() {
      // Update main voice status
      const statusDot = document.getElementById('voiceStatusDot')
      const statusText = document.getElementById('voiceStatusText')
  
      if (statusDot) {
        statusDot.className = `status-dot ${this.config.enabled ? 'connected' : 'disconnected'}`
      }
  
      if (statusText) {
        statusText.textContent = this.config.enabled ? 'Enabled' : 'Disabled'
      }
  
      // Update any other voice status indicators
      const voiceStatus = document.getElementById('voiceStatus')
      if (voiceStatus) {
        const dot = voiceStatus.querySelector('.status-dot')
        const text = voiceStatus.querySelector('span')
        
        if (dot) {
          dot.className = `status-dot ${this.config.enabled ? 'connected' : 'disconnected'}`
        }
        if (text) {
          text.textContent = this.config.enabled ? 'Enabled' : 'Disabled'
        }
      }
    }
  
    /**
     * Get TTS status
     */
    getStatus() {
      return {
        isInitialized: this.isInitialized,
        isSupported: this.isSupported,
        enabled: this.config.enabled,
        autoRead: this.config.autoRead,
        isSpeaking: this.isSpeaking,
        availableVoices: this.availableVoices.length,
        currentVoice: this.config.voice?.name || 'None',
        rate: this.config.rate,
        lastMessage: this.lastMessage?.text?.substring(0, 50) || 'None'
      }
    }
  
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig }
      console.log('🔊 TTS configuration updated')
    }
  
    /**
     * Shutdown TTS manager
     */
    async shutdown() {
      console.log('🔊 Shutting down Text-to-Speech Manager...')
      
      this.stopSpeaking()
      this.speechQueue = []
      this.isInitialized = false
      
      console.log('✅ Text-to-Speech Manager shut down')
    }
  }
  
  export default TextToSpeechManager
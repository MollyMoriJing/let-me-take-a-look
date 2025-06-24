/**
 * TextToSpeechManager - Enhanced version with better error handling and reliability
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
      voice: null,
      language: 'en-US',
      maxRetries: 3,
      retryDelay: 1000,
      speechTimeout: 30000, // 30 seconds max per utterance
      maxChunkLength: 200, // Break long text into chunks
      ...config
    }
    
    this.eventBus = config.eventBus
    this.isInitialized = false
    this.isSupported = false
    
    // Enhanced state tracking
    this.synthesis = null
    this.availableVoices = []
    this.currentUtterance = null
    this.speechQueue = []
    this.isSpeaking = false
    this.isLoading = false
    
    // Voice loading state
    this.voiceLoadingPromise = null
    this.voiceLoadingTimeout = null
    this.retryCount = 0
    
    // Track utterances for cleanup
    this.activeUtterances = new Set()
    this.utteranceTimeouts = new Map()
    
    // Chrome pause/resume fix for long text
    this.resumeInterval = null
    
    // Voice preferences with fallbacks
    this.preferredVoices = [
      'Microsoft Zira - English (United States)',
      'Microsoft David - English (United States)', 
      'Google US English',
      'Alex',
      'Samantha',
      'Karen',
      'Daniel',
      'Moira',
      'Tessa'
    ]
    
    // Reading modes
    this.readingModes = {
      ANALYSIS: 'analysis',
      UI_FEEDBACK: 'ui_feedback', 
      INSTRUCTIONS: 'instructions',
      ERROR: 'error',
      STATUS: 'status'
    }
    
    // Message history for repeat functionality
    this.messageHistory = []
    this.maxHistorySize = 10
    this.lastMessage = null
    
    // User interaction tracking (required for mobile)
    this.hasUserInteracted = false
    this.setupUserInteractionTracking()
  }

  /**
   * Setup user interaction tracking for mobile browsers
   */
  setupUserInteractionTracking() {
    const trackInteraction = () => {
      this.hasUserInteracted = true
      console.log('🔊 User interaction detected - TTS unlocked')
      
      // Remove listeners after first interaction
      document.removeEventListener('click', trackInteraction)
      document.removeEventListener('touchstart', trackInteraction)
      document.removeEventListener('keydown', trackInteraction)
    }
    
    document.addEventListener('click', trackInteraction, { passive: true })
    document.addEventListener('touchstart', trackInteraction, { passive: true })
    document.addEventListener('keydown', trackInteraction, { passive: true })
  }

  /**
   * Initialize Text-to-Speech Manager with enhanced error handling
   */
  async initialize() {
    try {
      console.log('🔊 Initializing Enhanced Text-to-Speech Manager...')
      
      // Check browser support
      this.checkBrowserSupport()
      
      if (!this.isSupported) {
        console.warn('🔊 Speech synthesis not supported in this browser')
        this.setupFallbackMode()
        return
      }
      
      // Initialize speech synthesis
      this.synthesis = window.speechSynthesis
      
      // Setup synthesis event handlers
      this.setupSynthesisEventHandlers()
      
      // Load available voices with timeout
      await this.loadVoicesWithRetry()
      
      // Setup event listeners
      this.setupEventListeners()
      
      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts()
      
      // Setup UI controls
      await this.setupExistingUIControls()
      
      this.isInitialized = true
      console.log('✅ Enhanced Text-to-Speech Manager initialized')
      
      // Test speech on first user interaction
      this.scheduleWelcomeMessage()
      
    } catch (error) {
      console.error('❌ Text-to-Speech Manager initialization failed:', error)
      this.setupFallbackMode()
      throw error
    }
  }

  /**
   * Schedule welcome message for when user interacts
   */
  scheduleWelcomeMessage() {
    const checkAndWelcome = () => {
      if (this.hasUserInteracted && this.config.enabled) {
        this.speak('Text-to-speech system ready. Press Ctrl+Shift+H for voice instructions.', {
          mode: this.readingModes.STATUS,
          priority: 'normal'
        })
      } else {
        setTimeout(checkAndWelcome, 1000)
      }
    }
    
    setTimeout(checkAndWelcome, 2000)
  }

  /**
   * Enhanced browser support check
   */
  checkBrowserSupport() {
    this.isSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
    
    if (this.isSupported) {
      console.log('✅ Speech synthesis supported')
      
      // Check for known limitations
      const userAgent = navigator.userAgent.toLowerCase()
      if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        console.warn('⚠️ Safari detected - some features may be limited')
      }
      
      if (userAgent.includes('firefox')) {
        console.log('🦊 Firefox detected - using Firefox optimizations')
      }
      
      // Check for mobile
      if (/mobile|android|iphone|ipad/.test(userAgent)) {
        console.log('📱 Mobile browser detected - user interaction required')
      }
      
    } else {
      console.warn('❌ Speech synthesis not supported')
    }
  }

  /**
   * Setup fallback mode for unsupported browsers
   */
  setupFallbackMode() {
    console.log('🔊 Setting up fallback mode (visual indicators only)')
    this.isSupported = false
    this.config.enabled = false
    
    // Still setup UI controls for consistency
    this.setupExistingUIControls()
  }

  /**
   * Setup synthesis global event handlers with Chrome fix
   */
  setupSynthesisEventHandlers() {
    if (!this.synthesis) return
    
    // Handle synthesis resume (Chrome pauses after ~15 seconds)
    const resumeSynthesis = () => {
      if (this.synthesis.paused && this.isSpeaking) {
        console.log('🔊 Resuming speech synthesis (Chrome fix)')
        this.synthesis.resume()
      }
    }
    
    // Resume synthesis every 14 seconds to prevent Chrome cutoff
    this.resumeInterval = setInterval(resumeSynthesis, 14000)
  }

  /**
   * Load voices with retry mechanism
   */
  async loadVoicesWithRetry() {
    if (this.voiceLoadingPromise) {
      return this.voiceLoadingPromise
    }
    
    this.voiceLoadingPromise = new Promise(async (resolve, reject) => {
      const maxAttempts = 5
      const timeoutMs = 8000
      
      // Set overall timeout
      this.voiceLoadingTimeout = setTimeout(() => {
        console.warn('🔊 Voice loading timeout, using fallback')
        this.selectFallbackVoice()
        resolve()
      }, timeoutMs)
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`🔊 Loading voices (attempt ${attempt}/${maxAttempts})...`)
          
          const voices = await this.loadVoicesAttempt()
          
          if (voices && voices.length > 0) {
            clearTimeout(this.voiceLoadingTimeout)
            this.availableVoices = voices
            this.selectBestVoice()
            this.updateVoiceDropdown()
            console.log(`✅ Successfully loaded ${voices.length} voices`)
            resolve()
            return
          }
          
          if (attempt < maxAttempts) {
            await this.delay(500 * attempt) // Exponential backoff
          }
          
        } catch (error) {
          console.warn(`🔊 Voice loading attempt ${attempt} failed:`, error)
          if (attempt === maxAttempts) {
            this.selectFallbackVoice()
            resolve()
          }
        }
      }
    })
    
    return this.voiceLoadingPromise
  }

  /**
   * Single voice loading attempt with better event handling
   */
  loadVoicesAttempt() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Voice loading attempt timeout'))
      }, 3000)
      
      const loadVoices = () => {
        try {
          const voices = this.synthesis.getVoices()
          clearTimeout(timeout)
          console.log(`🔊 Found ${voices.length} voices`)
          resolve(voices)
        } catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      }
      
      // Try immediate loading first
      const immediateVoices = this.synthesis.getVoices()
      if (immediateVoices && immediateVoices.length > 0) {
        clearTimeout(timeout)
        resolve(immediateVoices)
        return
      }
      
      // Wait for voiceschanged event
      if (this.synthesis.onvoiceschanged !== undefined) {
        const handler = () => {
          this.synthesis.onvoiceschanged = null
          loadVoices()
        }
        this.synthesis.onvoiceschanged = handler
        
        // Also try loading after a delay
        setTimeout(() => {
          if (this.synthesis.onvoiceschanged === handler) {
            this.synthesis.onvoiceschanged = null
            loadVoices()
          }
        }, 1000)
      } else {
        // Fallback for browsers without voiceschanged
        setTimeout(loadVoices, 100)
      }
    })
  }

  /**
   * Select the best available voice with enhanced logic
   */
  selectBestVoice() {
    if (!this.availableVoices.length) {
      this.selectFallbackVoice()
      return
    }
    
    // Filter English voices
    const englishVoices = this.availableVoices.filter(voice => 
      voice.lang.toLowerCase().startsWith('en')
    )
    
    // Prefer local voices over remote (fixes Chrome timeout issues)
    const localVoices = englishVoices.filter(voice => voice.localService)
    const voicesToCheck = localVoices.length > 0 ? localVoices : englishVoices
    
    console.log(`🔊 Found ${localVoices.length} local voices, ${englishVoices.length} total English voices`)
    
    // Try preferred voices first
    for (const preferredName of this.preferredVoices) {
      const voice = voicesToCheck.find(v => 
        v.name.toLowerCase().includes(preferredName.toLowerCase())
      )
      if (voice) {
        this.config.voice = voice
        console.log(`🔊 Selected preferred voice: ${voice.name} (local: ${voice.localService})`)
        return
      }
    }
    
    // Fallback to default voice
    const defaultVoice = voicesToCheck.find(voice => voice.default)
    if (defaultVoice) {
      this.config.voice = defaultVoice
      console.log(`🔊 Selected default voice: ${defaultVoice.name} (local: ${defaultVoice.localService})`)
      return
    }
    
    // Final fallback to first available voice
    if (voicesToCheck.length > 0) {
      this.config.voice = voicesToCheck[0]
      console.log(`🔊 Selected first available voice: ${voicesToCheck[0].name} (local: ${voicesToCheck[0].localService})`)
    } else {
      this.selectFallbackVoice()
    }
  }

  /**
   * Select fallback voice when no voices are available
   */
  selectFallbackVoice() {
    this.config.voice = {
      name: 'System Default',
      lang: 'en-US',
      default: true,
      localService: true
    }
    console.log('🔊 Using system default voice as fallback')
  }

  /**
   * Update voice dropdown with available voices
   */
  updateVoiceDropdown() {
    const voiceSelect = document.getElementById('voiceSelect')
    if (voiceSelect && this.availableVoices.length > 0) {
      const options = this.availableVoices
        .filter(voice => voice.lang.toLowerCase().startsWith('en')) // Only English voices
        .map(voice => {
          const isSelected = voice === this.config.voice
          const localIndicator = voice.localService ? ' 🔒' : ' 🌐'
          return `<option value="${voice.name}" ${isSelected ? 'selected' : ''}>
            ${voice.name} (${voice.lang})${localIndicator}
          </option>`
        }).join('')
      
      voiceSelect.innerHTML = options || '<option>No English voices found</option>'
    }
  }

  /**
   * Enhanced event listeners setup
   */
  setupEventListeners() {
    if (!this.eventBus) return
    
    // Listen for analysis results with error handling
    this.eventBus.on('analysis:completed', (event) => {
      try {
        if (this.config.autoRead && this.config.enabled && event.data) {
          this.readAnalysisResult(event.data)
        }
      } catch (error) {
        console.error('🔊 Error reading analysis result:', error)
      }
    })

    // Listen for analysis errors
    this.eventBus.on('analysis:error', (event) => {
      try {
        if (this.config.enabled && event.data) {
          this.speak(`Analysis error: ${event.data.error}`, {
            mode: this.readingModes.ERROR,
            priority: 'high'
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing analysis error:', error)
      }
    })

    // Listen for camera status changes
    this.eventBus.on('camera:started', () => {
      try {
        if (this.config.enabled) {
          this.speak('Camera started successfully', {
            mode: this.readingModes.STATUS
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing camera start:', error)
      }
    })

    this.eventBus.on('camera:stopped', () => {
      try {
        if (this.config.enabled) {
          this.speak('Camera stopped', {
            mode: this.readingModes.STATUS
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing camera stop:', error)
      }
    })

    this.eventBus.on('camera:error', (event) => {
      try {
        if (this.config.enabled && event.data) {
          this.speak(`Camera error: ${event.data.message}`, {
            mode: this.readingModes.ERROR,
            priority: 'high'
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing camera error:', error)
      }
    })

    // AI service status
    this.eventBus.on('ai:connected', () => {
      try {
        if (this.config.enabled) {
          this.speak('AI service connected', {
            mode: this.readingModes.STATUS
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing AI connection:', error)
      }
    })

    this.eventBus.on('ai:disconnected', () => {
      try {
        if (this.config.enabled) {
          this.speak('AI service disconnected', {
            mode: this.readingModes.ERROR
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing AI disconnection:', error)
      }
    })

    // Realtime analysis events
    this.eventBus.on('realtime:started', () => {
      try {
        if (this.config.enabled) {
          this.speak('Real-time analysis started', {
            mode: this.readingModes.STATUS
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing realtime start:', error)
      }
    })

    this.eventBus.on('realtime:stopped', () => {
      try {
        if (this.config.enabled) {
          this.speak('Real-time analysis stopped', {
            mode: this.readingModes.STATUS
          })
        }
      } catch (error) {
        console.error('🔊 Error announcing realtime stop:', error)
      }
    })
  }

  /**
   * Enhanced keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Only handle shortcuts when not typing in inputs
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return
      }

      const { code, ctrlKey, shiftKey } = event
      
      try {
        // Toggle speech (Ctrl+Shift+V)
        if (code === 'KeyV' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.toggleSpeech()
        }
        
        // Stop speech (Escape)
        if (code === 'Escape') {
          event.preventDefault()
          this.stopSpeaking()
        }
        
        // Repeat last message (Ctrl+Shift+R)
        if (code === 'KeyR' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.repeatLastMessage()
        }
        
        // Speed up (Ctrl+Shift+=)
        if (code === 'Equal' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.adjustSpeed(0.1)
        }
        
        // Slow down (Ctrl+Shift+-)
        if (code === 'Minus' && ctrlKey && shiftKey) {
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
        
      } catch (error) {
        console.error('🔊 Keyboard shortcut error:', error)
      }
    })
  }

  /**
   * Enhanced UI controls setup
   */
  async setupExistingUIControls() {
    try {
      console.log('🔊 Setting up existing UI controls...')
      
      // Wait a bit for DOM to be fully ready
      await this.delay(500)
      
      // Enable/disable voice
      const enableVoice = document.getElementById('enableVoice')
      if (enableVoice) {
        enableVoice.checked = this.config.enabled
        enableVoice.addEventListener('change', (e) => {
          this.config.enabled = e.target.checked
          this.updateVoiceStatus()
          
          if (this.config.enabled && this.isSupported && this.hasUserInteracted) {
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
          
          if (this.config.enabled && this.isSupported && this.hasUserInteracted) {
            this.speak(this.config.autoRead ? 'Auto-read enabled' : 'Auto-read disabled')
          }
        })
      }

      // Speech rate slider
      const rateSlider = document.getElementById('speechRate')
      const rateValue = document.querySelector('.slider-value')
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
            
            if (this.config.enabled && this.hasUserInteracted) {
              this.speak('Voice changed', { voice: selectedVoice })
            }
          }
        })
      }

      // Test voice button
      const testBtn = document.getElementById('testVoiceBtn')
      if (testBtn) {
        testBtn.addEventListener('click', () => {
          // Ensure user interaction is tracked
          this.hasUserInteracted = true
          
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
      
    } catch (error) {
      console.error('🔊 Error setting up UI controls:', error)
    }
  }

  /**
   * Break long text into chunks to prevent Chrome timeout
   */
  breakIntoChunks(text) {
    if (text.length <= this.config.maxChunkLength) {
      return [text]
    }
    
    const chunks = []
    const sentences = text.split(/[.!?]+/)
    let currentChunk = ''
    
    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue
      
      const trimmedSentence = sentence.trim() + '. '
      
      if ((currentChunk + trimmedSentence).length > this.config.maxChunkLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = trimmedSentence
        } else {
          // Sentence is too long, break it by words
          const words = trimmedSentence.split(' ')
          let wordChunk = ''
          for (const word of words) {
            if ((wordChunk + word + ' ').length > this.config.maxChunkLength) {
              if (wordChunk) {
                chunks.push(wordChunk.trim())
                wordChunk = word + ' '
              } else {
                chunks.push(word) // Single word too long
              }
            } else {
              wordChunk += word + ' '
            }
          }
          if (wordChunk) {
            currentChunk = wordChunk
          }
        }
      } else {
        currentChunk += trimmedSentence
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks.filter(chunk => chunk.length > 0)
  }

  /**
   * Enhanced speak function with chunking and better error handling
   */
  speak(text, options = {}) {
    if (!this.isSupported || !this.config.enabled || !text) {
      return Promise.resolve()
    }

    // Check for user interaction on mobile
    if (!this.hasUserInteracted) {
      console.warn('🔊 Cannot speak - user interaction required (mobile browser)')
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        const {
          mode = this.readingModes.ANALYSIS,
          priority = 'normal',
          rate = this.config.rate,
          pitch = this.config.pitch,
          volume = this.config.volume,
          voice = this.config.voice,
          interrupt = priority === 'high'
        } = options

        // Stop current speech if high priority or interrupt requested
        if (interrupt && this.activeUtterances.size > 0) {
          this.stopSpeaking()
        }

        // Clean text for better speech
        const cleanText = this.cleanTextForSpeech(text)
        
        // Break into chunks to prevent Chrome timeout
        const chunks = this.breakIntoChunks(cleanText)
        console.log(`🔊 Speaking ${chunks.length} chunks for: "${cleanText.substring(0, 50)}..."`)
        
        // Speak chunks sequentially
        this.speakChunks(chunks, options).then(resolve).catch(reject)
        
      } catch (error) {
        console.error('🔊 Speech setup error:', error)
        reject(error)
      }
    })
  }

  /**
   * Speak chunks sequentially
   */
  async speakChunks(chunks, options = {}) {
    const {
      rate = this.config.rate,
      pitch = this.config.pitch,
      volume = this.config.volume,
      voice = this.config.voice
    } = options

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      
      await new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        
        // Track utterance for cleanup
        this.activeUtterances.add(utterance)
        
        // Configure utterance with validation
        if (voice && voice.name !== 'System Default') {
          utterance.voice = voice
        }
        utterance.rate = Math.max(0.1, Math.min(2.0, rate))
        utterance.pitch = Math.max(0, Math.min(2.0, pitch))
        utterance.volume = Math.max(0, Math.min(1.0, volume))
        utterance.lang = this.config.language

        // Add timeout to prevent hanging
        const timeoutMs = Math.max(this.config.speechTimeout, chunk.length * 100)
        const timeout = setTimeout(() => {
          console.warn('🔊 Speech chunk timeout, forcing end')
          this.cleanupUtterance(utterance)
          reject(new Error('Speech timeout'))
        }, timeoutMs)

        this.utteranceTimeouts.set(utterance, timeout)

        // Enhanced event handlers
        utterance.onstart = () => {
          this.clearUtteranceTimeout(utterance)
          this.isSpeaking = true
          if (i === 0) {
            this.currentUtterance = utterance
            console.log(`🔊 Speaking chunk ${i + 1}/${chunks.length}: ${chunk.substring(0, 50)}...`)
          }
        }

        utterance.onend = () => {
          this.cleanupUtterance(utterance)
          this.isSpeaking = this.activeUtterances.size > 0
          if (!this.isSpeaking) {
            this.currentUtterance = null
          }
          resolve()
        }

        utterance.onerror = (error) => {
          console.error('🔊 Speech chunk error:', error)
          this.cleanupUtterance(utterance)
          this.isSpeaking = this.activeUtterances.size > 0
          
          // Don't reject on individual chunk errors for long text
          if (chunks.length > 1) {
            console.log('🔊 Continuing with next chunk despite error')
            resolve()
          } else {
            reject(error)
          }
        }

        // Store last message for repeat functionality
        if (i === 0) {
          this.addToHistory({ text: chunks.join(' '), options })
        }

        // Speak with error handling
        try {
          this.synthesis.speak(utterance)
          
          // Reset retry count on successful start
          this.retryCount = 0
          
        } catch (error) {
          this.cleanupUtterance(utterance)
          console.error('🔊 Failed to start speaking chunk:', error)
          reject(error)
        }
      })
      
      // Small delay between chunks
      if (i < chunks.length - 1) {
        await this.delay(100)
      }
    }
  }

  /**
   * Clean text for better speech synthesis
   */
  cleanTextForSpeech(text) {
    return text
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Add space after punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?;:()-]/g, '') // Remove special characters
      .trim()
  }

  /**
   * Cleanup utterance and associated resources
   */
  cleanupUtterance(utterance) {
    this.activeUtterances.delete(utterance)
    this.clearUtteranceTimeout(utterance)
  }

  /**
   * Clear utterance timeout
   */
  clearUtteranceTimeout(utterance) {
    const timeout = this.utteranceTimeouts.get(utterance)
    if (timeout) {
      clearTimeout(timeout)
      this.utteranceTimeouts.delete(utterance)
    }
  }

  /**
   * Add message to history
   */
  addToHistory(message) {
    this.messageHistory.unshift(message)
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(0, this.maxHistorySize)
    }
    this.lastMessage = message
  }

  /**
   * Enhanced stop function
   */
  stopSpeaking() {
    try {
      if (this.synthesis) {
        this.synthesis.cancel()
      }
      
      // Clean up all active utterances
      for (const utterance of this.activeUtterances) {
        this.clearUtteranceTimeout(utterance)
      }
      this.activeUtterances.clear()
      this.utteranceTimeouts.clear()
      
      this.isSpeaking = false
      this.currentUtterance = null
      
      console.log('🔊 Speech stopped and cleaned up')
      
    } catch (error) {
      console.error('🔊 Error stopping speech:', error)
    }
  }

  /**
   * Read analysis result with enhanced formatting
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
    try {
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
    } catch (error) {
      console.error('🔊 Error reading current analysis:', error)
    }
  }

  /**
   * Read comprehensive instructions for blind users
   */
  readInstructions() {
    const instructions = `
AI Vision Studio Instructions for Accessibility:

Camera Controls:
Use Control C to start or stop the camera.
Press Spacebar to capture a frame for analysis.

Analysis Controls:
Use Control R to toggle real-time analysis.
Press Control A to analyze the current frame.
Press F1 for quick analysis with voice feedback.

Voice Controls:
Use Control Shift V to toggle text-to-speech on or off.
Press Escape to stop speech immediately.
Use Control Shift R to repeat the last message.
Use Control Shift A to read the current analysis result.
Press F2 to hear the system status.

The AI will automatically describe what it sees when analysis completes.
This application is designed to help blind and visually impaired users understand their surroundings through detailed image descriptions.
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
    try {
      this.config.enabled = !this.config.enabled
      this.updateVoiceStatus()

      const enableToggle = document.getElementById('enableVoice')
      if (enableToggle) {
        enableToggle.checked = this.config.enabled
      }

      if (this.config.enabled && this.isSupported && this.hasUserInteracted) {
        this.speak('Text-to-speech enabled')
      } else {
        console.log('🔊 Text-to-speech disabled')
      }
    } catch (error) {
      console.error('🔊 Error toggling speech:', error)
    }
  }

  /**
   * Repeat last message
   */
  repeatLastMessage() {
    try {
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
    } catch (error) {
      console.error('🔊 Error repeating message:', error)
    }
  }

  /**
   * Adjust speech rate
   */
  adjustSpeed(delta) {
    try {
      this.config.rate = Math.max(0.5, Math.min(2.0, this.config.rate + delta))
      
      const rateSlider = document.getElementById('speechRate')
      const rateValue = document.querySelector('.slider-value')
      
      if (rateSlider) rateSlider.value = this.config.rate
      if (rateValue) rateValue.textContent = `${this.config.rate}x`

      this.speak(`Speech rate: ${this.config.rate.toFixed(1)}x`, {
        mode: this.readingModes.UI_FEEDBACK
      })
    } catch (error) {
      console.error('🔊 Error adjusting speed:', error)
    }
  }

  /**
   * Update voice status in UI
   */
  updateVoiceStatus() {
    try {
      // Update main voice status
      const statusDot = document.getElementById('voiceStatusDot')
      const statusText = document.getElementById('voiceStatusText')

      if (statusDot) {
        statusDot.className = `status-dot ${this.config.enabled && this.isSupported ? 'connected' : 'disconnected'}`
      }

      if (statusText) {
        let statusMessage = 'Disabled'
        if (this.config.enabled && this.isSupported) {
          if (this.hasUserInteracted) {
            statusMessage = 'Ready'
          } else {
            statusMessage = 'Click to enable'
          }
        }
        statusText.textContent = statusMessage
      }

      // Update any other voice status indicators
      const voiceStatus = document.getElementById('voiceStatus')
      if (voiceStatus) {
        const dot = voiceStatus.querySelector('.status-dot')
        const text = voiceStatus.querySelector('span')
        
        if (dot) {
          dot.className = `status-dot ${this.config.enabled && this.isSupported ? 'connected' : 'disconnected'}`
        }
        if (text) {
          text.textContent = this.config.enabled && this.isSupported ? 'Enabled' : 'Disabled'
        }
      }

      // Emit status change event
      if (this.eventBus) {
        this.eventBus.emit(this.config.enabled ? 'tts:enabled' : 'tts:disabled')
      }
    } catch (error) {
      console.error('🔊 Error updating voice status:', error)
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get comprehensive TTS status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isSupported: this.isSupported,
      enabled: this.config.enabled,
      autoRead: this.config.autoRead,
      isSpeaking: this.isSpeaking,
      hasUserInteracted: this.hasUserInteracted,
      availableVoices: this.availableVoices.length,
      currentVoice: this.config.voice?.name || 'None',
      rate: this.config.rate,
      pitch: this.config.pitch,
      volume: this.config.volume,
      language: this.config.language,
      activeUtterances: this.activeUtterances.size,
      messageHistory: this.messageHistory.length,
      lastMessage: this.lastMessage?.text?.substring(0, 50) || 'None',
      retryCount: this.retryCount,
      isLoading: this.isLoading
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig }
      this.updateVoiceStatus()
      console.log('🔊 TTS configuration updated:', newConfig)
    } catch (error) {
      console.error('🔊 Error updating config:', error)
    }
  }

  /**
   * Enhanced shutdown with proper cleanup
   */
  async shutdown() {
    console.log('🔊 Shutting down Enhanced Text-to-Speech Manager...')
    
    try {
      // Clear Chrome fix interval
      if (this.resumeInterval) {
        clearInterval(this.resumeInterval)
        this.resumeInterval = null
      }
      
      // Clear timeouts
      if (this.voiceLoadingTimeout) {
        clearTimeout(this.voiceLoadingTimeout)
      }
      
      // Stop all speech and clean up
      this.stopSpeaking()
      
      // Clear all timeouts
      for (const timeout of this.utteranceTimeouts.values()) {
        clearTimeout(timeout)
      }
      this.utteranceTimeouts.clear()
      
      // Clear voice loading promise
      this.voiceLoadingPromise = null
      
      // Clear history
      this.messageHistory = []
      this.lastMessage = null
      
      // Reset state
      this.isInitialized = false
      this.retryCount = 0
      this.isLoading = false
      
      console.log('✅ Enhanced Text-to-Speech Manager shut down')
      
    } catch (error) {
      console.error('❌ TTS shutdown error:', error)
    }
  }
}

export default TextToSpeechManager
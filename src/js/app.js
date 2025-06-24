import { CameraManager } from './modules/CameraManager.js'
import { AIService } from './modules/AIService.js'
import { UIManager } from './modules/UIManager.js'
import { PerformanceMonitor } from './modules/PerformanceMonitor.js'
import { AnalysisEngine } from './modules/AnalysisEngine.js'
import { EventBus } from './modules/EventBus.js'
import { TextToSpeechManager } from './modules/TextToSpeechManager.js'

/**
 * AI Vision Studio - Main Application Class
 * Enhanced with Text-to-Speech for accessibility (Eyes for the Blind)
 * Orchestrates all components and manages the application lifecycle
 */
class AIVisionStudio {
  constructor() {
    this.version = '2.1.0' // Bumped version for TTS integration
    this.isInitialized = false
    this.components = new Map()
    
    // Application state
    this.state = {
      cameraActive: false,
      realtimeEnabled: false,
      aiConnected: false,
      isProcessing: false,
      voiceEnabled: true, // New: TTS enabled by default for accessibility
      currentSession: null
    }
    
    this.config = {
      camera: {
        resolution: { width: 1280, height: 720 },
        fps: 30,
        facingMode: 'user'
      },
      ai: {
        serverUrl: 'http://localhost:8000',
        timeout: 30000,
        retryAttempts: 3
      },
      analysis: {
        defaultPrompt: 'Describe what you see in this image in detail. Include information about people, objects, colors, text, and the overall scene.',
        maxTokens: 300, // Increased for more detailed descriptions
        temperature: 0.7
      },
      performance: {
        enableMonitoring: true,
        updateInterval: 1000
      },
      // New: Text-to-Speech configuration
      tts: {
        enabled: true,
        autoRead: true,
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        language: 'en-US'
      }
    }
    
    this.initialize()
  }

  /**
   * Setup component dependencies after initialization
   */
  setupComponentDependencies() {
    const cameraManager = this.components.get('cameraManager')
    const aiService = this.components.get('aiService')
    const uiManager = this.components.get('uiManager')
    const analysisEngine = this.components.get('analysisEngine')
    const ttsManager = this.components.get('ttsManager') // New TTS component
    
    // Set dependencies for analysis engine
    if (analysisEngine && cameraManager && aiService && uiManager) {
      analysisEngine.setDependencies(cameraManager, aiService, uiManager)
    }
    
    // Emit components ready event
    this.eventBus.emit('app:components-ready', {
      cameraManager,
      aiService,
      uiManager,
      analysisEngine,
      ttsManager // Include TTS in component references
    })
  }

  /**
   * Initialize the application and all components
   */
  async initialize() {
    try {
      console.log(`🚀 Initializing AI Vision Studio v${this.version} - Eyes for the Blind`)
      
      // Show loading overlay
      this.showLoadingOverlay(true)
      
      // Initialize event bus (central communication)
      this.eventBus = new EventBus()
      this.components.set('eventBus', this.eventBus)
      
      // Initialize core components
      await this.initializeComponents()
      
      // Setup event listeners
      this.setupEventListeners()
      
      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts()
      
      // Initialize UI state
      this.initializeUIState()
      
      // Start performance monitoring
      if (this.config.performance.enableMonitoring) {
        this.components.get('performanceMonitor').start()
      }
      
      this.isInitialized = true
      this.showLoadingOverlay(false)
      
      console.log('✅ AI Vision Studio initialized successfully with accessibility features')
      this.components.get('uiManager').showToast('System Ready', 'AI Vision Studio loaded with voice accessibility', 'success')
      
      // Announce readiness for blind users
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager) {
        setTimeout(() => {
          ttsManager.speak('Welcome to AI Vision Studio. This application can see and describe images for you. Press Ctrl+Shift+H for instructions.', {
            priority: 'high'
          })
        }, 1000)
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize AI Vision Studio:', error)
      this.showLoadingOverlay(false)
      this.components.get('uiManager')?.showToast('Initialization Error', error.message, 'error')
    }
  }

  /**
   * Initialize all application components
   */
  async initializeComponents() {
    const initTasks = [
      // UI Manager - handles all UI interactions and state
      {
        name: 'uiManager',
        component: UIManager,
        config: { eventBus: this.eventBus }
      },
      
      // Text-to-Speech Manager - NEW: For accessibility
      {
        name: 'ttsManager',
        component: TextToSpeechManager,
        config: { 
          eventBus: this.eventBus,
          ...this.config.tts 
        }
      },
      
      // Camera Manager - handles video capture and streaming
      {
        name: 'cameraManager', 
        component: CameraManager,
        config: { 
          eventBus: this.eventBus,
          ...this.config.camera 
        }
      },
      
      // AI Service - handles communication with AI server
      {
        name: 'aiService',
        component: AIService,
        config: {
          eventBus: this.eventBus,
          ...this.config.ai
        }
      },
      
      // Analysis Engine - manages real-time analysis
      {
        name: 'analysisEngine',
        component: AnalysisEngine,
        config: {
          eventBus: this.eventBus,
          ...this.config.analysis
        }
      },
      
      // Performance Monitor - tracks system performance
      {
        name: 'performanceMonitor',
        component: PerformanceMonitor,
        config: {
          eventBus: this.eventBus,
          ...this.config.performance
        }
      }
    ]

    // Initialize components in parallel for faster startup
    const initPromises = initTasks.map(async ({ name, component: Component, config }) => {
      try {
        const instance = new Component(config)
        await instance.initialize?.()
        this.components.set(name, instance)
        console.log(`✅ ${name} initialized`)
      } catch (error) {
        console.error(`❌ Failed to initialize ${name}:`, error)
        throw new Error(`${name} initialization failed: ${error.message}`)
      }
    })

    await Promise.all(initPromises)
    
    // Setup component dependencies after all are initialized
    this.setupComponentDependencies()
  }

  /**
   * Setup application-level event listeners
   */
  setupEventListeners() {
    const eventBus = this.eventBus

    // Camera events
    eventBus.on('camera:started', (data) => {
      this.state.cameraActive = true
      this.updateSystemStatus()
      console.log('📹 Camera started:', data)
    })

    eventBus.on('camera:stopped', () => {
      this.state.cameraActive = false
      this.state.realtimeEnabled = false
      this.updateSystemStatus()
      console.log('📹 Camera stopped')
    })

    eventBus.on('camera:error', (error) => {
      this.state.cameraActive = false
      console.error('📹 Camera error:', error)
      this.components.get('uiManager').showToast('Camera Error', error.message, 'error')
    })

    // AI Service events
    eventBus.on('ai:connected', () => {
      this.state.aiConnected = true
      this.updateSystemStatus()
      console.log('🤖 AI service connected')
    })

    eventBus.on('ai:disconnected', () => {
      this.state.aiConnected = false
      this.updateSystemStatus()
      console.log('🤖 AI service disconnected')
    })

    eventBus.on('ai:error', (error) => {
      console.error('🤖 AI service error:', error)
      this.components.get('uiManager').showToast('AI Error', error.message, 'error')
    })

    // Analysis events - Enhanced for TTS
    eventBus.on('analysis:started', () => {
      this.state.isProcessing = true
      
      // Announce analysis start for blind users (only for manual analysis)
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager && !this.state.realtimeEnabled) {
        ttsManager.speak('Analyzing image...', { 
          mode: 'ui_feedback',
          priority: 'normal'
        })
      }
    })

    eventBus.on('analysis:completed', (result) => {
      this.state.isProcessing = false
      console.log('🔍 Analysis completed:', result.summary)
      
      // TTS will automatically read the result via its own event listener
    })

    eventBus.on('analysis:error', (error) => {
      this.state.isProcessing = false
      console.error('🔍 Analysis error:', error)
    })

    // Realtime analysis events
    eventBus.on('realtime:started', () => {
      this.state.realtimeEnabled = true
      this.updateSystemStatus()
    })

    eventBus.on('realtime:stopped', () => {
      this.state.realtimeEnabled = false
      this.updateSystemStatus()
    })

    // Performance events
    eventBus.on('performance:update', (metrics) => {
      this.updatePerformanceDisplay(metrics)
    })

    // Error handling
    eventBus.on('error:critical', (error) => {
      console.error('💥 Critical error:', error)
      this.components.get('uiManager').showToast('Critical Error', 'A critical error occurred. Please refresh the page.', 'error')
    })

    // NEW: TTS Events
    eventBus.on('tts:enabled', () => {
      this.state.voiceEnabled = true
      console.log('🔊 Text-to-speech enabled')
    })

    eventBus.on('tts:disabled', () => {
      this.state.voiceEnabled = false
      console.log('🔊 Text-to-speech disabled')
    })
  }

  /**
   * Setup keyboard shortcuts - Enhanced for accessibility
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ignore if user is typing in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return
      }

      const { key, ctrlKey, altKey, shiftKey } = event

      // Existing shortcuts
      // Camera controls
      if (key === 'c' && ctrlKey) {
        event.preventDefault()
        this.toggleCamera()
      }

      // Capture image
      if (key === ' ') {
        event.preventDefault()
        if (this.state.cameraActive) {
          this.components.get('cameraManager').captureFrame()
        }
      }

      // Toggle realtime analysis
      if (key === 'r' && ctrlKey) {
        event.preventDefault()
        this.toggleRealtimeAnalysis()
      }

      // Analyze current frame
      if (key === 'a' && ctrlKey) {
        event.preventDefault()
        this.analyzeCurrentFrame()
      }

      // NEW: Accessibility shortcuts
      // Toggle TTS (Ctrl+Shift+V)
      if (key === 'v' && ctrlKey && shiftKey) {
        event.preventDefault()
        this.toggleTextToSpeech()
      }

      // Read current analysis (Ctrl+Shift+A)
      if (key === 'a' && ctrlKey && shiftKey) {
        event.preventDefault()
        this.readCurrentAnalysis()
      }

      // Read instructions (Ctrl+Shift+H)
      if (key === 'h' && ctrlKey && shiftKey) {
        event.preventDefault()
        this.readInstructions()
      }

      // Quick analysis with voice feedback (F1)
      if (key === 'F1') {
        event.preventDefault()
        this.quickAnalysisWithVoice()
      }

      // Read system status (F2)
      if (key === 'F2') {
        event.preventDefault()
        this.readSystemStatus()
      }

      // Settings
      if (key === ',' && ctrlKey) {
        event.preventDefault()
        this.showSettings()
      }
    })
  }

  /**
   * NEW: Toggle Text-to-Speech
   */
  toggleTextToSpeech() {
    const ttsManager = this.components.get('ttsManager')
    if (ttsManager) {
      ttsManager.toggleSpeech()
    }
  }

  /**
   * NEW: Read current analysis result
   */
  readCurrentAnalysis() {
    const ttsManager = this.components.get('ttsManager')
    if (ttsManager) {
      ttsManager.readCurrentAnalysis()
    }
  }

  /**
   * NEW: Read instructions for blind users
   */
  readInstructions() {
    const ttsManager = this.components.get('ttsManager')
    if (ttsManager) {
      ttsManager.readInstructions()
    }
  }

  /**
   * NEW: Quick analysis with immediate voice feedback
   */
  async quickAnalysisWithVoice() {
    const ttsManager = this.components.get('ttsManager')
    
    if (!this.state.cameraActive) {
      if (ttsManager) {
        ttsManager.speak('Please start the camera first to analyze images', {
          priority: 'high'
        })
      }
      return
    }

    if (ttsManager) {
      ttsManager.speak('Taking picture and analyzing...', {
        priority: 'high'
      })
    }

    try {
      await this.analyzeCurrentFrame()
    } catch (error) {
      if (ttsManager) {
        ttsManager.speak(`Analysis failed: ${error.message}`, {
          priority: 'high'
        })
      }
    }
  }

  /**
   * NEW: Read system status
   */
  readSystemStatus() {
    const ttsManager = this.components.get('ttsManager')
    if (!ttsManager) return

    let status = 'System status: '
    
    if (this.state.cameraActive) {
      status += 'Camera is active. '
    } else {
      status += 'Camera is not active. '
    }

    if (this.state.aiConnected) {
      status += 'AI service is connected. '
    } else {
      status += 'AI service is not connected. '
    }

    if (this.state.realtimeEnabled) {
      status += 'Real-time analysis is running. '
    } else {
      status += 'Real-time analysis is stopped. '
    }

    if (this.state.voiceEnabled) {
      status += 'Voice feedback is enabled.'
    } else {
      status += 'Voice feedback is disabled.'
    }

    ttsManager.speak(status, { priority: 'high' })
  }

  /**
   * Initialize UI state - Enhanced for TTS
   */
  initializeUIState() {
    const uiManager = this.components.get('uiManager')
    
    // Set initial values
    uiManager.updateElement('aiServerUrl', 'value', this.config.ai.serverUrl)
    uiManager.updateElement('analysisPrompt', 'value', this.config.analysis.defaultPrompt)
    
    // Update system status
    this.updateSystemStatus()
    
    // Apply theme
    this.applyTheme()
    
    // Show accessibility notice
    this.showAccessibilityNotice()
  }

  /**
   * NEW: Show accessibility notice
   */
  showAccessibilityNotice() {
    const uiManager = this.components.get('uiManager')
    
    // Add accessibility notice to the page
    const accessibilityNotice = document.createElement('div')
    accessibilityNotice.id = 'accessibilityNotice'
    accessibilityNotice.className = 'accessibility-notice'
    accessibilityNotice.innerHTML = `
      <div class="notice-content">
        <h3>🦻 Accessibility Features Enabled</h3>
        <p>This AI Vision app includes voice feedback for blind and visually impaired users.</p>
        <ul>
          <li><kbd>Ctrl+Shift+H</kbd> - Read instructions</li>
          <li><kbd>F1</kbd> - Quick analysis with voice</li>
          <li><kbd>F2</kbd> - Read system status</li>
          <li><kbd>Ctrl+Shift+V</kbd> - Toggle voice on/off</li>
        </ul>
        <button id="closeNotice" class="close-notice">Got it!</button>
      </div>
    `
    
    document.body.appendChild(accessibilityNotice)
    
    // Close button handler
    document.getElementById('closeNotice')?.addEventListener('click', () => {
      accessibilityNotice.remove()
    })
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (accessibilityNotice.parentNode) {
        accessibilityNotice.remove()
      }
    }, 10000)
  }

  /**
   * Update system status - Enhanced with voice status
   */
  updateSystemStatus() {
    const uiManager = this.components.get('uiManager')
    
    // Update camera status
    uiManager.updateStatus('camera', 
      this.state.cameraActive ? 'connected' : 'disconnected',
      this.state.cameraActive ? 'Connected' : 'Disconnected'
    )
    
    // Update AI status
    uiManager.updateStatus('ai',
      this.state.aiConnected ? 'connected' : 'disconnected', 
      this.state.aiConnected ? 'Connected' : 'Not Connected'
    )
    
    // Update system status
    const systemReady = this.state.cameraActive && this.state.aiConnected
    const systemStatus = systemReady ? 'ready' : 'partial'
    uiManager.updateElement('systemStatus', 'textContent', 
      systemStatus === 'ready' ? 'System Ready' : 'System Partial'
    )
  }

  /**
   * Show help modal - Enhanced with accessibility info
   */
  showHelp() {
    const helpText = `
AI Vision Studio - Eyes for the Blind

CAMERA CONTROLS:
• Ctrl+C: Toggle Camera
• Spacebar: Capture Frame

ANALYSIS CONTROLS:
• Ctrl+R: Toggle Real-time Analysis  
• Ctrl+A: Analyze Current Frame
• F1: Quick Analysis with Voice

ACCESSIBILITY FEATURES:
• Ctrl+Shift+V: Toggle Voice On/Off
• Ctrl+Shift+A: Read Current Analysis
• Ctrl+Shift+H: Read Instructions
• F2: Read System Status
• Escape: Stop Voice Reading

SETTINGS:
• Ctrl+,: Open Settings

The AI will automatically describe what it sees and read it aloud.
Perfect for blind and visually impaired users to understand their surroundings.
    `
    this.components.get('uiManager').showToast('Help & Accessibility', helpText, 'info')
  }

  /**
   * Toggle camera on/off - Enhanced with voice feedback
   */
  async toggleCamera() {
    const cameraManager = this.components.get('cameraManager')
    const ttsManager = this.components.get('ttsManager')
    
    try {
      if (this.state.cameraActive) {
        await cameraManager.stop()
      } else {
        if (ttsManager) {
          ttsManager.speak('Starting camera...', { priority: 'high' })
        }
        await cameraManager.start()
      }
    } catch (error) {
      if (ttsManager) {
        ttsManager.speak(`Camera error: ${error.message}`, { priority: 'high' })
      }
    }
  }

  /**
   * Toggle realtime analysis - Enhanced with voice feedback
   */
  toggleRealtimeAnalysis() {
    const analysisEngine = this.components.get('analysisEngine')
    const ttsManager = this.components.get('ttsManager')
    
    if (this.state.realtimeEnabled) {
      analysisEngine.stopRealtime()
    } else {
      if (!this.state.cameraActive) {
        this.components.get('uiManager').showToast('Camera Required', 'Please start the camera first', 'warning')
        if (ttsManager) {
          ttsManager.speak('Please start the camera first', { priority: 'high' })
        }
        return
      }
      analysisEngine.startRealtime()
    }
  }

  /**
   * Analyze current frame - Enhanced with voice feedback
   */
  async analyzeCurrentFrame() {
    const ttsManager = this.components.get('ttsManager')
    
    if (!this.state.cameraActive) {
      this.components.get('uiManager').showToast('Camera Required', 'Please start the camera first', 'warning')
      if (ttsManager) {
        ttsManager.speak('Please start the camera first', { priority: 'high' })
      }
      return
    }

    const analysisEngine = this.components.get('analysisEngine')
    await analysisEngine.analyzeFrame()
  }

  /**
   * Get application state - Enhanced with voice status
   */
  getState() {
    return { 
      ...this.state,
      voiceEnabled: this.state.voiceEnabled,
      ttsSupported: this.components.get('ttsManager')?.isSupported || false
    }
  }

  /**
   * Update configuration - Enhanced for TTS
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates }
    
    // Update TTS config if provided
    if (updates.tts) {
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager) {
        ttsManager.updateConfig(updates.tts)
      }
    }
    
    // Notify components of config changes
    this.eventBus.emit('config:updated', this.config)
  }

  /**
   * Shutdown application - Enhanced for TTS
   */
  async shutdown() {
    console.log('🔄 Shutting down AI Vision Studio...')
    
    // Stop all components
    for (const [name, component] of this.components) {
      try {
        await component.shutdown?.()
        console.log(`✅ ${name} shut down`)
      } catch (error) {
        console.error(`❌ Error shutting down ${name}:`, error)
      }
    }
    
    // Clear components
    this.components.clear()
    
    // Reset state
    this.isInitialized = false
    this.state = {
      cameraActive: false,
      realtimeEnabled: false,
      aiConnected: false,
      isProcessing: false,
      voiceEnabled: false,
      currentSession: null
    }
    
    console.log('✅ AI Vision Studio shut down complete')
  }

  // Keep all other existing methods unchanged...
  updatePerformanceDisplay(metrics) {
    const uiManager = this.components.get('uiManager')
    
    // Update network latency
    if (metrics.networkLatency) {
      uiManager.updateElement('networkLatency', 'textContent', `${metrics.networkLatency}ms`)
    }
  }

  showLoadingOverlay(show) {
    const overlay = document.getElementById('loadingOverlay')
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none'
    }
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', 'default')
  }

  showSettings() {
    console.log('⚙️ Settings modal (not implemented yet)')
    this.components.get('uiManager').showToast('Settings', 'Settings panel with voice controls available!', 'info')
  }

  // Get component instance
  getComponent(name) {
    return this.components.get(name)
  }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Make app instance globally accessible for debugging
  window.aiVisionStudio = new AIVisionStudio()
  
  // Handle page unload
  window.addEventListener('beforeunload', () => {
    window.aiVisionStudio?.shutdown()
  })
})

// Handle uncaught errors
window.addEventListener('error', (event) => {
  console.error('💥 Uncaught error:', event.error)
  window.aiVisionStudio?.eventBus?.emit('error:critical', event.error)
})

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Unhandled promise rejection:', event.reason)
  window.aiVisionStudio?.eventBus?.emit('error:critical', event.reason)
})

export default AIVisionStudio
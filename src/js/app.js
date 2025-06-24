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
    this.version = '2.1.1' // Updated version for fixes
    this.isInitialized = false
    this.components = new Map()
    this.cleanup = new Set() // Track cleanup functions
    this.initializationPromise = null // Prevent multiple initializations
    
    // Application state with enhanced error tracking
    this.state = {
      cameraActive: false,
      realtimeEnabled: false,
      aiConnected: false,
      isProcessing: false,
      voiceEnabled: true,
      currentSession: null,
      lastError: null,
      recoveryAttempts: 0,
      maxRecoveryAttempts: 3
    }
    
    // Enhanced configuration
    this.config = {
      camera: {
        resolution: { width: 1280, height: 720 },
        fps: 30,
        facingMode: 'user'
      },
      ai: {
        serverUrl: 'http://localhost:8000',
        timeout: 120000, // 2 minutes
        retryAttempts: 3,
        healthCheckInterval: 15000
      },
      analysis: {
        defaultPrompt: 'Describe what you see in this image in detail. Include information about people, objects, colors, text, and the overall scene.',
        maxTokens: 300,
        temperature: 0.1
      },
      performance: {
        enableMonitoring: true,
        updateInterval: 1000
      },
      tts: {
        enabled: true,
        autoRead: true,
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        language: 'en-US'
      }
    }
    
    // Setup error boundary before initialization
    this.errorBoundary = this.setupErrorBoundary()
    
    // Initialize with error handling
    this.initialize().catch(error => {
      console.error('💥 Critical initialization error:', error)
      this.showCriticalError(error)
    })
  }

  /**
   * Setup global error boundary
   */
  setupErrorBoundary() {
    const originalErrorHandler = window.onerror
    const originalUnhandledRejection = window.onunhandledrejection
    
    // Global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('💥 Global error caught:', { message, source, lineno, colno, error })
      
      this.state.lastError = {
        type: 'javascript',
        message,
        source,
        lineno,
        colno,
        stack: error?.stack,
        timestamp: Date.now()
      }
      
      this.handleError(error || new Error(message), 'Global JavaScript Error')
      
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error)
      }
    }
    
    // Unhandled promise rejection handler
    window.onunhandledrejection = (event) => {
      console.error('💥 Unhandled promise rejection:', event.reason)
      
      this.state.lastError = {
        type: 'promise',
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: Date.now()
      }
      
      this.handleError(event.reason, 'Unhandled Promise Rejection')
      
      if (originalUnhandledRejection) {
        return originalUnhandledRejection(event)
      }
    }
    
    // Return cleanup function
    return () => {
      window.onerror = originalErrorHandler
      window.onunhandledrejection = originalUnhandledRejection
    }
  }

  /**
   * Enhanced error handling
   */
  handleError(error, context = 'Unknown') {
    console.error(`❌ Error in ${context}:`, error)
    
    // Show user-friendly error message
    const uiManager = this.components.get('uiManager')
    if (uiManager) {
      uiManager.showToast(
        'Application Error',
        `An error occurred: ${error.message}. The app will try to recover.`,
        'error',
        { duration: 10000 }
      )
    }
    
    // Attempt recovery if not too many attempts
    if (this.state.recoveryAttempts < this.state.maxRecoveryAttempts) {
      this.attemptRecovery(error, context)
    } else {
      console.error('💥 Too many recovery attempts, stopping auto-recovery')
    }
  }

  /**
   * Attempt to recover from errors
   */
  async attemptRecovery(error, context) {
    this.state.recoveryAttempts++
    
    try {
      console.log(`🔄 Attempting recovery (${this.state.recoveryAttempts}/${this.state.maxRecoveryAttempts})...`)
      
      // Stop any ongoing operations
      if (this.state.realtimeEnabled) {
        await this.safeToggleRealtime(false)
      }
      
      // Check and reinitialize components
      await this.checkComponentHealth()
      
      // Test basic functionality
      await this.performHealthCheck()
      
      console.log('✅ Recovery attempt completed')
      
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager) {
        ttsManager.speak('System recovered from error', { priority: 'high' })
      }
      
    } catch (recoveryError) {
      console.error('💥 Recovery failed:', recoveryError)
      
      if (this.state.recoveryAttempts >= this.state.maxRecoveryAttempts) {
        this.showCriticalError(new Error('Multiple recovery attempts failed'))
      }
    }
  }

  /**
   * Check health of all components
   */
  async checkComponentHealth() {
    for (const [name, component] of this.components) {
      try {
        if (component.getStatus) {
          const status = component.getStatus()
          if (!status.isInitialized) {
            console.warn(`⚠️ Component ${name} needs reinitialization`)
            if (component.initialize) {
              await component.initialize()
            }
          }
        }
      } catch (error) {
        console.error(`❌ Failed to check ${name} status:`, error)
      }
    }
  }

  /**
   * Perform basic health check
   */
  async performHealthCheck() {
    try {
      // Test AI service if available
      const aiService = this.components.get('aiService')
      if (aiService && aiService.testConnection) {
        await aiService.testConnection()
      }
      
      // Test camera if active
      const cameraManager = this.components.get('cameraManager')
      if (cameraManager && this.state.cameraActive) {
        const frame = cameraManager.getCurrentFrame()
        if (!frame) {
          console.warn('⚠️ Camera frame not available')
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Health check found issues:', error)
    }
  }

  /**
   * Show critical error UI
   */
  showCriticalError(error) {
    console.error('💥 Showing critical error UI:', error)
    
    // Create fallback error UI
    const errorContainer = document.createElement('div')
    errorContainer.className = 'critical-error-overlay'
    errorContainer.innerHTML = `
      <div class="critical-error-content">
        <div class="error-icon">⚠️</div>
        <h1>Application Error</h1>
        <p>AI Vision Studio encountered a critical error and needs to be reloaded.</p>
        <div class="error-actions">
          <button onclick="location.reload()" class="error-btn primary">
            Reload Application
          </button>
          <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" class="error-btn secondary">
            Dismiss
          </button>
        </div>
        <details class="error-details">
          <summary>Technical Details</summary>
          <pre>${error.stack || error.message}</pre>
        </details>
      </div>
    `
    
    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      .critical-error-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: white;
        font-family: system-ui;
      }
      .critical-error-content {
        background: #1e293b;
        padding: 2rem;
        border-radius: 12px;
        max-width: 500px;
        text-align: center;
        border: 2px solid #ef4444;
      }
      .error-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      .error-actions {
        margin: 1.5rem 0;
        display: flex;
        gap: 1rem;
        justify-content: center;
      }
      .error-btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
      }
      .error-btn.primary {
        background: #ef4444;
        color: white;
      }
      .error-btn.secondary {
        background: #6b7280;
        color: white;
      }
      .error-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      }
      .error-details {
        margin-top: 1rem;
        text-align: left;
      }
      .error-details pre {
        background: rgba(0,0,0,0.3);
        padding: 1rem;
        border-radius: 4px;
        overflow: auto;
        max-height: 200px;
        font-size: 0.875rem;
      }
    `
    
    document.head.appendChild(style)
    document.body.appendChild(errorContainer)
  }

  /**
   * Initialize the application and all components
   */
  async initialize() {
    // Prevent multiple initializations
    if (this.initializationPromise) {
      return this.initializationPromise
    }
    
    this.initializationPromise = this._initialize()
    return this.initializationPromise
  }

  async _initialize() {
    try {
      console.log(`🚀 Initializing AI Vision Studio v${this.version} - Eyes for the Blind`)
      
      // Show loading overlay
      this.showLoadingOverlay(true)
      
      // Wait for DOM to be ready
      await this.waitForDOM()
      
      // Initialize event bus (central communication)
      this.eventBus = new EventBus()
      this.components.set('eventBus', this.eventBus)
      
      // Initialize core components with timeout
      await Promise.race([
        this.initializeComponents(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), 30000)
        )
      ])
      
      // Setup event listeners
      this.setupEventListeners()
      
      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts()
      
      // Initialize UI state
      this.initializeUIState()
      
      // Start performance monitoring
      if (this.config.performance.enableMonitoring) {
        const perfMonitor = this.components.get('performanceMonitor')
        if (perfMonitor) {
          perfMonitor.start()
        }
      }
      
      // Test AI service connection
      await this.testInitialConnection()
      
      this.isInitialized = true
      this.showLoadingOverlay(false)
      
      console.log('✅ AI Vision Studio initialized successfully with accessibility features')
      
      const uiManager = this.components.get('uiManager')
      if (uiManager) {
        uiManager.showToast('System Ready', 'AI Vision Studio loaded with voice accessibility', 'success')
      }
      
      // Announce readiness for blind users
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager) {
        setTimeout(() => {
          ttsManager.speak(
            'Welcome to AI Vision Studio. This application can see and describe images for you. Press Ctrl+Shift+H for instructions.',
            { priority: 'high' }
          )
        }, 1500)
      }
      
      // Reset recovery attempts on successful initialization
      this.state.recoveryAttempts = 0
      
    } catch (error) {
      console.error('❌ Failed to initialize AI Vision Studio:', error)
      this.showLoadingOverlay(false)
      
      const uiManager = this.components.get('uiManager')
      if (uiManager) {
        uiManager.showToast('Initialization Error', error.message, 'error', { duration: 15000 })
      }
      
      throw error
    }
  }

  /**
   * Wait for DOM to be ready
   */
  async waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve, { once: true })
      } else {
        resolve()
      }
    })
  }

  /**
   * Test initial AI service connection
   */
  async testInitialConnection() {
    try {
      const aiService = this.components.get('aiService')
      if (aiService) {
        await aiService.testConnection()
        console.log('✅ Initial AI service connection successful')
      }
    } catch (error) {
      console.warn('⚠️ Initial AI service connection failed:', error)
      // Don't throw - this is not critical for startup
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
        config: { eventBus: this.eventBus },
        critical: true,
        timeout: 10000
      },
      
      // Text-to-Speech Manager - For accessibility
      {
        name: 'ttsManager',
        component: TextToSpeechManager,
        config: { 
          eventBus: this.eventBus,
          ...this.config.tts 
        },
        critical: false,
        timeout: 10000
      },
      
      // Camera Manager - handles video capture and streaming
      {
        name: 'cameraManager', 
        component: CameraManager,
        config: { 
          eventBus: this.eventBus,
          ...this.config.camera 
        },
        critical: true,
        timeout: 15000
      },
      
      // AI Service - handles communication with AI server
      {
        name: 'aiService',
        component: AIService,
        config: {
          eventBus: this.eventBus,
          ...this.config.ai
        },
        critical: true,
        timeout: 20000
      },
      
      // Analysis Engine - manages real-time analysis
      {
        name: 'analysisEngine',
        component: AnalysisEngine,
        config: {
          eventBus: this.eventBus,
          ...this.config.analysis
        },
        critical: true,
        timeout: 10000
      },
      
      // Performance Monitor - tracks system performance
      {
        name: 'performanceMonitor',
        component: PerformanceMonitor,
        config: {
          eventBus: this.eventBus,
          ...this.config.performance
        },
        critical: false,
        timeout: 5000
      }
    ]

    // Initialize components with enhanced error handling
    const results = await Promise.allSettled(
      initTasks.map(async ({ name, component: Component, config, critical, timeout }) => {
        try {
          console.log(`🔄 Initializing ${name}...`)
          
          const instance = new Component(config)
          
          // Add timeout for initialization
          await Promise.race([
            instance.initialize?.() || Promise.resolve(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`${name} initialization timeout`)), timeout)
            )
          ])
          
          this.components.set(name, instance)
          
          // Track cleanup
          if (instance.shutdown) {
            this.cleanup.add(() => instance.shutdown())
          }
          
          console.log(`✅ ${name} initialized successfully`)
          return { name, success: true, critical }
          
        } catch (error) {
          console.error(`❌ Failed to initialize ${name}:`, error)
          
          if (critical) {
            throw new Error(`Critical component ${name} failed: ${error.message}`)
          }
          
          return { name, success: false, error, critical }
        }
      })
    )

    // Check for critical failures
    const criticalFailures = results
      .map((result, index) => ({ result, task: initTasks[index] }))
      .filter(({ result, task }) => result.status === 'rejected' && task.critical)

    if (criticalFailures.length > 0) {
      const failedComponents = criticalFailures.map(f => f.task.name).join(', ')
      throw new Error(`Critical components failed to initialize: ${failedComponents}`)
    }

    // Log non-critical failures
    results.forEach((result, index) => {
      const task = initTasks[index]
      if (result.status === 'rejected' && !task.critical) {
        console.warn(`⚠️ Non-critical component ${task.name} failed to initialize:`, result.reason)
      }
    })

    // Setup component dependencies after all are initialized
    this.setupComponentDependencies()
    
    console.log('✅ All components initialized successfully')
  }

  /**
   * Setup component dependencies after initialization
   */
  setupComponentDependencies() {
    const cameraManager = this.components.get('cameraManager')
    const aiService = this.components.get('aiService')
    const uiManager = this.components.get('uiManager')
    const analysisEngine = this.components.get('analysisEngine')
    const ttsManager = this.components.get('ttsManager')
    
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
      ttsManager
    })
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
      this.handleError(new Error(error.data?.message || 'Camera error'), 'Camera')
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
      this.handleError(new Error(error.data?.message || 'AI service error'), 'AI Service')
    })

    // Analysis events
    eventBus.on('analysis:started', () => {
      this.state.isProcessing = true
      
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
    })

    eventBus.on('analysis:error', (error) => {
      this.state.isProcessing = false
      console.error('🔍 Analysis error:', error)
      this.handleError(new Error(error.data?.message || 'Analysis error'), 'Analysis')
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
      this.updatePerformanceDisplay(metrics.data)
    })

    // Error handling
    eventBus.on('error:critical', (error) => {
      this.handleError(error.data, 'Critical System Error')
    })

    // TTS Events
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

      try {
        // Camera controls
        if (key === 'c' && ctrlKey) {
          event.preventDefault()
          this.safeToggleCamera()
        }

        // Capture image
        if (key === ' ') {
          event.preventDefault()
          if (this.state.cameraActive) {
            this.safeCaptureFrame()
          }
        }

        // Toggle realtime analysis
        if (key === 'r' && ctrlKey) {
          event.preventDefault()
          this.safeToggleRealtime()
        }

        // Analyze current frame
        if (key === 'a' && ctrlKey) {
          event.preventDefault()
          this.safeAnalyzeFrame()
        }

        // Accessibility shortcuts
        if (key === 'v' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.toggleTextToSpeech()
        }

        if (key === 'a' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.readCurrentAnalysis()
        }

        if (key === 'h' && ctrlKey && shiftKey) {
          event.preventDefault()
          this.readInstructions()
        }

        if (key === 'F1') {
          event.preventDefault()
          this.quickAnalysisWithVoice()
        }

        if (key === 'F2') {
          event.preventDefault()
          this.readSystemStatus()
        }

        if (key === ',' && ctrlKey) {
          event.preventDefault()
          this.showSettings()
        }
        
      } catch (error) {
        console.error('❌ Keyboard shortcut error:', error)
        this.handleError(error, 'Keyboard Shortcut')
      }
    })
  }

  // Safe wrapper methods for operations
  async safeToggleCamera() {
    try {
      await this.toggleCamera()
    } catch (error) {
      this.handleError(error, 'Toggle Camera')
    }
  }

  async safeCaptureFrame() {
    try {
      const cameraManager = this.components.get('cameraManager')
      if (cameraManager) {
        cameraManager.captureFrame()
      }
    } catch (error) {
      this.handleError(error, 'Capture Frame')
    }
  }

  async safeToggleRealtime(force = null) {
    try {
      if (force !== null) {
        if (force && !this.state.realtimeEnabled) {
          this.toggleRealtimeAnalysis()
        } else if (!force && this.state.realtimeEnabled) {
          this.toggleRealtimeAnalysis()
        }
      } else {
        this.toggleRealtimeAnalysis()
      }
    } catch (error) {
      this.handleError(error, 'Toggle Realtime')
    }
  }

  async safeAnalyzeFrame() {
    try {
      await this.analyzeCurrentFrame()
    } catch (error) {
      this.handleError(error, 'Analyze Frame')
    }
  }

  /**
   * Toggle Text-to-Speech
   */
  toggleTextToSpeech() {
    try {
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager) {
        ttsManager.toggleSpeech()
      }
    } catch (error) {
      this.handleError(error, 'Toggle TTS')
    }
  }

  /**
   * Read current analysis result
   */
  readCurrentAnalysis() {
    try {
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager) {
        ttsManager.readCurrentAnalysis()
      }
    } catch (error) {
      this.handleError(error, 'Read Analysis')
    }
  }

  /**
   * Read instructions for blind users
   */
  readInstructions() {
    try {
      const ttsManager = this.components.get('ttsManager')
      if (ttsManager) {
        ttsManager.readInstructions()
      }
    } catch (error) {
      this.handleError(error, 'Read Instructions')
    }
  }

  /**
   * Quick analysis with immediate voice feedback
   */
  async quickAnalysisWithVoice() {
    const ttsManager = this.components.get('ttsManager')
    
    try {
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

      await this.analyzeCurrentFrame()
      
    } catch (error) {
      if (ttsManager) {
        ttsManager.speak(`Analysis failed: ${error.message}`, {
          priority: 'high'
        })
      }
      this.handleError(error, 'Quick Analysis')
    }
  }

  /**
   * Read system status
   */
  readSystemStatus() {
    try {
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
      
    } catch (error) {
      this.handleError(error, 'Read Status')
    }
  }

  /**
   * Initialize UI state
   */
  initializeUIState() {
    try {
      const uiManager = this.components.get('uiManager')
      
      // Set initial values
      uiManager.updateElement('analysisPrompt', 'value', this.config.analysis.defaultPrompt)
      
      // Update system status
      this.updateSystemStatus()
      
      // Apply theme
      this.applyTheme()
      
    } catch (error) {
      console.error('❌ Failed to initialize UI state:', error)
    }
  }

  /**
   * Update system status
   */
  updateSystemStatus() {
    try {
      const uiManager = this.components.get('uiManager')
      if (!uiManager) return
      
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
      
    } catch (error) {
      console.error('❌ Failed to update system status:', error)
    }
  }

  /**
   * Toggle camera on/off
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
      throw error
    }
  }

  /**
   * Toggle realtime analysis
   */
  toggleRealtimeAnalysis() {
    const analysisEngine = this.components.get('analysisEngine')
    const ttsManager = this.components.get('ttsManager')
    
    try {
      if (this.state.realtimeEnabled) {
        analysisEngine.stopRealtime()
      } else {
        if (!this.state.cameraActive) {
          const message = 'Please start the camera first'
          this.components.get('uiManager')?.showToast('Camera Required', message, 'warning')
          if (ttsManager) {
            ttsManager.speak(message, { priority: 'high' })
          }
          return
        }
        analysisEngine.startRealtime()
      }
    } catch (error) {
      this.handleError(error, 'Toggle Realtime Analysis')
    }
  }

  /**
   * Analyze current frame
   */
  async analyzeCurrentFrame() {
    const ttsManager = this.components.get('ttsManager')
    
    try {
      if (!this.state.cameraActive) {
        const message = 'Please start the camera first'
        this.components.get('uiManager')?.showToast('Camera Required', message, 'warning')
        if (ttsManager) {
          ttsManager.speak(message, { priority: 'high' })
        }
        return
      }

      const analysisEngine = this.components.get('analysisEngine')
      if (analysisEngine) {
        await analysisEngine.analyzeFrame()
      }
    } catch (error) {
      if (ttsManager) {
        ttsManager.speak(`Analysis failed: ${error.message}`, { priority: 'high' })
      }
      throw error
    }
  }

  /**
   * Show help modal
   */
  showHelp() {
    try {
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
      this.components.get('uiManager')?.showToast('Help & Accessibility', helpText, 'info')
    } catch (error) {
      this.handleError(error, 'Show Help')
    }
  }

  /**
   * Show settings
   */
  showSettings() {
    try {
      console.log('⚙️ Settings modal (not implemented yet)')
      this.components.get('uiManager')?.showToast('Settings', 'Settings panel with voice controls available!', 'info')
    } catch (error) {
      this.handleError(error, 'Show Settings')
    }
  }

  /**
   * Apply theme
   */
  applyTheme() {
    try {
      document.documentElement.setAttribute('data-theme', 'default')
    } catch (error) {
      console.error('❌ Failed to apply theme:', error)
    }
  }

  /**
   * Update performance display
   */
  updatePerformanceDisplay(metrics) {
    try {
      const uiManager = this.components.get('uiManager')
      
      // Update network latency
      if (metrics.networkLatency) {
        uiManager.updateElement('networkLatency', 'textContent', `${metrics.networkLatency}ms`)
      }
    } catch (error) {
      console.error('❌ Failed to update performance display:', error)
    }
  }

  /**
   * Show/hide loading overlay
   */
  showLoadingOverlay(show) {
    try {
      const overlay = document.getElementById('loadingOverlay')
      if (overlay) {
        overlay.style.display = show ? 'flex' : 'none'
      }
    } catch (error) {
      console.error('❌ Failed to toggle loading overlay:', error)
    }
  }

  /**
   * Get application state
   */
  getState() {
    return { 
      ...this.state,
      voiceEnabled: this.state.voiceEnabled,
      ttsSupported: this.components.get('ttsManager')?.isSupported || false,
      version: this.version,
      isInitialized: this.isInitialized,
      lastError: this.state.lastError
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates) {
    try {
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
    } catch (error) {
      this.handleError(error, 'Update Config')
    }
  }

  /**
   * Get component instance
   */
  getComponent(name) {
    return this.components.get(name)
  }

  /**
   * Enhanced shutdown with proper cleanup
   */
  async shutdown() {
    console.log('🔄 Shutting down AI Vision Studio...')
    
    try {
      // Remove error boundary
      if (this.errorBoundary) {
        this.errorBoundary()
      }
      
      // Stop all operations
      if (this.state.realtimeEnabled) {
        await this.safeToggleRealtime(false)
      }
      
      // Run all cleanup functions with timeout
      const cleanupPromises = Array.from(this.cleanup).map(async (cleanupFn) => {
        try {
          await Promise.race([
            cleanupFn(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Cleanup timeout')), 5000)
            )
          ])
        } catch (error) {
          console.error('❌ Cleanup error:', error)
        }
      })
      
      await Promise.allSettled(cleanupPromises)
      
      // Clear components and cleanup
      this.components.clear()
      this.cleanup.clear()
      
      // Reset state
      this.isInitialized = false
      this.initializationPromise = null
      this.state = {
        cameraActive: false,
        realtimeEnabled: false,
        aiConnected: false,
        isProcessing: false,
        voiceEnabled: false,
        currentSession: null,
        lastError: null,
        recoveryAttempts: 0,
        maxRecoveryAttempts: 3
      }
      
      console.log('✅ AI Vision Studio shut down complete')
      
    } catch (error) {
      console.error('💥 Shutdown error:', error)
    }
  }
}

// Enhanced initialization with better error handling
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🎯 DOM loaded, initializing AI Vision Studio...')
    window.aiVisionStudio = new AIVisionStudio()
    
    // Add global reference for debugging
    if (typeof window !== 'undefined') {
      window.debugAIVision = () => {
        console.log('🐛 AI Vision Debug Info:')
        console.log('State:', window.aiVisionStudio.getState())
        console.log('Components:', Array.from(window.aiVisionStudio.components.keys()))
        console.log('Config:', window.aiVisionStudio.config)
      }
    }
    
  } catch (error) {
    console.error('💥 Failed to initialize app:', error)
    
    // Show fallback error UI with enhanced styling
    document.body.innerHTML = `
      <div style="
        display: flex; 
        align-items: center; 
        justify-content: center; 
        min-height: 100vh; 
        padding: 2rem; 
        text-align: center; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        margin: 0;
      ">
        <div style="
          background: rgba(0, 0, 0, 0.1); 
          padding: 3rem; 
          border-radius: 16px; 
          backdrop-filter: blur(10px); 
          border: 1px solid rgba(255, 255, 255, 0.2);
          max-width: 600px;
        ">
          <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
          <h1 style="font-size: 2rem; margin-bottom: 1rem; font-weight: 700;">Initialization Failed</h1>
          <p style="margin-bottom: 2rem; opacity: 0.9; font-size: 1.1rem; line-height: 1.6;">
            AI Vision Studio failed to start properly. This could be due to browser compatibility issues or missing dependencies.
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 2rem;">
            <button onclick="location.reload()" style="
              padding: 1rem 2rem; 
              background: rgba(255, 255, 255, 0.2); 
              color: white; 
              border: 2px solid rgba(255, 255, 255, 0.3); 
              border-radius: 8px; 
              font-weight: bold; 
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              🔄 Reload Page
            </button>
            <button onclick="window.open('https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#browser_compatibility', '_blank')" style="
              padding: 1rem 2rem; 
              background: transparent; 
              color: white; 
              border: 2px solid rgba(255, 255, 255, 0.3); 
              border-radius: 8px; 
              font-weight: bold; 
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
              📖 Browser Support
            </button>
          </div>
          <details style="margin-top: 2rem; opacity: 0.7; text-align: left;">
            <summary style="cursor: pointer; margin-bottom: 1rem; font-weight: bold;">🔧 Technical Details</summary>
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 4px; font-family: monospace; font-size: 0.875rem; overflow: auto; max-height: 200px; white-space: pre-wrap;">${error.stack || error.message}</div>
          </details>
          <div style="margin-top: 2rem; padding: 1rem; background: rgba(255, 255, 255, 0.1); border-radius: 8px; font-size: 0.875rem;">
            <strong>💡 Common Solutions:</strong><br>
            • Ensure you're using a modern browser (Chrome, Firefox, Edge)<br>
            • Allow camera permissions when prompted<br>
            • Use HTTPS or localhost (required for camera access)<br>
            • Check that no other apps are using your camera
          </div>
        </div>
      </div>
    `
  }
})

// Enhanced window lifecycle handling
window.addEventListener('beforeunload', async (event) => {
  try {
    if (window.aiVisionStudio && window.aiVisionStudio.isInitialized) {
      // Don't await shutdown on beforeunload as it may be cancelled
      window.aiVisionStudio.shutdown()
    }
  } catch (error) {
    console.error('💥 Unload error:', error)
  }
})

// Enhanced visibility change handling
document.addEventListener('visibilitychange', () => {
  try {
    if (window.aiVisionStudio && window.aiVisionStudio.isInitialized) {
      const eventBus = window.aiVisionStudio.eventBus
      if (eventBus) {
        eventBus.emit('app:visibility-changed', { 
          hidden: document.hidden,
          timestamp: Date.now()
        })
      }
    }
  } catch (error) {
    console.error('💥 Visibility change error:', error)
  }
})

// Page focus/blur handling for better resource management
window.addEventListener('focus', () => {
  try {
    if (window.aiVisionStudio && window.aiVisionStudio.isInitialized) {
      console.log('🎯 App gained focus')
      // Optionally resume operations
    }
  } catch (error) {
    console.error('💥 Focus error:', error)
  }
})

window.addEventListener('blur', () => {
  try {
    if (window.aiVisionStudio && window.aiVisionStudio.isInitialized) {
      console.log('😴 App lost focus')
      // Optionally pause non-critical operations
    }
  } catch (error) {
    console.error('💥 Blur error:', error)
  }
})

export default AIVisionStudio
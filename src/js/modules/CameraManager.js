export class CameraManager {
  constructor(config = {}) {
    this.config = {
      resolution: { width: 1280, height: 720 },
      fps: 30,
      facingMode: 'user',
      audio: false,
      ...config
    }
    
    this.eventBus = config.eventBus
    this.isInitialized = false
    this.isStreaming = false
    
    // Media elements
    this.videoElement = null
    this.canvasElement = null
    this.ctx = null
    this.stream = null
    
    // State tracking
    this.currentFrame = null
    this.frameCount = 0
    this.startTime = null
    this.lastCaptureTime = 0
    
    // Performance metrics
    this.metrics = {
      fps: 0,
      resolution: '0x0',
      latency: 0,
      frameDrops: 0
    }
    
    // Debug info
    this.debugInfo = {
      browserSupport: null,
      availableDevices: [],
      lastError: null
    }

    console.log('📹 CameraManager constructor called')
  }

  /**
   * Initialize camera manager with enhanced debugging
   */
  async initialize() {
    try {
      console.log('📹 Initializing Camera Manager...')
      
      // Enhanced browser support check
      await this.checkBrowserSupport()
      
      // Get DOM elements
      this.setupDOMElements()
      
      // Setup video element event listeners
      this.setupVideoEventListeners()
      
      // Setup UI event listeners
      this.setupUIEventListeners()
      
      // Get available devices
      await this.enumerateDevices()
      
      this.isInitialized = true
      console.log('✅ Camera Manager initialized successfully')
      console.log('📹 Debug info:', this.debugInfo)
      
    } catch (error) {
      console.error('❌ Camera Manager initialization failed:', error)
      this.debugInfo.lastError = error.message
      throw error
    }
  }

  /**
   * Enhanced browser support check
   */
  async checkBrowserSupport() {
    console.log('📹 Checking browser support...')
    
    const support = {
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      legacyGetUserMedia: !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia),
      isSecureContext: window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost',
      protocol: location.protocol,
      hostname: location.hostname,
      userAgent: navigator.userAgent
    }
    
    this.debugInfo.browserSupport = support
    console.log('📹 Browser support:', support)
    
    // Check for common issues
    if (!support.mediaDevices && !support.legacyGetUserMedia) {
      throw new Error('getUserMedia is not supported in this browser')
    }
    
    if (!support.isSecureContext) {
      console.error('📹 Security context issue:', {
        protocol: location.protocol,
        hostname: location.hostname,
        isSecureContext: window.isSecureContext
      })
      throw new Error('Camera access requires HTTPS or localhost. Current protocol: ' + location.protocol)
    }
    
    return support
  }

  /**
   * Setup DOM elements
   */
  setupDOMElements() {
    console.log('📹 Setting up DOM elements...')
    
    this.videoElement = document.getElementById('videoElement')
    this.canvasElement = document.getElementById('capturedCanvas')
    
    console.log('📹 DOM elements found:', {
      video: !!this.videoElement,
      canvas: !!this.canvasElement
    })
    
    if (!this.videoElement || !this.canvasElement) {
      throw new Error('Required DOM elements not found. Make sure videoElement and capturedCanvas exist.')
    }
    
    this.ctx = this.canvasElement.getContext('2d')
    console.log('📹 Canvas context created:', !!this.ctx)
  }

  /**
   * Enumerate available devices
   */
  async enumerateDevices() {
    try {
      console.log('📹 Enumerating devices...')
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn('📹 Device enumeration not supported')
        return []
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      this.debugInfo.availableDevices = videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${videoDevices.indexOf(device) + 1}`,
        kind: device.kind
      }))
      
      console.log(`📹 Found ${videoDevices.length} video devices:`, this.debugInfo.availableDevices)
      
      if (videoDevices.length === 0) {
        console.warn('📹 No camera devices found on this system')
      }
      
      return videoDevices
      
    } catch (error) {
      console.error('📹 Device enumeration failed:', error)
      return []
    }
  }

  /**
   * Setup video element event listeners
   */
  setupVideoEventListeners() {
    if (!this.videoElement) return

    this.videoElement.addEventListener('loadedmetadata', () => {
      console.log('📹 Video metadata loaded')
      this.onVideoLoaded()
    })
    
    this.videoElement.addEventListener('playing', () => {
      console.log('📹 Video playing')
      this.onVideoPlaying()
    })
    
    this.videoElement.addEventListener('error', (event) => {
      console.error('📹 Video element error:', event)
      this.onVideoError(event)
    })
    
    this.videoElement.addEventListener('loadstart', () => {
      console.log('📹 Video loading started')
    })
    
    this.videoElement.addEventListener('canplay', () => {
      console.log('📹 Video can start playing')
    })
  }

  /**
   * Setup UI event listeners
   */
  setupUIEventListeners() {
    // Start camera button
    const startBtn = document.getElementById('startCameraBtn')
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        console.log('📹 Start camera button clicked')
        this.start()
      })
    } else {
      console.warn('📹 Start camera button not found')
    }
    
    // Stop camera button
    const stopBtn = document.getElementById('stopCameraBtn')
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        console.log('📹 Stop camera button clicked')
        this.stop()
      })
    } else {
      console.warn('📹 Stop camera button not found')
    }
    
    // Capture button
    const captureBtn = document.getElementById('captureBtn')
    if (captureBtn) {
      captureBtn.addEventListener('click', () => {
        console.log('📹 Capture button clicked')
        this.captureFrame()
      })
    } else {
      console.warn('📹 Capture button not found')
    }
  }

  /**
   * Start camera stream with enhanced error handling
   */
  async start() {
    if (this.isStreaming) {
      console.log('📹 Camera already streaming')
      return
    }
    
    try {
      console.log('📹 Starting camera...')
      
      // Build constraints with fallbacks
      const constraints = this.buildConstraintsWithFallbacks()
      console.log('📹 Using constraints:', constraints)
      
      // Try to get user media
      this.stream = await this.getUserMediaWithFallbacks(constraints)
      console.log('📹 Got media stream:', this.stream)
      
      // Set stream to video element
      this.videoElement.srcObject = this.stream
      console.log('📹 Stream assigned to video element')
      
      // Wait for video to be ready
      await this.waitForVideoReady()
      console.log('📹 Video is ready')
      
      // Get actual capabilities
      const videoTrack = this.stream.getVideoTracks()[0]
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities?.()
        const settings = videoTrack.getSettings?.()
        console.log('📹 Track capabilities:', capabilities)
        console.log('📹 Track settings:', settings)
        
        if (settings) {
          this.metrics.resolution = `${settings.width || 0}x${settings.height || 0}`
          this.metrics.fps = settings.frameRate || 0
        }
      }
      
      this.isStreaming = true
      this.startTime = Date.now()
      this.frameCount = 0
      
      // Update UI
      this.updateCameraControls(true)
      this.updateCameraStats()
      
      // Emit event
      this.eventBus?.emit('camera:started', {
        resolution: this.metrics.resolution,
        debugInfo: this.debugInfo
      })
      
      console.log('✅ Camera started successfully')
      
    } catch (error) {
      console.error('❌ Failed to start camera:', error)
      
      // Enhanced error handling
      const errorInfo = this.analyzeError(error)
      this.debugInfo.lastError = errorInfo
      
      console.log('📹 Error analysis:', errorInfo)
      
      this.eventBus?.emit('camera:error', errorInfo)
      
      // Show user-friendly error message
      this.showUserFriendlyError(errorInfo)
      
      throw error
    }
  }

  /**
   * Build constraints with fallbacks
   */
  buildConstraintsWithFallbacks() {
    // Start with ideal constraints
    const idealConstraints = {
      video: {
        width: { ideal: this.config.resolution.width },
        height: { ideal: this.config.resolution.height },
        frameRate: { ideal: this.config.fps },
        facingMode: this.config.facingMode
      },
      audio: this.config.audio
    }
    
    return idealConstraints
  }

  /**
   * Get user media with fallbacks
   */
  async getUserMediaWithFallbacks(constraints) {
    const attempts = [
      // Try with full constraints
      constraints,
      
      // Fallback 1: Lower resolution
      {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: this.config.facingMode
        },
        audio: false
      },
      
      // Fallback 2: Basic video only
      {
        video: true,
        audio: false
      },
      
      // Fallback 3: Any video device
      {
        video: {}
      }
    ]
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`📹 Attempt ${i + 1}:`, attempts[i])
        
        // Try modern API first
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          return await navigator.mediaDevices.getUserMedia(attempts[i])
        }
        
        // Fallback to legacy API
        return await this.getLegacyUserMedia(attempts[i])
        
      } catch (error) {
        console.log(`📹 Attempt ${i + 1} failed:`, error.message)
        
        if (i === attempts.length - 1) {
          throw error // Re-throw the last error
        }
      }
    }
  }

  /**
   * Legacy getUserMedia with Promise wrapper
   */
  getLegacyUserMedia(constraints) {
    return new Promise((resolve, reject) => {
      const getUserMedia = navigator.getUserMedia || 
                          navigator.webkitGetUserMedia || 
                          navigator.mozGetUserMedia
      
      if (!getUserMedia) {
        reject(new Error('getUserMedia not supported'))
        return
      }
      
      getUserMedia.call(navigator, constraints, resolve, reject)
    })
  }

  /**
   * Analyze error and provide actionable information
   */
  analyzeError(error) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      type: 'unknown',
      userMessage: 'An unknown camera error occurred',
      suggestions: [],
      canRetry: false
    }
    
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        errorInfo.type = 'permission'
        errorInfo.userMessage = 'Camera access was denied'
        errorInfo.suggestions = [
          'Click the camera icon in your browser address bar',
          'Select "Allow" when prompted for camera access',
          'Check browser settings to allow camera access',
          'Try refreshing the page'
        ]
        errorInfo.canRetry = true
        break
        
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        errorInfo.type = 'no-device'
        errorInfo.userMessage = 'No camera device found'
        errorInfo.suggestions = [
          'Make sure a camera is connected to your device',
          'Check if other apps are using the camera',
          'Try restarting your browser'
        ]
        break
        
      case 'NotReadableError':
      case 'TrackStartError':
        errorInfo.type = 'device-busy'
        errorInfo.userMessage = 'Camera is already in use'
        errorInfo.suggestions = [
          'Close other apps that might be using the camera',
          'Restart your browser',
          'Check if another browser tab is using the camera'
        ]
        errorInfo.canRetry = true
        break
        
      case 'OverconstrainedError':
        errorInfo.type = 'constraints'
        errorInfo.userMessage = 'Camera settings not supported'
        errorInfo.suggestions = [
          'Your camera does not support the requested settings',
          'Try with lower resolution settings'
        ]
        errorInfo.canRetry = true
        break
        
      case 'SecurityError':
        errorInfo.type = 'security'
        errorInfo.userMessage = 'Camera access blocked due to security restrictions'
        errorInfo.suggestions = [
          'Make sure you are accessing via HTTPS or localhost',
          'Check if your browser blocks camera access on this site'
        ]
        break
        
      default:
        if (error.message.includes('https') || error.message.includes('secure')) {
          errorInfo.type = 'security'
          errorInfo.userMessage = 'Camera requires secure connection'
          errorInfo.suggestions = [
            'Access the page via HTTPS or localhost',
            'Current protocol: ' + location.protocol
          ]
        }
        break
    }
    
    return errorInfo
  }

  /**
   * Show user-friendly error message
   */
  showUserFriendlyError(errorInfo) {
    const message = `${errorInfo.userMessage}\n\nSuggestions:\n${errorInfo.suggestions.join('\n')}`
    
    // Try to show via UI manager, fallback to alert
    if (this.eventBus) {
      this.eventBus.emit('ui:show-error', {
        title: 'Camera Error',
        message: errorInfo.userMessage,
        suggestions: errorInfo.suggestions,
        canRetry: errorInfo.canRetry
      })
    } else {
      alert(message)
    }
  }

  /**
   * Wait for video to be ready with timeout
   */
  waitForVideoReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video loading timeout after 10 seconds'))
      }, 10000)
      
      const checkReady = () => {
        if (this.videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          clearTimeout(timeout)
          resolve()
        } else {
          setTimeout(checkReady, 100)
        }
      }
      
      checkReady()
    })
  }

  /**
   * Stop camera stream
   */
  async stop() {
    if (!this.isStreaming) {
      console.log('📹 Camera not streaming')
      return
    }
    
    try {
      console.log('📹 Stopping camera...')
      
      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop()
          console.log(`📹 Stopped ${track.kind} track`)
        })
      }
      
      // Clear video element
      this.videoElement.srcObject = null
      
      // Reset state
      this.stream = null
      this.isStreaming = false
      this.currentFrame = null
      
      // Update UI
      this.updateCameraControls(false)
      this.resetCameraStats()
      
      // Emit event
      this.eventBus?.emit('camera:stopped')
      
      console.log('✅ Camera stopped successfully')
      
    } catch (error) {
      console.error('❌ Failed to stop camera:', error)
      this.eventBus?.emit('camera:error', { 
        message: 'Failed to stop camera',
        original: error 
      })
    }
  }
  
  /**
   * Capture frame
   */
  captureFrame() {
    if (!this.isStreaming) {
      console.warn('📹 Cannot capture frame - camera not streaming')
      return null
    }
    
    try {
      // Get video dimensions
      const videoWidth = this.videoElement.videoWidth
      const videoHeight = this.videoElement.videoHeight
      
      console.log(`📹 Capturing frame: ${videoWidth}x${videoHeight}`)
      
      if (videoWidth === 0 || videoHeight === 0) {
        throw new Error('Video dimensions not available')
      }
      
      // Set canvas size
      this.canvasElement.width = videoWidth
      this.canvasElement.height = videoHeight
      
      // Draw current frame
      this.ctx.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight)
      
      // Get image data
      const imageDataUrl = this.canvasElement.toDataURL('image/jpeg', 0.8)
      const imageData = this.ctx.getImageData(0, 0, videoWidth, videoHeight)
      
      // Store current frame
      this.currentFrame = {
        dataUrl: imageDataUrl,
        imageData: imageData,
        timestamp: Date.now(),
        width: videoWidth,
        height: videoHeight
      }
      
      this.lastCaptureTime = Date.now()
      this.frameCount++
      
      // Emit event
      this.eventBus?.emit('camera:frame-captured', this.currentFrame)
      
      console.log(`📹 Frame captured: ${videoWidth}x${videoHeight}`)
      return this.currentFrame
      
    } catch (error) {
      console.error('❌ Failed to capture frame:', error)
      this.eventBus?.emit('camera:error', { 
        message: 'Failed to capture frame',
        original: error 
      })
      return null
    }
  }

  /**
   * Get current frame
   */
  getCurrentFrame() {
    if (!this.isStreaming) {
      return null
    }
    
    // Auto-capture if no current frame or frame is old
    const now = Date.now()
    if (!this.currentFrame || (now - this.currentFrame.timestamp) > 1000) {
      return this.captureFrame()
    }
    
    return this.currentFrame
  }

  onVideoLoaded() {
    const { videoWidth, videoHeight } = this.videoElement
    console.log(`📹 Video loaded: ${videoWidth}x${videoHeight}`)
    
    this.metrics.resolution = `${videoWidth}x${videoHeight}`
    this.updateCameraStats()
  }

  onVideoPlaying() {
    console.log('📹 Video playing')
    this.startTime = Date.now()
  }

  onVideoError(event) {
    console.error('📹 Video error:', event)
    this.eventBus?.emit('camera:error', { 
      message: 'Video playback error',
      original: event 
    })
  }

  updateCameraControls(cameraActive) {
    const startBtn = document.getElementById('startCameraBtn')
    const stopBtn = document.getElementById('stopCameraBtn')
    const captureBtn = document.getElementById('captureBtn')
    
    if (startBtn) startBtn.disabled = cameraActive
    if (stopBtn) stopBtn.disabled = !cameraActive
    if (captureBtn) captureBtn.disabled = !cameraActive
    
    console.log('📹 Updated camera controls:', { cameraActive })
  }

  updateCameraStats() {
    const resolutionEl = document.getElementById('cameraResolution')
    const fpsEl = document.getElementById('cameraFPS')
    
    if (resolutionEl) resolutionEl.textContent = this.metrics.resolution
    if (fpsEl) fpsEl.textContent = this.metrics.fps
    
    console.log('📹 Updated camera stats:', this.metrics)
  }

  resetCameraStats() {
    const resolutionEl = document.getElementById('cameraResolution')
    const fpsEl = document.getElementById('cameraFPS')
    
    if (resolutionEl) resolutionEl.textContent = '-'
    if (fpsEl) fpsEl.textContent = '0'
    
    this.metrics = {
      fps: 0,
      resolution: '0x0',
      latency: 0,
      frameDrops: 0
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      ...this.debugInfo,
      isInitialized: this.isInitialized,
      isStreaming: this.isStreaming,
      currentResolution: this.metrics.resolution,
      browserInfo: {
        userAgent: navigator.userAgent,
        protocol: location.protocol,
        hostname: location.hostname,
        isSecureContext: window.isSecureContext
      }
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isStreaming: this.isStreaming,
      metrics: { ...this.metrics },
      hasCurrentFrame: !!this.currentFrame,
      debugInfo: this.getDebugInfo()
    }
  }

  async shutdown() {
    console.log('📹 Shutting down Camera Manager...')
    
    await this.stop()
    
    this.isInitialized = false
    console.log('✅ Camera Manager shut down')
  }
}

export default CameraManager
export class AIService {
  constructor(config = {}) {
    this.config = {
      serverUrl: 'http://localhost:8000',
      timeout: 90000, 
      retryAttempts: 1,
      retryDelay: 5000,  
      maxTokens: 300,    
      temperature: 0.1,
      topP: 0.9,
      repetitionPenalty: 1.1,
      maxImageSize: 512,
      imageQuality: 0.8,
      ...config
    }
    
    this.eventBus = config.eventBus
    this.isInitialized = false
    this.isConnected = false
    this.serverCapabilities = null
    
    // Connection state
    this.lastHealthCheck = 0
    this.healthCheckInterval = 30000 
    this.connectionRetries = 0
    this.maxConnectionRetries = 3
    
    // Request tracking
    this.requestQueue = []
    this.activeRequests = new Map()
    this.requestHistory = []
    this.maxHistorySize = 50
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastError: null,
      uptimeStart: Date.now()
    }
    
    // Server info
    this.supportedModels = []
    this.currentModel = null
    this.serverStats = null
  }

  /**
   * Initialize AI Service with enhanced error handling
   */
  async initialize() {
    try {
      console.log('🤖 Initializing AI Service...')
      
      this.setupEventListeners()
      await this.testConnection()
      await this.getServerInfo()
      this.startHealthMonitoring()
      
      this.isInitialized = true
      console.log('✅ AI Service initialized successfully')
      
      this.eventBus?.emit('ai:initialized', { 
        serverUrl: this.config.serverUrl,
        capabilities: this.serverCapabilities
      })
      
    } catch (error) {
      console.error('❌ AI Service initialization failed:', error)
      this.isConnected = false
      this.eventBus?.emit('ai:initialization-failed', { error: error.message })
      throw error
    }
  }

  /**
   * Enhanced connection testing
   */
  async testConnection() {
    const startTime = Date.now()
    
    try {
      console.log(`🤖 Testing connection to ${this.config.serverUrl}...`)
      
      const response = await this.makeRequest('/health', 'GET', null, { timeout: 15000 })
      
      if (response.status === 'healthy' || response.status === 'ok') {
        this.isConnected = true
        this.connectionRetries = 0
        this.lastHealthCheck = Date.now()
        this.serverCapabilities = response
        
        const responseTime = Date.now() - startTime
        console.log(`✅ AI server connected (${responseTime}ms)`)
        console.log(`📊 Server info: ${response.model || 'SmolVLM'}`)
        
        this.eventBus?.emit('ai:connected', {
          serverUrl: this.config.serverUrl,
          responseTime,
          serverInfo: response
        })
        
        return true
      } else {
        throw new Error('Server returned unhealthy status')
      }
      
    } catch (error) {
      this.isConnected = false
      this.connectionRetries++
      
      console.error(`❌ AI server connection failed (attempt ${this.connectionRetries}):`, error.message)
      
      this.eventBus?.emit('ai:disconnected', {
        error: error.message,
        retries: this.connectionRetries,
        willRetry: this.connectionRetries < this.maxConnectionRetries
      })
      
      // Auto-retry with backoff
      if (this.connectionRetries < this.maxConnectionRetries) {
        const delay = this.config.retryDelay * this.connectionRetries
        console.log(`🤖 Retrying connection in ${delay}ms...`)
        
        setTimeout(() => {
          this.retryConnection()
        }, delay)
      }
      
      return false
    }
  }

  /**
   * Get server information
   */
  async getServerInfo() {
    try {
      const statsResponse = await this.makeRequest('/health', 'GET', null, { 
        timeout: 10000, 
        suppressErrors: true 
      })
      
      if (statsResponse) {
        this.serverStats = statsResponse
        this.currentModel = statsResponse.model || 'SmolVLM-Instruct'
        console.log('📊 Server statistics retrieved')
      }
      
    } catch (error) {
      console.log('🤖 Extended server info not available, using basic configuration')
    }
  }

  /**
   * FIXED: Enhanced image analysis with proper timeout handling
   */
  async analyzeImage(imageDataUrl, prompt, options = {}) {
    if (!this.isConnected) {
      throw new Error('AI service not connected. Please check your server configuration.')
    }

    const requestId = this.generateRequestId()
    const startTime = Date.now()
    
    try {
      console.log(`🤖 [${requestId}] Analyzing image with prompt: "${prompt.substring(0, 50)}..."`)
      
      // Optimize image if needed
      const optimizedImage = await this.optimizeImage(imageDataUrl)
      
      // FIXED: Determine if this is quick mode
      const isQuickMode = options.quick_mode || options.realtime || false
      
      // FIXED: Prepare request body with proper parameters
      const requestBody = {
        model: options.model || this.currentModel || 'SmolVLM-Instruct',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              image_url: { url: optimizedImage }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }],
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        top_p: options.topP || this.config.topP,
        repetition_penalty: options.repetitionPenalty || this.config.repetitionPenalty,
        stream: false,
        quick_mode: isQuickMode  // Pass quick mode to server
      }
      
      // Track active request
      this.activeRequests.set(requestId, {
        startTime,
        prompt: prompt.substring(0, 100),
        status: 'processing',
        imageSize: this.getImageSize(imageDataUrl),
        quickMode: isQuickMode
      })
      
      // Emit progress start
      this.eventBus?.emit('ai:analysis-started', { 
        requestId, 
        prompt: prompt.substring(0, 50) + '...',
        quickMode: isQuickMode
      })
      
      // FIXED: Use appropriate timeout based on mode
      const requestTimeout = isQuickMode ? 45000 : (options.timeout || this.config.timeout)
      
      console.log(`🤖 [${requestId}] Using ${isQuickMode ? 'QUICK' : 'NORMAL'} mode (timeout: ${requestTimeout}ms)`)
      
      // Make request with proper timeout
      const response = await this.makeRequestWithRetry(
        '/v1/chat/completions', 
        'POST', 
        requestBody,
        { requestId, timeout: requestTimeout }
      )
      
      // Validate response
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response choices returned from AI server')
      }
      
      const totalTime = Date.now() - startTime
      const processingTimes = response.processing_metadata || {}
      
      const result = {
        content: response.choices[0].message.content,
        model: response.model || this.currentModel,
        usage: response.usage || {},
        requestId,
        responseTime: totalTime,
        processingTime: processingTimes,
        timestamp: Date.now(),
        quickMode: isQuickMode
      }
      
      // Update metrics
      this.updateMetrics(true, totalTime)
      
      // Update request tracking
      this.activeRequests.get(requestId).status = 'completed'
      this.addToHistory(requestId, 'success', result)
      
      console.log(`✅ [${requestId}] Analysis completed in ${totalTime}ms`)
      
      this.eventBus?.emit('ai:analysis-completed', { 
        requestId, 
        result,
        performance: processingTimes
      })
      
      return result
      
    } catch (error) {
      const responseTime = Date.now() - startTime
      
      // Determine error type
      const isTimeout = error.name === 'TimeoutError' || error.message.includes('timeout')
      
      // Update metrics
      this.updateMetrics(false, responseTime, isTimeout)
      
      // Update request tracking
      if (this.activeRequests.has(requestId)) {
        this.activeRequests.get(requestId).status = 'failed'
      }
      this.addToHistory(requestId, 'error', { error: error.message, isTimeout })
      
      console.error(`❌ [${requestId}] Image analysis failed after ${responseTime}ms:`, error.message)
      
      this.eventBus?.emit('ai:analysis-error', { 
        error: error.message,
        requestId,
        responseTime,
        isTimeout
      })
      
      throw error
      
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  /**
   * Optimize image for processing
   */
  async optimizeImage(imageDataUrl) {
    try {
      // Skip if already small
      if (this.getImageSize(imageDataUrl) < 100 * 1024) { // Less than 100KB
        return imageDataUrl
      }
      
      return new Promise((resolve) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        img.onload = () => {
          const maxSize = this.config.maxImageSize
          let { width, height } = img
          
          // Calculate new dimensions
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height)
            width = Math.floor(width * ratio)
            height = Math.floor(height * ratio)
          }
          
          // Resize canvas
          canvas.width = width
          canvas.height = height
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height)
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', this.config.imageQuality)
          
          console.log(`⚡ Image optimized: ${this.getImageSize(imageDataUrl)}B → ${this.getImageSize(optimizedDataUrl)}B`)
          resolve(optimizedDataUrl)
        }
        
        img.onerror = () => resolve(imageDataUrl) // Fallback to original
        img.src = imageDataUrl
      })
      
    } catch (error) {
      console.warn('⚠️ Image optimization failed, using original:', error.message)
      return imageDataUrl
    }
  }

  /**
   * Get approximate image size
   */
  getImageSize(dataUrl) {
    try {
      const base64 = dataUrl.split(',')[1] || dataUrl
      return Math.round((base64.length * 3) / 4)
    } catch {
      return 0
    }
  }

  /**
   * FIXED: Enhanced request with proper timeout handling
   */
  async makeRequest(endpoint, method = 'POST', body = null, options = {}) {
    const {
      timeout = this.config.timeout,
      headers = {},
      suppressErrors = false
    } = options
    
    const url = `${this.config.serverUrl}${endpoint}`
    const controller = new AbortController()
    
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeout)
    
    try {
      const requestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        signal: controller.signal
      }
      
      if (body) {
        requestOptions.body = JSON.stringify(body)
      }
      
      const response = await fetch(url, requestOptions)
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        let errorText = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          errorText = errorData.error || errorText
        } catch {
          errorText = await response.text() || errorText
        }
        throw new Error(errorText)
      }
      
      return await response.json()
      
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`)
        timeoutError.name = 'TimeoutError'
        throw timeoutError
      }
      
      if (!suppressErrors) {
        this.metrics.lastError = {
          message: error.message,
          timestamp: Date.now(),
          endpoint
        }
      }
      
      throw error
    }
  }

  /**
   * Enhanced retry logic
   */
  async makeRequestWithRetry(endpoint, method, body, options = {}) {
    const { requestId } = options
    let lastError = null
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.makeRequest(endpoint, method, body, options)
        
      } catch (error) {
        lastError = error
        
        // Don't retry on certain errors
        const noRetryErrors = ['400', '401', '403', '404']
        const shouldNotRetry = noRetryErrors.some(errType => 
          error.message.includes(errType)
        )
        
        if (shouldNotRetry || attempt >= this.config.retryAttempts) {
          break
        }
        
        const delay = this.config.retryDelay * attempt
        console.log(`🤖 [${requestId}] Retrying request (attempt ${attempt + 1}/${this.config.retryAttempts}) in ${delay}ms`)
        
        this.eventBus?.emit('ai:request-retry', { 
          requestId, 
          attempt: attempt + 1, 
          delay, 
          error: error.message 
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError
  }

  /**
   * FIXED: Enhanced metrics tracking
   */
  updateMetrics(success, responseTime, isTimeout = false) {
    this.metrics.totalRequests++
    
    if (success) {
      this.metrics.successfulRequests++
      this.metrics.totalResponseTime += responseTime
      this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.successfulRequests
    } else {
      this.metrics.failedRequests++
      if (isTimeout) {
        this.metrics.timeoutRequests++
      }
    }
    
    this.eventBus?.emit('ai:metrics-updated', { ...this.metrics })
  }

  /**
   * Enhanced health monitoring
   */
  async performHealthCheck() {
    if (!this.isConnected) return
    
    const now = Date.now()
    if (now - this.lastHealthCheck < this.healthCheckInterval) return
    
    try {
      const healthResponse = await this.makeRequest('/health', 'GET', null, { 
        timeout: 15000,
        suppressErrors: true 
      })
      
      this.lastHealthCheck = now
      
      // Update server capabilities if they've changed
      if (JSON.stringify(healthResponse) !== JSON.stringify(this.serverCapabilities)) {
        this.serverCapabilities = healthResponse
        this.eventBus?.emit('ai:capabilities-updated', healthResponse)
      }
      
    } catch (error) {
      console.warn('🤖 Health check failed:', error.message)
      this.isConnected = false
      
      this.eventBus?.emit('ai:health-check-failed', { 
        error: error.message,
        willRetry: true
      })
      
      // Attempt to reconnect
      setTimeout(() => this.testConnection(), 10000)
    }
  }

  /**
   * Get comprehensive service status
   */
  getStatus() {
    const uptime = Date.now() - this.metrics.uptimeStart
    
    return {
      isInitialized: this.isInitialized,
      isConnected: this.isConnected,
      serverUrl: this.config.serverUrl,
      uptime,
      metrics: { ...this.metrics, uptime },
      activeRequests: this.activeRequests.size,
      connectionRetries: this.connectionRetries,
      currentModel: this.currentModel,
      serverCapabilities: this.serverCapabilities,
      serverStats: this.serverStats,
      config: { ...this.config }
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.eventBus?.on('config:ai-server-changed', (event) => {
      this.updateServerUrl(event.data.url)
    })
    
    this.eventBus?.on('ai:test-connection', () => {
      this.testConnection()
    })
    
    this.eventBus?.on('ai:retry-connection', () => {
      this.retryConnection()
    })
  }

  /**
   * Update server URL
   */
  updateServerUrl(newUrl) {
    const oldUrl = this.config.serverUrl
    this.config.serverUrl = newUrl.trim()
    
    if (oldUrl !== this.config.serverUrl) {
      console.log(`🤖 Server URL updated: ${this.config.serverUrl}`)
      this.isConnected = false
      this.connectionRetries = 0
      this.testConnection()
    }
  }

  /**
   * Retry connection
   */
  async retryConnection() {
    console.log('🤖 Retrying connection...')
    await this.testConnection()
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval)
    }
    
    this.healthMonitorInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckInterval)
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval)
      this.healthMonitorInterval = null
    }
  }

  /**
   * Add to history
   */
  addToHistory(requestId, status, data) {
    this.requestHistory.unshift({
      id: requestId,
      status,
      data,
      timestamp: Date.now()
    })
    
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(0, this.maxHistorySize)
    }
  }

  /**
   * Generate request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get history
   */
  getHistory(limit = 10) {
    return this.requestHistory.slice(0, limit)
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.requestHistory = []
    console.log('🤖 Request history cleared')
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...newConfig }
    
    if (oldConfig.serverUrl !== this.config.serverUrl) {
      this.updateServerUrl(this.config.serverUrl)
    }
    
    console.log('🤖 Configuration updated')
  }

  /**
   * Shutdown
   */
  async shutdown() {
    console.log('🤖 Shutting down AI Service...')
    
    this.stopHealthMonitoring()
    
    for (const [requestId] of this.activeRequests) {
      console.log(`🤖 Cancelling active request: ${requestId}`)
    }
    this.activeRequests.clear()
    
    this.isInitialized = false
    this.isConnected = false
    
    console.log('✅ AI Service shut down')
  }
}

export default AIService
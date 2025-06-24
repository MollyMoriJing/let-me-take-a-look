export class AIService {
  constructor(config = {}) {
    this.config = {
      serverUrl: 'http://localhost:8000',
      timeout: 120000,
      retryAttempts: 1,
      retryDelay: 120000,
      maxTokens: 150,
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.1,
      maxImageSize: 516,
      imageQuality: 0.2,
      ...config
    }
    
    this.eventBus = config.eventBus
    this.isInitialized = false
    this.isConnected = false
    this.serverCapabilities = null
    
    // Connection state
    this.lastHealthCheck = 0
    this.healthCheckInterval = 15000
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
      averageInferenceTime: 0,
      totalInferenceTime: 0,
      successfulInferences: 0,
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
      console.log('🤖 Initializing Enhanced AI Service...')
      
      this.setupEventListeners()
      await this.testConnection()
      await this.getServerInfo()
      await this.getServerCapabilities()
      this.startHealthMonitoring()
      
      this.isInitialized = true
      console.log('✅ Enhanced AI Service initialized successfully')
      
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
   * Enhanced connection testing with detailed diagnostics
   */
  async testConnection() {
    const startTime = Date.now()
    
    try {
      console.log(`🤖 Testing connection to ${this.config.serverUrl}...`)
      
      const response = await this.makeRequest('/health', 'GET', null, { timeout: 10000 })
      
      if (response.status === 'healthy' || response.status === 'ok') {
        this.isConnected = true
        this.connectionRetries = 0
        this.lastHealthCheck = Date.now()
        this.serverCapabilities = response
        
        const responseTime = Date.now() - startTime
        console.log(`✅ AI server connected (${responseTime}ms)`)
        console.log(`📊 Server info: ${response.model} on ${response.device}`)
        
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
      
      // Auto-retry with exponential backoff
      if (this.connectionRetries < this.maxConnectionRetries) {
        const delay = this.config.retryDelay * Math.pow(2, this.connectionRetries - 1)
        console.log(`🤖 Retrying connection in ${delay}ms...`)
        
        setTimeout(() => {
          this.retryConnection()
        }, delay)
      }
      
      return false
    }
  }

  /**
   * Get detailed server information
   */
  async getServerInfo() {
    try {
      const [modelsResponse, statsResponse] = await Promise.allSettled([
        this.makeRequest('/v1/models', 'GET', null, { timeout: 10000, suppressErrors: true }),
        this.makeRequest('/stats', 'GET', null, { timeout: 10000, suppressErrors: true })
      ])
      
      if (modelsResponse.status === 'fulfilled' && modelsResponse.value?.data) {
        this.supportedModels = modelsResponse.value.data
        this.currentModel = this.supportedModels[0]?.id || 'SmolVLM-Instruct'
        console.log(`🤖 Found ${this.supportedModels.length} supported models`)
      }
      
      if (statsResponse.status === 'fulfilled' && statsResponse.value) {
        this.serverStats = statsResponse.value
        console.log('📊 Server statistics retrieved')
      }
      
    } catch (error) {
      console.log('🤖 Extended server info not available, using basic configuration')
    }
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities() {
    try {
      const configResponse = await this.makeRequest('/config', 'GET', null, { 
        timeout: 10000, 
        suppressErrors: true 
      })
      
      if (configResponse) {
        this.serverCapabilities = { ...this.serverCapabilities, ...configResponse }
        console.log('⚙️ Server capabilities retrieved')
      }
      
    } catch (error) {
      console.log('⚙️ Server config endpoint not available')
    }
  }

  /**
   * Enhanced image analysis with progress tracking and optimization
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
      
      // Prepare enhanced request body
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
        stream: false
      }
      
      // Track active request with progress
      this.activeRequests.set(requestId, {
        startTime,
        prompt: prompt.substring(0, 100),
        status: 'processing',
        imageSize: this.getImageSize(imageDataUrl)
      })
      
      // Emit progress start
      this.eventBus?.emit('ai:analysis-started', { 
        requestId, 
        prompt: prompt.substring(0, 50) + '...' 
      })
      
      // Make request with enhanced retry logic and longer timeout
      const response = await this.makeRequestWithRetry(
        '/v1/chat/completions', 
        'POST', 
        requestBody,
        { requestId, timeout: this.config.timeout } // Use the full timeout
      )
      
      // Validate response
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response choices returned from AI server')
      }
      
      const totalTime = Date.now() - startTime
      const processingTimes = response.processing_time || {}
      
      const result = {
        content: response.choices[0].message.content,
        model: response.model || this.currentModel,
        usage: response.usage || {},
        requestId,
        responseTime: totalTime,
        processingTime: processingTimes,
        timestamp: Date.now()
      }
      
      // Update metrics
      this.updateMetrics(true, totalTime, processingTimes.inference || 0)
      
      // Update request tracking
      this.activeRequests.get(requestId).status = 'completed'
      this.addToHistory(requestId, 'success', result)
      
      console.log(`✅ [${requestId}] Analysis completed in ${totalTime}ms`)
      console.log(`⚡ Performance: ${processingTimes.inference || 0}ms inference, ${processingTimes.total || totalTime}ms total`)
      
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
      this.updateMetrics(false, responseTime, 0, isTimeout)
      
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
   * Optimize image for faster processing - More aggressive optimization
   */
  async optimizeImage(imageDataUrl) {
    try {
      // Skip if already optimized or small
      if (this.getImageSize(imageDataUrl) < 50 * 1024) { // Less than 50KB
        return imageDataUrl
      }
      
      return new Promise((resolve) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        img.onload = () => {
          // More aggressive size reduction for faster processing
          const maxSize = Math.min(this.config.maxImageSize, 512) // Limit to 512px max
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
          
          // Draw and compress more aggressively
          ctx.drawImage(img, 0, 0, width, height)
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7) // Lower quality for speed
          
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
   * Enhanced request with better error handling and longer timeout
   */
  async makeRequest(endpoint, method = 'POST', body = null, options = {}) {
    const {
      timeout = this.config.timeout, // Use full timeout by default
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
   * Enhanced retry logic with exponential backoff
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
        const noRetryErrors = ['400', '401', '403', '404', 'timeout', 'GPU out of memory']
        const shouldNotRetry = noRetryErrors.some(errType => 
          error.message.toLowerCase().includes(errType.toLowerCase())
        )
        
        if (shouldNotRetry || attempt >= this.config.retryAttempts) {
          break
        }
        
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1) // Exponential backoff
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
   * Enhanced metrics tracking
   */
  updateMetrics(success, responseTime, inferenceTime = 0, isTimeout = false) {
    this.metrics.totalRequests++
    
    if (success) {
      this.metrics.successfulRequests++
      this.metrics.totalResponseTime += responseTime
      this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.successfulRequests
      
      if (inferenceTime > 0) {
        this.metrics.totalInferenceTime += inferenceTime
        this.metrics.successfulInferences++
        this.metrics.averageInferenceTime = this.metrics.totalInferenceTime / this.metrics.successfulInferences
      }
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
        timeout: 10000, // Shorter timeout for health checks
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
      setTimeout(() => this.testConnection(), 5000)
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
      supportedModels: [...this.supportedModels],
      currentModel: this.currentModel,
      serverCapabilities: this.serverCapabilities,
      serverStats: this.serverStats,
      config: { ...this.config }
    }
  }

  /**
   * Update server configuration
   */
  async updateServerConfig(newConfig) {
    try {
      const response = await this.makeRequest('/config', 'POST', newConfig, { timeout: 10000 })
      
      if (response.status === 'updated') {
        console.log('⚙️ Server configuration updated')
        this.serverCapabilities = { ...this.serverCapabilities, ...response.config }
        this.eventBus?.emit('ai:server-config-updated', response.config)
        return response.config
      }
      
      throw new Error('Failed to update server configuration')
      
    } catch (error) {
      console.error('❌ Failed to update server config:', error.message)
      throw error
    }
  }

  // ... (rest of the methods remain the same with minor enhancements)
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
    
    this.eventBus?.on('ai:optimize-settings', (event) => {
      this.updateConfig(event.data)
    })
  }

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

  async retryConnection() {
    console.log('🤖 Retrying connection...')
    await this.testConnection()
  }

  startHealthMonitoring() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval)
    }
    
    this.healthMonitorInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckInterval)
  }

  stopHealthMonitoring() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval)
      this.healthMonitorInterval = null
    }
  }

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

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getHistory(limit = 10) {
    return this.requestHistory.slice(0, limit)
  }

  clearHistory() {
    this.requestHistory = []
    console.log('🤖 Request history cleared')
  }

  updateConfig(newConfig) {
    const oldConfig = { ...this.config }
    this.config = { ...this.config, ...newConfig }
    
    if (oldConfig.serverUrl !== this.config.serverUrl) {
      this.updateServerUrl(this.config.serverUrl)
    }
    
    console.log('🤖 Configuration updated')
  }

  async shutdown() {
    console.log('🤖 Shutting down Enhanced AI Service...')
    
    this.stopHealthMonitoring()
    
    for (const [requestId] of this.activeRequests) {
      console.log(`🤖 Cancelling active request: ${requestId}`)
    }
    this.activeRequests.clear()
    
    this.isInitialized = false
    this.isConnected = false
    
    console.log('✅ Enhanced AI Service shut down')
  }
}

export default AIService
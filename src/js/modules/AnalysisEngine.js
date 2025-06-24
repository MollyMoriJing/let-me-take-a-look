/**
 * AnalysisEngine - FIXED version with proper initialization
 * Enhanced with accessibility prompts for blind users
 */

const ACCESSIBILITY_PROMPTS = {
  DETAILED_SCENE: `Describe what you see in this image in detail. Include information about people, objects, colors, text, lighting, and any safety considerations. Be specific and comprehensive.`,

  NAVIGATION_HELP: `Help a blind person navigate safely. Describe pathways, obstacles, stairs, doors, ground surface, and any hazards. Focus on mobility and safety.`,

  TEXT_READER: `Read all visible text in this image out loud. Include signs, labels, documents, menus, or any written content. Read exactly as written.`,

  SHOPPING_ASSISTANT: `Identify products for shopping. Include product names, brands, prices, sizes, expiration dates, and any important product information.`,

  SOCIAL_CONTEXT: `Describe this social situation. Include how many people, what they're doing, the setting, mood, seating arrangements, and social context.`,

  CLOTHING_ASSISTANT: `Describe clothing and appearance in detail. Include colors, styles, fit, condition, accessories, and overall appearance.`,

  DOCUMENT_READER: `Read this document completely. Include titles, main content, form fields, dates, contact information, and instructions.`,

  FOOD_HELPER: `Describe food and cooking information. Include food items, cooking state, freshness, safety considerations, and any instructions.`,

  SAFETY_ALERT: `Analyze for safety and emergency information. Identify hazards, emergency exits, warning signs, and safety equipment.`,

  TECH_HELPER: `Help with technology and devices. Describe screens, buttons, controls, status indicators, and usage instructions.`
}

export class AnalysisEngine {
    constructor(config = {}) {
      try {
        console.log('🔍 AnalysisEngine constructor starting...')
        
        this.config = {
          // Use the full default prompt from the dropdown
          defaultPrompt: ACCESSIBILITY_PROMPTS.DETAILED_SCENE,
          maxTokens: 30,
          temperature: 0.1,
          realtimeFPS: 0.5,
          maxConcurrentRequests: 2,
          
          // Timeout settings
          timeouts: {
            normal: 90000,     
            realtime: 30000,   
            warmup: 120000 
          },
          
          // Image settings
          imageOptimization: {
            maxSize: 512,
            quality: 0.8
          },
          ...config
        }
        
        this.eventBus = config.eventBus || null
        this.isInitialized = false
        
        // Real-time analysis state
        this.isRealtimeActive = false
        this.realtimeInterval = null
        this.currentFPS = this.config.realtimeFPS
        
        // Processing queue
        this.processingQueue = []
        this.activeProcessing = new Map()
        this.maxQueueSize = 10
        
        // Analysis state - FIXED: Don't override user prompts
        this.currentPrompt = this.config.defaultPrompt
        this.isCustomPrompt = false
        this.lastAnalysisTime = 0
        
        // Store accessibility prompts
        this.accessibilityPrompts = ACCESSIBILITY_PROMPTS
        
        // Performance tracking
        this.performanceMetrics = {
          averageResponseTime: 0,
          totalRequests: 0,
          successfulRequests: 0,
          timeoutRequests: 0
        }
        
        // Dependencies
        this.cameraManager = null
        this.aiService = null
        this.uiManager = null
        
        console.log('✅ AnalysisEngine constructor completed')
        
      } catch (error) {
        console.error('❌ AnalysisEngine constructor failed:', error)
        throw new Error(`AnalysisEngine constructor failed: ${error.message}`)
      }
    }

    /**
     * Initialize Analysis Engine
     */
    async initialize() {
      try {
        console.log('🔍 Initializing Analysis Engine with accessibility features...')
        
        if (this.isInitialized) {
          console.log('✅ AnalysisEngine already initialized')
          return
        }
        
        // Validate configuration
        if (!this.config || !this.accessibilityPrompts) {
          throw new Error('Configuration or accessibility prompts not found')
        }
        
        // Setup event listeners
        this.setupEventListeners()
        
        // Initialize processing queue
        this.startQueueProcessor()
        
        this.isInitialized = true
        console.log('✅ Analysis Engine initialized with enhanced prompts for blind users')
        
        return true
        
      } catch (error) {
        console.error('❌ Analysis Engine initialization failed:', error)
        this.isInitialized = false
        throw new Error(`AnalysisEngine initialization failed: ${error.message}`)
      }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
      try {
        console.log('🔍 Setting up AnalysisEngine event listeners...')
        
        if (!this.eventBus) {
          console.warn('⚠️ EventBus not available, skipping event listener setup')
          return
        }
        
        // Listen for component references
        this.eventBus.on('app:components-ready', (event) => {
          try {
            const data = event.data || {}
            this.cameraManager = data.cameraManager || null
            this.aiService = data.aiService || null
            this.uiManager = data.uiManager || null
            console.log('🔍 AnalysisEngine received component dependencies')
          } catch (error) {
            console.error('❌ Error handling components-ready event:', error)
          }
        })

        // Listen for analysis requests
        this.eventBus.on('analysis:manual-trigger', () => {
          this.safeAnalyzeFrame()
        })

        // Listen for real-time toggle
        this.eventBus.on('realtime:toggle', (event) => {
          try {
            const enabled = event.data?.enabled || false
            if (enabled) {
              this.safeStartRealtime()
            } else {
              this.safeStopRealtime()
            }
          } catch (error) {
            console.error('❌ Error handling realtime toggle:', error)
          }
        })

        // FIXED: Listen for prompt changes properly
        this.eventBus.on('config:prompt-changed', (event) => {
          try {
            const data = event.data || {}
            this.currentPrompt = data.prompt || this.config.defaultPrompt
            this.isCustomPrompt = data.isCustom || false
            console.log('🔍 Prompt updated:', this.currentPrompt.substring(0, 50) + '...')
          } catch (error) {
            console.error('❌ Error handling prompt change:', error)
          }
        })

        this.eventBus.on('config:fps-changed', (event) => {
          try {
            const data = event.data || {}
            this.currentFPS = data.fps || this.config.realtimeFPS
            if (this.isRealtimeActive) {
              this.restartRealtime()
            }
          } catch (error) {
            console.error('❌ Error handling FPS change:', error)
          }
        })
        
        console.log('✅ Event listeners setup completed')
        
      } catch (error) {
        console.error('❌ Event listeners setup failed:', error)
        throw error
      }
    }

    /**
     * Safe wrapper methods
     */
    async safeAnalyzeFrame(options = {}) {
      try {
        return await this.analyzeFrame(options)
      } catch (error) {
        console.error('❌ Safe analyze frame failed:', error)
        this.handleAnalysisError(error)
        return null
      }
    }

    safeStartRealtime() {
      try {
        this.startRealtime()
      } catch (error) {
        console.error('❌ Safe start realtime failed:', error)
        this.handleAnalysisError(error)
      }
    }

    safeStopRealtime() {
      try {
        this.stopRealtime()
      } catch (error) {
        console.error('❌ Safe stop realtime failed:', error)
        this.handleAnalysisError(error)
      }
    }

    /**
     * Enhanced error handling
     */
    handleAnalysisError(error) {
      try {
        const errorMessage = error?.message || 'Unknown analysis error'
        console.error('🔍 Analysis error:', errorMessage)
        
        // Update UI if available
        if (this.uiManager) {
          this.uiManager.updateAnalysisStatus('error', 'Error')
          this.uiManager.showToast('Analysis Error', errorMessage, 'error')
        }
        
        // Emit error event
        if (this.eventBus) {
          this.eventBus.emit('analysis:error', {
            error: errorMessage,
            timestamp: Date.now()
          })
        }
      } catch (handlerError) {
        console.error('❌ Error in error handler:', handlerError)
      }
    }

    /**
     * Set component dependencies
     */
    setDependencies(cameraManager, aiService, uiManager) {
      try {
        this.cameraManager = cameraManager || null
        this.aiService = aiService || null
        this.uiManager = uiManager || null
        console.log('🔍 Analysis Engine dependencies set')
        return true
      } catch (error) {
        console.error('❌ Failed to set dependencies:', error)
        return false
      }
    }

    /**
     * FIXED: Analyze current frame with proper prompt handling
     */
    async analyzeFrame(options = {}) {
      try {
        console.log('🔍 Starting analyzeFrame...')
        
        if (!this.isInitialized) {
          throw new Error('AnalysisEngine not initialized')
        }

        if (!this.cameraManager || !this.aiService || !this.uiManager) {
          throw new Error('Dependencies not available')
        }
      
        // Check if camera is active
        if (!this.cameraManager.isStreaming) {
          this.uiManager.showToast('Camera Required', 'Please start the camera first', 'warning')
          throw new Error('Camera not streaming')
        }
      
        // Check if AI service is connected
        if (!this.aiService.isConnected) {
          this.uiManager.showToast('AI Service Required', 'Please ensure AI server is connected', 'warning')
          throw new Error('AI service not connected')
        }
      
        const analysisId = this.generateAnalysisId()
        const isRealtimeRequest = options.realtime || false
        
        const startTime = Date.now()

        // Get current frame
        const frame = this.cameraManager.getCurrentFrame()
        if (!frame) {
          throw new Error('No frame available for analysis')
        }

        // FIXED: Get the actual user-selected prompt, don't override
        let prompt = options.prompt || this.getCurrentPrompt()
        
        // FIXED: Only use shorter prompts for real-time mode specifically
        if (isRealtimeRequest) {
          prompt = "Briefly describe what you see in 1-2 sentences. Include main objects and people."
        }
        
        let maxTokens = options.maxTokens || this.config.maxTokens
        if (isRealtimeRequest) {
          maxTokens = Math.min(maxTokens, 15)
        }
        
        // Update UI for manual analysis
        if (!isRealtimeRequest && this.uiManager) {
          this.uiManager.updateAnalysisStatus('analyzing', 'Analyzing...')
          this.uiManager.showButtonLoading('analyzeBtn', true)
        }

        console.log(`🔍 Analysis: "${prompt.substring(0, 50)}..." (max_tokens: ${maxTokens})`)

        // Emit analysis started event
        if (this.eventBus) {
          this.eventBus.emit('analysis:started', {
            id: analysisId,
            realtime: isRealtimeRequest,
            prompt: prompt.substring(0, 50)
          })
        }

        // Track active processing
        this.activeProcessing.set(analysisId, {
          startTime: Date.now(),
          realtime: isRealtimeRequest,
          prompt
        })

        // FIXED: AI analysis with proper parameters
        const result = await this.aiService.analyzeImage(
          frame.dataUrl,
          prompt,
          {
            maxTokens: maxTokens,
            temperature: options.temperature || this.config.temperature,
            timeout: isRealtimeRequest ? this.config.timeouts.realtime : this.config.timeouts.normal,
            quick_mode: isRealtimeRequest  // Tell server this is quick mode
          }
        )

        console.log(`🔍 AI analysis completed in ${result.responseTime}ms`)

        // Process result - DON'T trim unless explicitly requested
        const analysisResult = {
          id: analysisId,
          content: result.content,
          confidence: this.calculateConfidence(result),
          responseTime: result.responseTime,
          timestamp: Date.now(),
          prompt,
          realtime: isRealtimeRequest,
          frame: {
            width: frame.width,
            height: frame.height,
            timestamp: frame.timestamp
          }
        }

        // Update performance metrics
        this.updatePerformanceMetrics(result.responseTime, true)

        // Update UI with the result
        if (this.uiManager) {
          console.log('🔍 Updating UI with analysis result...')
          
          this.uiManager.updateAnalysisResult(analysisResult.content, {
            responseTime: analysisResult.responseTime,
            confidence: analysisResult.confidence,
            realtime: isRealtimeRequest
          })
          
          this.uiManager.updateAnalysisStatus('ready', 'Complete')
          
          if (!isRealtimeRequest) {
            this.uiManager.showButtonLoading('analyzeBtn', false)
          }
        }

        // Emit completion event
        if (this.eventBus) {
          this.eventBus.emit('analysis:completed', analysisResult)
        }

        this.lastAnalysisTime = Date.now()
        
        const totalTime = Date.now() - startTime
        console.log(`✅ Analysis completed in ${totalTime}ms`)

        return analysisResult

      } catch (error) {
        console.error('❌ Analysis failed:', error)
        
        // Update metrics for failed request
        const responseTime = Date.now() - (options.startTime || Date.now())
        this.updatePerformanceMetrics(responseTime, false)
        
        this.handleAnalysisError(error)
        
        // Clean up UI on error
        if (this.uiManager) {
          this.uiManager.updateAnalysisStatus('error', 'Error')
          this.uiManager.showButtonLoading('analyzeBtn', false)
        }

        throw error

      } finally {
        // Clean up tracking
        const analysisId = options.analysisId
        if (analysisId && this.activeProcessing.has(analysisId)) {
          this.activeProcessing.delete(analysisId)
        }
      }
    }

    /**
     * Start real-time analysis with validation
     */
    startRealtime() {
      try {
        if (this.isRealtimeActive) {
          console.log('🔍 Real-time analysis already active')
          return
        }

        if (!this.cameraManager?.isStreaming) {
          console.warn('🔍 Cannot start realtime - camera not streaming')
          if (this.uiManager) {
            this.uiManager.showToast('Camera Required', 'Please start the camera first', 'warning')
          }
          return
        }

        if (!this.aiService?.isConnected) {
          console.warn('🔍 Cannot start realtime - AI service not connected')
          if (this.uiManager) {
            this.uiManager.showToast('AI Service Required', 'Please ensure AI server is connected', 'warning')
          }
          return
        }

        console.log(`🔍 Starting real-time analysis at ${this.currentFPS} FPS`)

        this.isRealtimeActive = true
        
        const intervalMs = 1000 / this.currentFPS

        this.realtimeInterval = setInterval(() => {
          this.performRealtimeAnalysis()
        }, intervalMs)

        // Update UI
        if (this.uiManager) {
          this.uiManager.updateAnalysisStatus('analyzing', 'Live Analysis')
        }

        // Emit event
        if (this.eventBus) {
          this.eventBus.emit('realtime:started', {
            fps: this.currentFPS,
            interval: intervalMs
          })
        }

        console.log('✅ Real-time analysis started')
      } catch (error) {
        console.error('❌ Failed to start real-time analysis:', error)
        this.handleAnalysisError(error)
      }
    }

    /**
     * Stop real-time analysis
     */
    stopRealtime() {
      try {
        if (!this.isRealtimeActive) {
          return
        }

        console.log('🔍 Stopping real-time analysis')

        this.isRealtimeActive = false

        if (this.realtimeInterval) {
          clearInterval(this.realtimeInterval)
          this.realtimeInterval = null
        }

        // Update UI
        if (this.uiManager) {
          this.uiManager.updateAnalysisStatus('ready', 'Ready')
        }

        // Emit event
        if (this.eventBus) {
          this.eventBus.emit('realtime:stopped')
        }

        console.log('✅ Real-time analysis stopped')
      } catch (error) {
        console.error('❌ Failed to stop real-time analysis:', error)
      }
    }

    /**
     * Restart real-time analysis
     */
    restartRealtime() {
      try {
        if (this.isRealtimeActive) {
          this.stopRealtime()
          setTimeout(() => {
            this.startRealtime()
          }, 100)
        }
      } catch (error) {
        console.error('❌ Failed to restart real-time analysis:', error)
        this.handleAnalysisError(error)
      }
    }

    /**
     * Real-time analysis iteration
     */
    async performRealtimeAnalysis() {
      if (!this.isRealtimeActive) return

      try {
        // Skip if too many concurrent requests
        if (this.activeProcessing.size >= this.config.maxConcurrentRequests) {
          console.log('🔍 Skipping real-time analysis - too many concurrent requests')
          return
        }

        await this.analyzeFrame({ realtime: true })

      } catch (error) {
        console.warn('🔍 Real-time analysis iteration failed:', error.message)
        // Don't stop real-time on individual failures
      }
    }

    /**
     * Performance metrics tracking
     */
    updatePerformanceMetrics(responseTime, success = true) {
      try {
        this.performanceMetrics.totalRequests++
        
        if (success) {
          this.performanceMetrics.successfulRequests++
          
          // Update rolling average
          const currentAvg = this.performanceMetrics.averageResponseTime
          this.performanceMetrics.averageResponseTime = 
            (currentAvg * (this.performanceMetrics.successfulRequests - 1) + responseTime) / 
            this.performanceMetrics.successfulRequests
        } else {
          if (responseTime > 90000) { // Consider timeouts
            this.performanceMetrics.timeoutRequests++
          }
        }
      } catch (error) {
        console.error('❌ Failed to update performance metrics:', error)
      }
    }

    /**
     * FIXED: Get current prompt without overriding user choice
     */
    getCurrentPrompt() {
      try {
        // If custom prompt is selected, use it
        if (this.isCustomPrompt) {
          const customInput = document.getElementById('customPrompt')
          const customPrompt = customInput?.value?.trim()
          if (customPrompt) {
            return customPrompt
          }
        }
        
        // Otherwise use the selected dropdown value
        const promptSelect = document.getElementById('analysisPrompt')
        const selectedPrompt = promptSelect?.value
        
        if (selectedPrompt && selectedPrompt !== 'custom') {
          return selectedPrompt
        }
        
        // Fallback to default
        return this.config.defaultPrompt
        
      } catch (error) {
        console.error('🔍 Error getting current prompt:', error)
        return this.config.defaultPrompt
      }
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(result) {
      try {
        const content = result.content || ''
        const contentLength = content.length
        
        let confidence = 70 // Base confidence
        
        // Content indicators
        if (contentLength > 50) confidence += 10
        if (contentLength > 100) confidence += 10
        
        // Response time indicators
        if (result.responseTime < 30000) confidence += 10
        if (result.responseTime < 15000) confidence += 5
        
        return Math.min(95, Math.max(60, confidence))
        
      } catch (error) {
        return 75
      }
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
      try {
        console.log('🔍 Queue processor started')
      } catch (error) {
        console.error('❌ Failed to start queue processor:', error)
      }
    }

    /**
     * Generate unique analysis ID
     */
    generateAnalysisId() {
      return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Get analysis status
     */
    getStatus() {
      try {
        return {
          isInitialized: this.isInitialized,
          isRealtimeActive: this.isRealtimeActive,
          currentFPS: this.currentFPS,
          activeProcessing: this.activeProcessing.size,
          queueSize: this.processingQueue.length,
          lastAnalysisTime: this.lastAnalysisTime,
          currentPrompt: this.currentPrompt.substring(0, 100) + '...',
          isCustomPrompt: this.isCustomPrompt,
          performance: {
            averageResponseTime: Math.round(this.performanceMetrics.averageResponseTime),
            totalRequests: this.performanceMetrics.totalRequests,
            successfulRequests: this.performanceMetrics.successfulRequests,
            timeoutRequests: this.performanceMetrics.timeoutRequests
          },
          dependencies: {
            cameraManager: !!this.cameraManager,
            aiService: !!this.aiService,
            uiManager: !!this.uiManager
          }
        }
      } catch (error) {
        console.error('❌ Error getting status:', error)
        return {
          isInitialized: this.isInitialized,
          error: error.message
        }
      }
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      try {
        this.config = { ...this.config, ...newConfig }
        console.log('🔍 Analysis Engine configuration updated')
      } catch (error) {
        console.error('❌ Failed to update config:', error)
      }
    }

    /**
     * Shutdown with proper cleanup
     */
    async shutdown() {
      try {
        console.log('🔍 Shutting down Analysis Engine...')
        
        // Stop real-time analysis
        this.stopRealtime()
        
        // Cancel all active processing
        this.activeProcessing.clear()
        this.processingQueue = []
        
        // Reset state
        this.isInitialized = false
        
        console.log('✅ Analysis Engine shut down')
      } catch (error) {
        console.error('❌ Analysis Engine shutdown failed:', error)
      }
    }
  }
  
  export default AnalysisEngine
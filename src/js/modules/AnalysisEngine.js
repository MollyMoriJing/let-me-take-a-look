/**
 * AnalysisEngine - Orchestrates image analysis operations
 * Enhanced with accessibility prompts for blind users
 */

// Import the enhanced prompts
const ACCESSIBILITY_PROMPTS = {
  DETAILED_SCENE: `Describe this image in detail for a blind person. Structure your response as follows:
1. SCENE OVERVIEW: What type of location or setting is this?
2. PEOPLE: How many people are present? What are they doing? What are they wearing?
3. OBJECTS: What significant objects, furniture, or items can you see?
4. COLORS: What are the dominant colors in the scene?
5. LIGHTING: Describe the lighting conditions (bright, dim, natural, artificial)
6. TEXT: Is there any visible text, signs, or writing? Read it exactly.
7. SAFETY: Are there any potential hazards or obstacles to be aware of?
8. CONTEXT: What might be happening in this scene or what is its purpose?
Be specific, clear, and detailed in your descriptions.`,

  NAVIGATION_HELP: `Analyze this image to help a blind person navigate safely. Focus on:
1. PATHWAYS: Describe any walkways, paths, or clear routes
2. OBSTACLES: Identify any obstacles, barriers, or hazards in the path
3. STAIRS/RAMPS: Are there steps, stairs, ramps, or elevation changes?
4. DOORS/EXITS: Where are doors, exits, or entrances located?
5. LANDMARKS: What distinctive features could serve as navigation landmarks?
6. GROUND SURFACE: Describe the floor or ground surface (smooth, rough, carpet, etc.)
7. DIRECTIONS: If applicable, indicate left, right, straight ahead orientations
Prioritize safety and mobility information.`,

  TEXT_READER: `This image contains text that needs to be read aloud. Please:
1. READ ALL TEXT: Read every piece of visible text exactly as written
2. TEXT LOCATION: Describe where each piece of text is located (top, bottom, left, right, center)
3. TEXT TYPE: Identify what type of text this is (sign, document, menu, label, etc.)
4. TEXT SIZE: Mention if text appears large, small, or normal sized
5. TEXT FORMATTING: Note any bold, italic, or special formatting
6. IMAGES WITH TEXT: If there are images alongside text, briefly describe them
7. LANGUAGE: If text appears to be in a foreign language, mention this
Read clearly and completely - this person depends on you to access this written information.`,

  SHOPPING_ASSISTANT: `Help a blind person identify products or items for shopping. Describe:
1. PRODUCT NAME: What is the main product or item?
2. BRAND: What brand name is visible?
3. SIZE/QUANTITY: What size, weight, or quantity information is shown?
4. PRICE: Is there any price information visible?
5. PRODUCT TYPE: What category does this item belong to?
6. PACKAGING: Describe the packaging, container, or appearance
7. INGREDIENTS/CONTENTS: Any ingredient lists or content information
8. EXPIRATION: Any expiration dates or freshness information
9. SPECIAL FEATURES: Any special features, benefits, or claims mentioned
Be thorough and accurate - this affects purchasing decisions.`,

  SOCIAL_CONTEXT: `Describe this social situation for a blind person attending or participating:
1. PEOPLE COUNT: How many people are present?
2. PEOPLE DESCRIPTION: Briefly describe each person (gender, approximate age, clothing)
3. ACTIVITIES: What are people doing? Any interactions?
4. SETTING: What type of social setting is this? (party, meeting, restaurant, etc.)
5. MOOD/ATMOSPHERE: What's the general mood or atmosphere?
6. SEATING/ARRANGEMENT: How are people positioned or arranged?
7. FOOD/DRINKS: Any food, drinks, or dining elements visible?
8. DECORATIONS: Any decorations, special setup, or themed elements?
Help them understand and participate in the social situation.`,

  CLOTHING_ASSISTANT: `Describe clothing and appearance details for someone who cannot see:
1. CLOTHING ITEMS: List each piece of clothing visible
2. COLORS: Describe all colors in detail, including patterns
3. STYLE: Describe the style (formal, casual, sporty, etc.)
4. CONDITION: Is clothing neat, wrinkled, new, worn, etc.?
5. FIT: How does the clothing fit? (loose, tight, well-fitted)
6. ACCESSORIES: Any jewelry, watches, bags, or accessories
7. SHOES: Describe footwear if visible
8. OVERALL LOOK: What's the overall appearance or impression?
Be detailed about colors and styles - this helps with coordinating outfits.`,

  DOCUMENT_READER: `Read and analyze this document for someone who cannot see it:
1. DOCUMENT TYPE: What type of document is this? (form, letter, bill, etc.)
2. TITLE/HEADER: Read any titles or headers
3. MAIN CONTENT: Read all main text content in order
4. FORM FIELDS: If it's a form, identify all fields that need to be filled
5. IMPORTANT DATES: Any dates, deadlines, or time-sensitive information
6. CONTACT INFO: Any phone numbers, addresses, or contact information
7. INSTRUCTIONS: Any specific instructions or important notes
8. SIGNATURES: Any signature lines or areas requiring signatures
Read everything completely and in logical order.`,

  FOOD_HELPER: `Describe food and cooking information for a blind person:
1. FOOD ITEMS: Identify all food items present
2. COOKING STATE: Is food raw, cooked, prepared, or in-progress?
3. COLORS/APPEARANCE: Describe colors and visual appearance
4. FRESHNESS: Does food appear fresh, ripe, or spoiled?
5. SERVING SIZE: How much food is present?
6. PRESENTATION: How is food arranged or presented?
7. COOKING EQUIPMENT: Any pots, pans, or cooking tools visible?
8. SAFETY: Any food safety considerations or cooking hazards?
9. INSTRUCTIONS: Any visible cooking instructions or recipes?
Focus on details that affect cooking success and food safety.`,

  SAFETY_ALERT: `Analyze this image for safety and emergency information:
1. EMERGENCY TYPE: Is there any emergency or dangerous situation?
2. IMMEDIATE HAZARDS: Any immediate dangers or risks?
3. SAFETY EQUIPMENT: Any fire extinguishers, exits, safety equipment visible?
4. WARNING SIGNS: Any warning signs or safety notices?
5. EMERGENCY EXITS: Where are the nearest exits or escape routes?
6. PEOPLE: Are people in danger or responding to an emergency?
7. INSTRUCTIONS: Any emergency instructions or procedures visible?
8. NEXT STEPS: What should someone do in this situation?
Prioritize safety information and be clear about any urgent situations.`,

  TECH_HELPER: `Help someone use technology or devices they cannot see:
1. DEVICE TYPE: What device or technology is shown?
2. SCREEN CONTENT: If there's a screen, describe what's displayed
3. BUTTONS/CONTROLS: Describe any buttons, switches, or controls
4. STATUS INDICATORS: Any lights, indicators, or status displays
5. CONNECTIONS: Any cables, ports, or connection points visible?
6. SETTINGS: Any visible settings or configuration options
7. ERROR MESSAGES: Any error messages or alerts displayed?
8. INSTRUCTIONS: Step-by-step guidance for using the device
Be precise about button locations and interface elements.`
}

export class AnalysisEngine {
    constructor(config = {}) {
      this.config = {
        // Enhanced default prompt for blind users
        defaultPrompt: ACCESSIBILITY_PROMPTS.DETAILED_SCENE,
        maxTokens: 300, // Increased for more detailed descriptions
        temperature: 0.1, // Lower temperature for more focused responses
        realtimeFPS: 0.5, // Slower default FPS to reduce load
        maxConcurrentRequests: 1, // Reduced to prevent overload
        ...config
      }
      
      this.eventBus = config.eventBus
      this.isInitialized = false
      
      // Real-time analysis state
      this.isRealtimeActive = false
      this.realtimeInterval = null
      this.currentFPS = 0.5 // Start with slower FPS
      
      // Processing queue
      this.processingQueue = []
      this.activeProcessing = new Map()
      this.maxQueueSize = 10
      
      // Analysis state
      this.currentPrompt = this.config.defaultPrompt
      this.isCustomPrompt = false
      this.lastAnalysisTime = 0
      
      // Store accessibility prompts for easy access
      this.accessibilityPrompts = ACCESSIBILITY_PROMPTS
      
      // Dependencies (injected by main app)
      this.cameraManager = null
      this.aiService = null
      this.uiManager = null
    }
  
    /**
     * Initialize Analysis Engine
     */
    async initialize() {
      try {
        console.log('🔍 Initializing Analysis Engine with accessibility features...')
        
        // Setup event listeners
        this.setupEventListeners()
        
        // Initialize processing queue
        this.startQueueProcessor()
        
        this.isInitialized = true
        console.log('✅ Analysis Engine initialized with enhanced prompts for blind users')
        
      } catch (error) {
        console.error('❌ Analysis Engine initialization failed:', error)
        throw error
      }
    }
  
    /**
     * Setup event listeners
     */
    setupEventListeners() {
      // Listen for component references
      this.eventBus?.on('app:components-ready', (event) => {
        this.cameraManager = event.data.cameraManager
        this.aiService = event.data.aiService
        this.uiManager = event.data.uiManager
        console.log('🔍 AnalysisEngine received component dependencies')
      })
  
      // Listen for analysis requests
      this.eventBus?.on('analysis:manual-trigger', () => {
        console.log('🔍 Manual analysis triggered')
        this.analyzeFrame()
      })
  
      // Listen for real-time toggle
      this.eventBus?.on('realtime:toggle', (event) => {
        console.log('🔍 Realtime toggle:', event.data.enabled)
        if (event.data.enabled) {
          this.startRealtime()
        } else {
          this.stopRealtime()
        }
      })
  
      // Listen for configuration changes
      this.eventBus?.on('config:prompt-changed', (event) => {
        console.log('🔍 Prompt changed:', event.data.prompt)
        this.currentPrompt = event.data.prompt
        this.isCustomPrompt = event.data.isCustom
      })
  
      this.eventBus?.on('config:custom-prompt-changed', (event) => {
        if (this.isCustomPrompt) {
          console.log('🔍 Custom prompt changed:', event.data.prompt)
          this.currentPrompt = event.data.prompt
        }
      })
  
      this.eventBus?.on('config:fps-changed', (event) => {
        console.log('🔍 FPS changed:', event.data.fps)
        this.currentFPS = event.data.fps
        if (this.isRealtimeActive) {
          this.restartRealtime()
        }
      })
  
      // Listen for camera frame captures
      this.eventBus?.on('camera:frame-captured', (event) => {
        console.log('🔍 Frame captured event received')
      })

      // NEW: Listen for quick analysis requests with specific prompts
      this.eventBus?.on('analysis:quick-navigation', () => {
        this.analyzeFrame({ prompt: ACCESSIBILITY_PROMPTS.NAVIGATION_HELP })
      })

      this.eventBus?.on('analysis:read-text', () => {
        this.analyzeFrame({ prompt: ACCESSIBILITY_PROMPTS.TEXT_READER })
      })

      this.eventBus?.on('analysis:safety-check', () => {
        this.analyzeFrame({ prompt: ACCESSIBILITY_PROMPTS.SAFETY_ALERT })
      })
    }
  
    /**
     * Set component dependencies
     */
    setDependencies(cameraManager, aiService, uiManager) {
      this.cameraManager = cameraManager
      this.aiService = aiService
      this.uiManager = uiManager
      console.log('🔍 Analysis Engine dependencies set:', {
        cameraManager: !!cameraManager,
        aiService: !!aiService,
        uiManager: !!uiManager
      })
    }
  
    /**
     * Analyze current frame - ENHANCED ERROR HANDLING
     */
    async analyzeFrame(options = {}) {
        if (!this.cameraManager || !this.aiService || !this.uiManager) {
          console.error('🔍 Dependencies not available for analysis')
          return
        }
      
        // Check if camera is active
        if (!this.cameraManager.isStreaming) {
          this.uiManager.showToast('Camera Required', 'Please start the camera first', 'warning')
          return null
        }
      
        // Check if AI service is connected
        if (!this.aiService.isConnected) {
          this.uiManager.showToast('AI Service Required', 'Please ensure AI server is connected', 'warning')
          return null
        }
      
        const analysisId = this.generateAnalysisId()
        const isRealtimeRequest = options.realtime || false
      
        try {
          // Get current frame
          const frame = this.cameraManager.getCurrentFrame()
          if (!frame) {
            throw new Error('No frame available for analysis')
          }
      
          // Determine prompt - use options.prompt first, then current prompt
          const prompt = options.prompt || this.getCurrentPrompt()
          
          // Update UI for manual analysis
          if (!isRealtimeRequest) {
            this.uiManager.updateAnalysisStatus('analyzing', 'Analyzing...')
            this.uiManager.showButtonLoading('analyzeBtn', true)
          }
      
          console.log(`🔍 Starting analysis with prompt: "${prompt.substring(0, 50)}..."`)
      
          // Emit analysis started event
          this.eventBus?.emit('analysis:started', {
            id: analysisId,
            realtime: isRealtimeRequest,
            prompt: prompt.substring(0, 50)
          })
      
          // Track active processing
          this.activeProcessing.set(analysisId, {
            startTime: Date.now(),
            realtime: isRealtimeRequest,
            prompt
          })
      
          // Perform AI analysis with optimized settings
          const result = await this.aiService.analyzeImage(
            frame.dataUrl,
            prompt,
            {
              maxTokens: this.config.maxTokens,
              temperature: this.config.temperature
            }
          )
      
          console.log(`🔍 AI analysis completed. Result: "${result.content?.substring(0, 100)}..."`)
      
          // Process result
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
      
          // FIXED: Always update UI with the result
          console.log('🔍 Updating UI with analysis result...')
          
          this.uiManager.updateAnalysisResult(analysisResult.content, {
            responseTime: analysisResult.responseTime,
            confidence: analysisResult.confidence
          })
          
          this.uiManager.updateAnalysisStatus('ready', 'Complete')
          
          if (!isRealtimeRequest) {
            this.uiManager.showButtonLoading('analyzeBtn', false)
          }
      
          // Emit completion event
          this.eventBus?.emit('analysis:completed', analysisResult)
      
          this.lastAnalysisTime = Date.now()
          console.log(`✅ Analysis completed successfully: ${analysisResult.content.substring(0, 50)}...`)
      
          return analysisResult
      
        } catch (error) {
          console.error('❌ Analysis failed:', error)
      
          // Enhanced error handling
          let errorMessage = error.message || 'Unknown error occurred'
          
          if (error.message.includes('timeout')) {
            errorMessage = 'Analysis timed out. The server is taking too long to respond. Try with a smaller image or wait for the model to warm up.'
          } else if (error.message.includes('not connected')) {
            errorMessage = 'AI server not connected. Please check server status.'
          } else if (error.message.includes('out of memory')) {
            errorMessage = 'Server out of memory. Try with a smaller image.'
          }
      
          // Update UI with error
          this.uiManager.updateAnalysisResult(`Error: ${errorMessage}`)
          this.uiManager.updateAnalysisStatus('error', 'Error')
          
          if (!isRealtimeRequest) {
            this.uiManager.showButtonLoading('analyzeBtn', false)
          }
      
          // Show error toast with more helpful message
          this.uiManager.showToast('Analysis Error', errorMessage, 'error', { duration: 10000 })
      
          // Emit error event
          this.eventBus?.emit('analysis:error', {
            id: analysisId,
            error: errorMessage,
            realtime: isRealtimeRequest
          })
      
          // Don't throw error for real-time requests to avoid stopping the loop
          if (!isRealtimeRequest) {
            throw error
          }
      
          return null
      
        } finally {
          // Clean up tracking
          this.activeProcessing.delete(analysisId)
        }
      }
  
    /**
     * NEW: Quick analysis methods for specific accessibility needs
     */
    async quickNavigationAnalysis() {
      console.log('🔍 Quick navigation analysis requested')
      return await this.analyzeFrame({ 
        prompt: ACCESSIBILITY_PROMPTS.NAVIGATION_HELP,
        priority: 'high'
      })
    }

    async quickTextReading() {
      console.log('🔍 Quick text reading requested')
      return await this.analyzeFrame({ 
        prompt: ACCESSIBILITY_PROMPTS.TEXT_READER,
        priority: 'high'
      })
    }

    async quickSafetyCheck() {
      console.log('🔍 Quick safety check requested')
      return await this.analyzeFrame({ 
        prompt: ACCESSIBILITY_PROMPTS.SAFETY_ALERT,
        priority: 'high'
      })
    }

    async quickShoppingAssistance() {
      console.log('🔍 Quick shopping assistance requested')
      return await this.analyzeFrame({ 
        prompt: ACCESSIBILITY_PROMPTS.SHOPPING_ASSISTANT,
        priority: 'high'
      })
    }
  
    /**
     * Start real-time analysis
     */
    startRealtime() {
      if (this.isRealtimeActive) {
        console.log('🔍 Real-time analysis already active')
        return
      }
  
      if (!this.cameraManager?.isStreaming) {
        console.warn('🔍 Cannot start realtime - camera not streaming')
        this.uiManager?.showToast('Camera Required', 'Please start the camera first', 'warning')
        return
      }
  
      if (!this.aiService?.isConnected) {
        console.warn('🔍 Cannot start realtime - AI service not connected')
        this.uiManager?.showToast('AI Service Required', 'Please ensure AI server is connected', 'warning')
        return
      }
  
      console.log(`🔍 Starting real-time analysis at ${this.currentFPS} FPS`)
  
      this.isRealtimeActive = true
      const intervalMs = 1000 / this.currentFPS
  
      this.realtimeInterval = setInterval(() => {
        this.performRealtimeAnalysis()
      }, intervalMs)
  
      // Update UI
      this.uiManager?.updateAnalysisStatus('analyzing', 'Live Analysis Active')
  
      // Emit event
      this.eventBus?.emit('realtime:started', {
        fps: this.currentFPS,
        interval: intervalMs
      })
  
      console.log('✅ Real-time analysis started')
    }
  
    /**
     * Stop real-time analysis
     */
    stopRealtime() {
      if (!this.isRealtimeActive) {
        console.log('🔍 Real-time analysis not active')
        return
      }
  
      console.log('🔍 Stopping real-time analysis')
  
      this.isRealtimeActive = false
  
      if (this.realtimeInterval) {
        clearInterval(this.realtimeInterval)
        this.realtimeInterval = null
      }
  
      // Update UI
      this.uiManager?.updateAnalysisStatus('ready', 'Ready')
  
      // Emit event
      this.eventBus?.emit('realtime:stopped')
  
      console.log('✅ Real-time analysis stopped')
    }
  
    /**
     * Restart real-time analysis with new settings
     */
    restartRealtime() {
      if (this.isRealtimeActive) {
        console.log('🔍 Restarting real-time analysis...')
        this.stopRealtime()
        setTimeout(() => {
          this.startRealtime()
        }, 100)
      }
    }
  
    /**
     * Perform real-time analysis iteration
     */
    async performRealtimeAnalysis() {
      if (!this.isRealtimeActive) return
  
      try {
        // Skip if too many concurrent requests
        if (this.activeProcessing.size >= this.config.maxConcurrentRequests) {
          console.log('🔍 Skipping real-time analysis - too many concurrent requests')
          return
        }
  
        // Perform analysis with current prompt
        await this.analyzeFrame({ realtime: true })
  
      } catch (error) {
        console.warn('🔍 Real-time analysis iteration failed:', error.message)
        
        // Don't stop real-time on individual failures
        // Just log and continue
      }
    }
  
    /**
     * Get current prompt - Enhanced to handle accessibility prompts
     */
    getCurrentPrompt() {
      try {
        if (this.isCustomPrompt) {
          const customInput = document.getElementById('customPrompt')
          const customPrompt = customInput?.value?.trim()
          if (customPrompt) {
            return customPrompt
          }
        }
        
        const promptSelect = document.getElementById('analysisPrompt')
        const selectedPrompt = promptSelect?.value
        if (selectedPrompt && selectedPrompt !== 'custom') {
          return selectedPrompt
        }
        
        return this.config.defaultPrompt
        
      } catch (error) {
        console.error('🔍 Error getting current prompt:', error)
        return this.config.defaultPrompt
      }
    }

    /**
     * NEW: Get accessibility prompt by type
     */
    getAccessibilityPrompt(type) {
      return this.accessibilityPrompts[type] || this.config.defaultPrompt
    }

    /**
     * NEW: Set prompt by accessibility type
     */
    setPromptByType(type) {
      const prompt = this.getAccessibilityPrompt(type)
      if (prompt) {
        this.currentPrompt = prompt
        this.isCustomPrompt = false
        
        // Update UI if available
        const promptSelect = document.getElementById('analysisPrompt')
        if (promptSelect) {
          promptSelect.value = prompt
        }
        
        console.log(`🔍 Prompt set to ${type} mode`)
        return true
      }
      return false
    }
  
    /**
     * Calculate confidence score (enhanced)
     */
    calculateConfidence(result) {
      try {
        const content = result.content || ''
        const contentLength = content.length
        
        // Check for specific details that indicate confidence
        const hasSpecificDetails = /\b(person|people|object|color|room|light|sitting|standing|wearing|holding)\b/i.test(content)
        const hasNumbers = /\b\d+\b/.test(content)
        const hasColors = /\b(red|blue|green|yellow|black|white|brown|gray|pink|purple|orange)\b/i.test(content)
        const hasActions = /\b(sitting|standing|walking|running|holding|wearing|looking|smiling)\b/i.test(content)
        const hasLocations = /\b(left|right|center|top|bottom|corner|middle|side)\b/i.test(content)
        const hasStructure = /\b(1\.|2\.|3\.|first|second|third|overview|scene|people|objects)\b/i.test(content)
        
        let confidence = 65 // Base confidence
        
        // Content length indicators
        if (contentLength > 50) confidence += 8
        if (contentLength > 100) confidence += 8
        if (contentLength > 200) confidence += 4
        
        // Specific detail indicators
        if (hasSpecificDetails) confidence += 10
        if (hasNumbers) confidence += 5
        if (hasColors) confidence += 5
        if (hasActions) confidence += 5
        if (hasLocations) confidence += 5
        if (hasStructure) confidence += 8 // Structured responses are usually better
        
        // Response time indicators (faster = more confident)
        if (result.responseTime < 5000) confidence += 5
        if (result.responseTime < 10000) confidence += 3
        
        // Ensure confidence stays within reasonable bounds
        return Math.min(95, Math.max(60, confidence))
        
      } catch (error) {
        console.error('🔍 Error calculating confidence:', error)
        return 75 // Default confidence
      }
    }
  
    /**
     * Start queue processor
     */
    startQueueProcessor() {
      // Process queued requests if needed
      // For now, we handle requests immediately
      console.log('🔍 Queue processor started')
    }
  
    /**
     * Generate unique analysis ID
     */
    generateAnalysisId() {
      return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  
    /**
     * Get analysis status - Enhanced with accessibility info
     */
    getStatus() {
      return {
        isInitialized: this.isInitialized,
        isRealtimeActive: this.isRealtimeActive,
        currentFPS: this.currentFPS,
        activeProcessing: this.activeProcessing.size,
        queueSize: this.processingQueue.length,
        lastAnalysisTime: this.lastAnalysisTime,
        currentPrompt: this.currentPrompt,
        isCustomPrompt: this.isCustomPrompt,
        accessibilityPromptsAvailable: Object.keys(this.accessibilityPrompts),
        dependencies: {
          cameraManager: !!this.cameraManager,
          aiService: !!this.aiService,
          uiManager: !!this.uiManager
        }
      }
    }
  
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig }
      console.log('🔍 Analysis Engine configuration updated')
    }
  
    /**
     * Shutdown analysis engine
     */
    async shutdown() {
      console.log('🔍 Shutting down Analysis Engine...')
      
      // Stop real-time analysis
      this.stopRealtime()
      
      // Cancel all active processing
      for (const [id] of this.activeProcessing) {
        console.log(`🔍 Cancelling active analysis: ${id}`)
      }
      this.activeProcessing.clear()
      
      // Clear processing queue
      this.processingQueue = []
      
      // Reset state
      this.isInitialized = false
      
      console.log('✅ Analysis Engine shut down')
    }
  }
  
  export default AnalysisEngine
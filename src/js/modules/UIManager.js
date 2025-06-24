export class UIManager {
  constructor(config = {}) {
    this.eventBus = config.eventBus
    this.isInitialized = false
    
    // UI state
    this.toasts = new Map()
    this.modals = new Map()
    this.tooltips = new Map()
    
    // Animation queue
    this.animationQueue = []
    this.isAnimating = false
    
    // Toast configuration
    this.toastConfig = {
      duration: 5000,
      maxToasts: 5,
      position: 'top-right'
    }
  }

  /**
   * Initialize UI Manager
   */
  async initialize() {
    try {
      console.log('🎨 Initializing Enhanced UI Manager...')
      
      // Wait for DOM to be ready
      await this.waitForDOM()
      
      // Setup form handlers
      this.setupFormHandlers()
      
      // Setup global UI event listeners
      this.setupGlobalEventListeners()
      
      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts()
      
      // Initialize tooltips
      this.initializeTooltips()
      
      // Setup theme system
      this.initializeTheme()
      
      // Verify critical DOM elements exist
      this.verifyDOMElements()
      
      this.isInitialized = true
      console.log('✅ Enhanced UI Manager initialized')
      
    } catch (error) {
      console.error('❌ UI Manager initialization failed:', error)
      throw error
    }
  }

  /**
   * Wait for DOM to be ready
   */
  async waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve)
      } else {
        resolve()
      }
    })
  }

  /**
   * Verify critical DOM elements exist
   */
  verifyDOMElements() {
    const criticalElements = [
      'analysisContent',
      'analysisStatus', 
      'lastUpdate',
      'responseTime',
      'confidenceBar',
      'confidenceValue', 
      'processingTime',
      'analysisMetrics',
      'analyzeBtn'
    ]
    
    const missing = []
    
    criticalElements.forEach(id => {
      const element = document.getElementById(id)
      if (!element) {
        missing.push(id)
      }
    })
    
    if (missing.length > 0) {
      console.warn('🎨 Missing DOM elements:', missing)
    } else {
      console.log('✅ All critical DOM elements found')
    }
  }

  /**
   * FIXED: Setup form handlers with proper prompt handling
   */
  setupFormHandlers() {
    // AI Server URL input
    const serverUrlInput = document.getElementById('aiServerUrl')
    if (serverUrlInput) {
      serverUrlInput.addEventListener('change', (e) => {
        this.eventBus?.emit('config:ai-server-changed', { url: e.target.value })
      })
      console.log('✅ AI Server URL handler set')
    }

    // FIXED: Analysis prompt selector with proper event handling
    const promptSelect = document.getElementById('analysisPrompt')
    const customPromptGroup = document.getElementById('customPromptGroup')
    const customPromptTextarea = document.getElementById('customPrompt')
    
    if (promptSelect) {
      promptSelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value
        const isCustom = selectedValue === 'custom'
        
        // Show/hide custom prompt input
        if (customPromptGroup) {
          customPromptGroup.style.display = isCustom ? 'block' : 'none'
        }
        
        // FIXED: Emit proper prompt change event
        if (isCustom) {
          // For custom prompts, use the textarea value
          const customPrompt = customPromptTextarea?.value?.trim() || 
            'Describe what you see in this image in detail.'
          
          this.eventBus?.emit('config:prompt-changed', {
            prompt: customPrompt,
            isCustom: true
          })
        } else {
          // For predefined prompts, use the selected value
          this.eventBus?.emit('config:prompt-changed', {
            prompt: selectedValue,
            isCustom: false
          })
        }
        
        console.log('🎯 Prompt changed:', isCustom ? 'Custom' : selectedValue.substring(0, 50) + '...')
      })
      console.log('✅ Analysis prompt handler set')
    }

    // FIXED: Custom prompt textarea with proper event handling
    if (customPromptTextarea) {
      customPromptTextarea.addEventListener('input', (e) => {
        const customPrompt = e.target.value.trim()
        
        // Only emit if custom prompt is currently selected
        if (promptSelect?.value === 'custom') {
          this.eventBus?.emit('config:prompt-changed', {
            prompt: customPrompt || 'Describe what you see in this image in detail.',
            isCustom: true
          })
        }
      })
      
      customPromptTextarea.addEventListener('change', (e) => {
        const customPrompt = e.target.value.trim()
        
        // Only emit if custom prompt is currently selected
        if (promptSelect?.value === 'custom') {
          this.eventBus?.emit('config:prompt-changed', {
            prompt: customPrompt || 'Describe what you see in this image in detail.',
            isCustom: true
          })
        }
      })
      console.log('✅ Custom prompt handler set')
    }

    // Real-time analysis toggle
    const realtimeToggle = document.getElementById('enableRealtime')
    if (realtimeToggle) {
      realtimeToggle.addEventListener('change', (e) => {
        console.log('🎨 Realtime toggle changed:', e.target.checked)
        this.eventBus?.emit('realtime:toggle', { enabled: e.target.checked })
        
        // Show recording indicator
        const indicator = document.getElementById('recordingIndicator')
        if (indicator) {
          indicator.style.display = e.target.checked ? 'flex' : 'none'
        }
      })
      console.log('✅ Realtime toggle handler set')
    }

    // Analysis frequency selector
    const fpsSelect = document.getElementById('analysisFPS')
    if (fpsSelect) {
      fpsSelect.addEventListener('change', (e) => {
        this.eventBus?.emit('config:fps-changed', { fps: parseFloat(e.target.value) })
      })
      console.log('✅ Analysis FPS handler set')
    }

    // Analyze button
    const analyzeBtn = document.getElementById('analyzeBtn')
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', (e) => {
        e.preventDefault()
        console.log('🎨 Analyze button clicked')
        this.eventBus?.emit('analysis:manual-trigger')
      })
      console.log('✅ Analyze button handler set')
    }

    // Test connection button
    const testBtn = document.getElementById('testConnection')
    if (testBtn) {
      testBtn.addEventListener('click', (e) => {
        e.preventDefault()
        this.eventBus?.emit('ai:test-connection')
      })
      console.log('✅ Test connection handler set')
    }

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn')
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault()
        this.eventBus?.emit('ui:show-settings')
      })
      console.log('✅ Settings button handler set')
    }
  }

  /**
   * Setup global event listeners
   */
  setupGlobalEventListeners() {
    // Window resize handler
    window.addEventListener('resize', () => {
      this.handleResize()
    })

    // Visibility change handler
    document.addEventListener('visibilitychange', () => {
      this.eventBus?.emit('app:visibility-changed', { 
        hidden: document.hidden 
      })
    })

    // Click outside handler for dropdowns/modals
    document.addEventListener('click', (e) => {
      this.handleOutsideClick(e)
    })

    // Performance monitor toggle
    const monitorToggle = document.getElementById('toggleMonitor')
    if (monitorToggle) {
      monitorToggle.addEventListener('click', () => {
        this.togglePerformanceMonitor()
      })
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      // Escape key - close modals/overlays
      if (e.key === 'Escape') {
        this.handleEscapeKey()
      }

      // Enter key - trigger primary action
      if (e.key === 'Enter' && e.ctrlKey) {
        this.eventBus?.emit('ui:primary-action')
      }
    })
  }

  /**
   * Initialize tooltips
   */
  initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]')
    
    tooltipElements.forEach(element => {
      element.addEventListener('mouseenter', (e) => {
        this.showTooltip(e.target, e.target.dataset.tooltip)
      })
      
      element.addEventListener('mouseleave', (e) => {
        this.hideTooltip(e.target)
      })
    })
  }

  /**
   * Initialize theme system
   */
  initializeTheme() {
    // Check for saved theme preference or use localStorage fallback
    let savedTheme = 'default'
    try {
      savedTheme = localStorage.getItem('ai-vision-theme') || 'default'
    } catch (error) {
      console.warn('🎨 LocalStorage not available for theme storage:', error)
    }
    
    this.applyTheme(savedTheme)
    
    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', (e) => {
        if (savedTheme === 'auto') {
          this.applyTheme('auto')
        }
      })
    }
  }

  /**
   * Show toast notification
   */
  showToast(title, message, type = 'info', options = {}) {
    const toastId = this.generateId()
    const duration = options.duration || this.toastConfig.duration
    
    console.log(`🔔 Showing toast: ${title} - ${message}`)
    
    try {
      // Create toast element
      const toast = this.createToastElement(toastId, title, message, type)
      
      // Add to container
      const container = this.getToastContainer()
      container.appendChild(toast)
      
      // Store toast reference
      this.toasts.set(toastId, {
        element: toast,
        timeout: null,
        type,
        title,
        message
      })
      
      // Auto-remove after duration
      if (duration > 0) {
        const timeout = setTimeout(() => {
          this.removeToast(toastId)
        }, duration)
        
        this.toasts.get(toastId).timeout = timeout
      }
      
      // Limit number of toasts
      this.limitToasts()
      
    } catch (error) {
      console.error('❌ Failed to show toast:', error)
      // Fallback to console log
      console.log(`Toast: ${title} - ${message}`)
    }
    
    return toastId
  }

  /**
   * Create toast element
   */
  createToastElement(id, title, message, type) {
    const toast = document.createElement('div')
    toast.className = `toast ${type} animate-slide-right`
    toast.dataset.toastId = id
    
    // Icon based on type
    const icons = {
      success: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
      </svg>`,
      error: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
      </svg>`,
      warning: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
      </svg>`,
      info: `<svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
      </svg>`
    }
    
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Close">
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M.293.293a1 1 0 011.414 0L8 6.586 14.293.293a1 1 0 111.414 1.414L9.414 8l6.293 6.293a1 1 0 01-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 01-1.414-1.414L6.586 8 .293 1.707a1 1 0 010-1.414z"/>
        </svg>
      </button>
    `
    
    // Add close button handler
    const closeBtn = toast.querySelector('.toast-close')
    closeBtn.addEventListener('click', () => {
      this.removeToast(id)
    })
    
    return toast
  }

  /**
   * Remove toast notification
   */
  removeToast(toastId) {
    const toast = this.toasts.get(toastId)
    if (!toast) return
    
    try {
      // Clear timeout
      if (toast.timeout) {
        clearTimeout(toast.timeout)
      }
      
      // Animate out
      toast.element.classList.add('animate-slide-out')
      
      // Remove after animation
      setTimeout(() => {
        if (toast.element.parentNode) {
          toast.element.parentNode.removeChild(toast.element)
        }
        this.toasts.delete(toastId)
      }, 300)
      
    } catch (error) {
      console.error('❌ Failed to remove toast:', error)
    }
  }

  /**
   * Get toast container
   */
  getToastContainer() {
    let container = document.getElementById('toastContainer')
    if (!container) {
      container = document.createElement('div')
      container.id = 'toastContainer'
      container.className = 'toast-container'
      document.body.appendChild(container)
    }
    return container
  }

  /**
   * Limit number of toasts
   */
  limitToasts() {
    const toastArray = Array.from(this.toasts.entries())
    if (toastArray.length > this.toastConfig.maxToasts) {
      const oldestToast = toastArray[0]
      this.removeToast(oldestToast[0])
    }
  }

  /**
   * Show tooltip
   */
  showTooltip(element, text) {
    const tooltipId = this.generateId()
    
    try {
      const tooltip = document.createElement('div')
      tooltip.className = 'tooltip animate-fade-in'
      tooltip.textContent = text
      tooltip.dataset.tooltipId = tooltipId
      
      // Position tooltip
      const rect = element.getBoundingClientRect()
      tooltip.style.position = 'absolute'
      tooltip.style.top = `${rect.top - 40}px`
      tooltip.style.left = `${rect.left + rect.width / 2}px`
      tooltip.style.transform = 'translateX(-50%)'
      tooltip.style.zIndex = '1000'
      
      document.body.appendChild(tooltip)
      
      this.tooltips.set(element, { id: tooltipId, element: tooltip })
      
    } catch (error) {
      console.error('❌ Failed to show tooltip:', error)
    }
  }

  /**
   * Hide tooltip
   */
  hideTooltip(element) {
    const tooltip = this.tooltips.get(element)
    if (!tooltip) return
    
    try {
      tooltip.element.classList.add('animate-fade-out')
      setTimeout(() => {
        if (tooltip.element.parentNode) {
          tooltip.element.parentNode.removeChild(tooltip.element)
        }
        this.tooltips.delete(element)
      }, 200)
      
    } catch (error) {
      console.error('❌ Failed to hide tooltip:', error)
    }
  }

  /**
   * Update element content or attributes - ENHANCED VERSION
   */
  updateElement(elementId, property, value) {
    try {
      const element = document.getElementById(elementId)
      if (!element) {
        console.warn(`🎨 Element '${elementId}' not found`)
        return false
      }
      
      if (property === 'textContent') {
        element.textContent = value
      } else if (property === 'innerHTML') {
        element.innerHTML = value
      } else if (property === 'value') {
        element.value = value
      } else if (property === 'checked') {
        element.checked = !!value
      } else if (property === 'disabled') {
        element.disabled = !!value
      } else if (property === 'display') {
        element.style.display = value
      } else if (property === 'className') {
        element.className = value
      } else {
        element.setAttribute(property, value)
      }
      
      console.log(`🎨 Updated ${elementId}.${property} = ${value}`)
      return true
      
    } catch (error) {
      console.error(`❌ Failed to update element ${elementId}:`, error)
      return false
    }
  }

  /**
   * Update status indicators - ENHANCED VERSION
   */
  updateStatus(type, status, text) {
    try {
      const dotElement = document.getElementById(`${type}StatusDot`)
      const textElement = document.getElementById(`${type}StatusText`)
      
      if (dotElement) {
        // Remove old status classes
        dotElement.classList.remove('connected', 'error', 'ready', 'disconnected')
        
        // Add new status class
        dotElement.classList.add(status)
        
        // Add animation for status changes
        dotElement.classList.add('animate-pulse')
        setTimeout(() => {
          dotElement.classList.remove('animate-pulse')
        }, 1000)
      }
      
      if (textElement) {
        textElement.textContent = text
      }
      
      console.log(`🎨 Status updated: ${type} -> ${status} (${text})`)
      
    } catch (error) {
      console.error(`❌ Failed to update status ${type}:`, error)
    }
  }

  /**
   * Show loading state on button - ENHANCED VERSION
   */
  showButtonLoading(buttonId, loading = true) {
    try {
      const button = document.getElementById(buttonId)
      if (!button) {
        console.warn(`🎨 Button '${buttonId}' not found`)
        return
      }
      
      const btnContent = button.querySelector('.btn-content')
      const btnLoader = button.querySelector('.btn-loader')
      
      if (loading) {
        button.disabled = true
        if (btnContent) btnContent.style.opacity = '0'
        if (btnLoader) btnLoader.style.display = 'block'
      } else {
        button.disabled = false
        if (btnContent) btnContent.style.opacity = '1'
        if (btnLoader) btnLoader.style.display = 'none'
      }
      
      console.log(`🎨 Button ${buttonId} loading: ${loading}`)
      
    } catch (error) {
      console.error(`❌ Failed to update button loading ${buttonId}:`, error)
    }
  }

  /**
   * Update analysis result display - COMPLETELY REWRITTEN
   */
  updateAnalysisResult(result, metadata = {}) {
    console.log('🎨 Updating analysis result:', result?.substring(0, 100) + '...')
    
    const contentElement = document.getElementById('analysisContent')
    const statusElement = document.getElementById('analysisStatus')
    const lastUpdateElement = document.getElementById('lastUpdate')
    const responseTimeElement = document.getElementById('responseTime')
    
    if (contentElement) {
      // Clear placeholder content
      const placeholder = contentElement.querySelector('.placeholder-content')
      if (placeholder) {
        placeholder.remove()
      }
      
      // Set the result text
      contentElement.innerHTML = '' // Clear existing content
      contentElement.textContent = result || 'No result available'
      
      // Add animation class
      contentElement.classList.remove('animate-fade-in') // Remove first to reset
      setTimeout(() => {
        contentElement.classList.add('animate-fade-in')
      }, 10)
      
      // Remove animation class after animation completes
      setTimeout(() => {
        contentElement.classList.remove('animate-fade-in')
      }, 500)
      
      console.log('🎨 Analysis content updated successfully')
    } else {
      console.error('🎨 analysisContent element not found!')
    }
    
    if (statusElement) {
      statusElement.className = 'status-indicator ready'
      statusElement.textContent = 'Complete'
    }
    
    if (lastUpdateElement) {
      const now = new Date().toLocaleTimeString()
      lastUpdateElement.textContent = `Last: ${now}`
    }
    
    if (responseTimeElement && metadata.responseTime) {
      responseTimeElement.textContent = `${metadata.responseTime}ms`
      responseTimeElement.classList.add('animate-glow')
      setTimeout(() => {
        responseTimeElement.classList.remove('animate-glow')
      }, 1000)
    }
    
    // Update metrics if available
    if (metadata.confidence) {
      this.updateMetric('confidence', metadata.confidence)
    }
    
    if (metadata.processingTime) {
      this.updateMetric('processingTime', metadata.processingTime)
    }
    
    // Make sure the results panel is visible
    const resultsPanel = document.querySelector('.results-panel')
    if (resultsPanel) {
      resultsPanel.style.display = 'block'
    }
  }

  /**
   * Update analysis status - ENHANCED VERSION
   */
  updateAnalysisStatus(status, text) {
    try {
      const statusElement = document.getElementById('analysisStatus')
      if (!statusElement) {
        console.warn('🎨 analysisStatus element not found')
        return
      }
      
      statusElement.className = `status-indicator ${status}`
      statusElement.textContent = text
      
      // Add breathing animation for analyzing status
      if (status === 'analyzing') {
        statusElement.classList.add('animate-breathe')
      } else {
        statusElement.classList.remove('animate-breathe')
      }
      
      console.log(`🎨 Analysis status updated: ${status} - ${text}`)
      
    } catch (error) {
      console.error('❌ Failed to update analysis status:', error)
    }
  }

  /**
   * Update metric display - ENHANCED VERSION
   */
  updateMetric(metricName, value) {
    try {
      const metricElement = document.getElementById(`${metricName}Value`)
      const barElement = document.getElementById(`${metricName}Bar`)
      
      if (metricElement) {
        if (metricName === 'confidence') {
          metricElement.textContent = typeof value === 'number' ? `${Math.round(value)}%` : value
        } else if (metricName === 'processingTime') {
          metricElement.textContent = typeof value === 'number' ? `${value}ms` : value
        } else {
          metricElement.textContent = value
        }
      }
      
      if (barElement && typeof value === 'number') {
        const percentage = Math.min(100, Math.max(0, value))
        barElement.style.width = `${percentage}%`
        barElement.classList.add('animate-fill')
        setTimeout(() => {
          barElement.classList.remove('animate-fill')
        }, 1000)
      }
      
      // Show metrics panel
      const metricsPanel = document.getElementById('analysisMetrics')
      if (metricsPanel) {
        metricsPanel.style.display = 'block'
      }
      
      console.log(`🎨 Metric ${metricName} updated: ${value}`)
      
    } catch (error) {
      console.error(`❌ Failed to update metric ${metricName}:`, error)
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Reposition tooltips and modals if needed
    this.repositionFloatingElements()
  }

  /**
   * Handle outside clicks
   */
  handleOutsideClick(event) {
    // Close dropdowns, modals, etc. when clicking outside
    // Implementation depends on specific UI components
  }

  /**
   * Handle escape key
   */
  handleEscapeKey() {
    // Close any open modals or overlays
    // Clear any active selections
    console.log('🎨 Escape key pressed')
  }

  /**
   * Toggle performance monitor
   */
  togglePerformanceMonitor() {
    const monitor = document.getElementById('performanceMonitor')
    const content = monitor?.querySelector('.monitor-content')
    const toggle = document.getElementById('toggleMonitor')
    
    if (!monitor || !content || !toggle) return
    
    const isHidden = content.style.display === 'none'
    
    content.style.display = isHidden ? 'block' : 'none'
    toggle.textContent = isHidden ? '−' : '+'
    
    // Add animation
    monitor.classList.add('animate-bounce-in')
    setTimeout(() => {
      monitor.classList.remove('animate-bounce-in')
    }, 500)
  }

  /**
   * Apply theme
   */
  applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName)
    
    try {
      localStorage.setItem('ai-vision-theme', themeName)
    } catch (error) {
      console.warn('🎨 Could not save theme to localStorage:', error)
    }
    
    console.log(`🎨 Applied theme: ${themeName}`)
  }

  /**
   * Reposition floating elements
   */
  repositionFloatingElements() {
    // Reposition tooltips
    for (const [element, tooltip] of this.tooltips) {
      try {
        const rect = element.getBoundingClientRect()
        tooltip.element.style.top = `${rect.top - 40}px`
        tooltip.element.style.left = `${rect.left + rect.width / 2}px`
      } catch (error) {
        console.error('❌ Failed to reposition tooltip:', error)
      }
    }
  }

  /**
   * Add animation to queue
   */
  queueAnimation(animation) {
    this.animationQueue.push(animation)
    if (!this.isAnimating) {
      this.processAnimationQueue()
    }
  }

  /**
   * Process animation queue
   */
  async processAnimationQueue() {
    if (this.animationQueue.length === 0) {
      this.isAnimating = false
      return
    }
    
    this.isAnimating = true
    const animation = this.animationQueue.shift()
    
    try {
      await animation()
    } catch (error) {
      console.error('🎨 Animation error:', error)
    }
    
    // Process next animation
    setTimeout(() => {
      this.processAnimationQueue()
    }, 50)
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9)
  }

  /**
   * Get UI state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      toastCount: this.toasts.size,
      modalCount: this.modals.size,
      tooltipCount: this.tooltips.size,
      isAnimating: this.isAnimating,
      queueLength: this.animationQueue.length
    }
  }

  /**
   * Clear all UI elements
   */
  clearAll() {
    // Clear all toasts
    for (const [id] of this.toasts) {
      this.removeToast(id)
    }
    
    // Clear all tooltips
    for (const [element] of this.tooltips) {
      this.hideTooltip(element)
    }
    
    // Clear animation queue
    this.animationQueue = []
    this.isAnimating = false
  }

  /**
   * Shutdown UI manager
   */
  async shutdown() {
    console.log('🎨 Shutting down Enhanced UI Manager...')
    
    // Clear all UI elements
    this.clearAll()
    
    // Remove event listeners
    // (Most are automatically cleaned up when elements are destroyed)
    
    this.isInitialized = false
    console.log('✅ Enhanced UI Manager shut down')
  }
}

export default UIManager
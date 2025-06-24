/**
 * PerformanceMonitor - Tracks system performance and resource usage
 * Monitors CPU, memory, network latency, and application metrics
 */
export class PerformanceMonitor {
    constructor(config = {}) {
      this.config = {
        enableMonitoring: true,
        updateInterval: 1000,
        historySize: 60, // 60 seconds of history
        cpuSampleRate: 100,
        memorySampleRate: 1000,
        ...config
      }
      
      this.eventBus = config.eventBus
      this.isInitialized = false
      this.isMonitoring = false
      
      // Performance data
      this.metrics = {
        cpu: {
          usage: 0,
          history: [],
          lastMeasure: 0
        },
        memory: {
          used: 0,
          total: 0,
          percentage: 0,
          history: []
        },
        network: {
          latency: 0,
          requests: 0,
          errors: 0,
          history: []
        },
        application: {
          fps: 0,
          frameDrops: 0,
          activeRequests: 0,
          cacheHits: 0,
          cacheSize: 0
        }
      }
      
      // Monitoring intervals
      this.intervals = {
        main: null,
        cpu: null,
        memory: null,
        network: null
      }
      
      // Performance API support
      this.supportsPerformanceAPI = typeof window !== 'undefined' && 'performance' in window
      this.supportsMemoryAPI = this.supportsPerformanceAPI && 'memory' in performance
      
      // CPU measurement
      this.cpuMeasurements = []
      this.lastCPUTime = 0
    }
  
    /**
     * Initialize Performance Monitor
     */
    async initialize() {
      try {
        console.log('📊 Initializing Performance Monitor...')
        
        // Check browser support
        this.checkBrowserSupport()
        
        // Setup event listeners
        this.setupEventListeners()
        
        // Initialize performance observers
        this.initializeObservers()
        
        // Setup UI
        this.setupUI()
        
        this.isInitialized = true
        console.log('✅ Performance Monitor initialized')
        
      } catch (error) {
        console.error('❌ Performance Monitor initialization failed:', error)
        throw error
      }
    }
  
    /**
     * Check browser support for performance APIs
     */
    checkBrowserSupport() {
      const support = {
        performance: this.supportsPerformanceAPI,
        memory: this.supportsMemoryAPI,
        observer: typeof PerformanceObserver !== 'undefined',
        timing: typeof PerformanceTiming !== 'undefined'
      }
      
      console.log('📊 Performance API support:', support)
      
      if (!support.performance) {
        console.warn('📊 Performance API not supported - limited monitoring available')
      }
    }
  
    /**
     * Setup event listeners
     */
    setupEventListeners() {
      // Listen for AI service metrics
      this.eventBus?.on('ai:metrics-updated', (event) => {
        this.updateNetworkMetrics(event.data)
      })
      
      // Listen for camera performance
      this.eventBus?.on('camera:performance', (event) => {
        this.updateApplicationMetrics(event.data)
      })
      
      // Listen for analysis completion
      this.eventBus?.on('analysis:completed', (event) => {
        this.recordAnalysisMetric(event.data)
      })
      
      // Listen for errors
      this.eventBus?.on('error', (event) => {
        this.recordError(event.data)
      })
    }
  
    /**
     * Initialize performance observers
     */
    initializeObservers() {
      if (!this.supportsPerformanceAPI) return
      
      try {
        // Navigation timing observer
        if (typeof PerformanceObserver !== 'undefined') {
          const navigationObserver = new PerformanceObserver((list) => {
            this.processNavigationEntries(list.getEntries())
          })
          navigationObserver.observe({ entryTypes: ['navigation'] })
          
          // Resource timing observer
          const resourceObserver = new PerformanceObserver((list) => {
            this.processResourceEntries(list.getEntries())
          })
          resourceObserver.observe({ entryTypes: ['resource'] })
        }
        
      } catch (error) {
        console.warn('📊 Performance observers not fully supported:', error)
      }
    }
  
    /**
     * Setup UI elements
     */
    setupUI() {
      // Performance monitor toggle
      const toggleBtn = document.getElementById('toggleMonitor')
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          this.toggleDisplay()
        })
      }
      
      // Update initial display
      this.updateDisplay()
    }
  
    /**
     * Start monitoring
     */
    start() {
      if (this.isMonitoring) return
      
      console.log('📊 Starting performance monitoring...')
      this.isMonitoring = true
      
      // Main update interval
      this.intervals.main = setInterval(() => {
        this.updateMetrics()
      }, this.config.updateInterval)
      
      // CPU monitoring (more frequent)
      this.intervals.cpu = setInterval(() => {
        this.measureCPU()
      }, this.config.cpuSampleRate)
      
      // Memory monitoring
      this.intervals.memory = setInterval(() => {
        this.measureMemory()
      }, this.config.memorySampleRate)
      
      // Network latency check
      this.intervals.network = setInterval(() => {
        this.measureNetworkLatency()
      }, 5000) // Every 5 seconds
      
      console.log('✅ Performance monitoring started')
    }
  
    /**
     * Stop monitoring
     */
    stop() {
      if (!this.isMonitoring) return
      
      console.log('📊 Stopping performance monitoring...')
      
      // Clear all intervals
      Object.values(this.intervals).forEach(interval => {
        if (interval) clearInterval(interval)
      })
      
      this.intervals = {
        main: null,
        cpu: null,
        memory: null,
        network: null
      }
      
      this.isMonitoring = false
      console.log('✅ Performance monitoring stopped')
    }
  
    /**
     * Update all metrics
     */
    updateMetrics() {
      if (!this.isMonitoring) return
      
      // Process CPU data
      this.processCPUMeasurements()
      
      // Update display
      this.updateDisplay()
      
      // Emit metrics event
      this.eventBus?.emit('performance:update', this.getMetrics())
      
      // Trim history
      this.trimHistory()
    }
  
    /**
     * Measure CPU usage (approximation)
     */
    measureCPU() {
      if (!this.supportsPerformanceAPI) return
      
      const now = performance.now()
      
      // Simple CPU measurement using performance.now() precision
      const startTime = performance.now()
      
      // Busy wait for a very short time to measure CPU
      let iterations = 0
      const maxIterations = 1000
      
      while (iterations < maxIterations) {
        Math.random()
        iterations++
      }
      
      const endTime = performance.now()
      const executionTime = endTime - startTime
      
      // Store measurement
      this.cpuMeasurements.push({
        time: now,
        executionTime
      })
      
      // Keep only recent measurements
      if (this.cpuMeasurements.length > 10) {
        this.cpuMeasurements.shift()
      }
    }
  
    /**
     * Process CPU measurements
     */
    processCPUMeasurements() {
      if (this.cpuMeasurements.length < 2) return
      
      // Calculate average execution time
      const avgExecutionTime = this.cpuMeasurements.reduce((sum, m) => sum + m.executionTime, 0) / this.cpuMeasurements.length
      
      // Convert to approximate CPU usage percentage
      // This is a rough approximation - actual CPU monitoring requires more sophisticated techniques
      const baselineTime = 0.1 // Expected time for our test operations
      const cpuUsage = Math.min(100, Math.max(0, ((avgExecutionTime - baselineTime) / baselineTime) * 100))
      
      this.metrics.cpu.usage = Math.round(cpuUsage)
      this.metrics.cpu.history.push({
        time: Date.now(),
        value: this.metrics.cpu.usage
      })
    }
  
    /**
     * Measure memory usage
     */
    measureMemory() {
      if (!this.supportsMemoryAPI) return
      
      try {
        const memInfo = performance.memory
        
        this.metrics.memory.used = Math.round(memInfo.usedJSHeapSize / 1024 / 1024) // MB
        this.metrics.memory.total = Math.round(memInfo.totalJSHeapSize / 1024 / 1024) // MB
        this.metrics.memory.percentage = Math.round((memInfo.usedJSHeapSize / memInfo.totalJSHeapSize) * 100)
        
        this.metrics.memory.history.push({
          time: Date.now(),
          value: this.metrics.memory.percentage
        })
        
      } catch (error) {
        console.warn('📊 Memory measurement failed:', error)
      }
    }
  
    /**
     * Measure network latency
     */
    async measureNetworkLatency() {
      if (!this.eventBus) return
      
      const startTime = Date.now()
      
      try {
        // Try to ping the AI server for latency
        const serverUrl = document.getElementById('aiServerUrl')?.value || 'http://localhost:8000'
        
        const response = await fetch(`${serverUrl}/health`, {
          method: 'GET',
          cache: 'no-cache'
        })
        
        if (response.ok) {
          const latency = Date.now() - startTime
          this.metrics.network.latency = latency
          
          this.metrics.network.history.push({
            time: Date.now(),
            value: latency
          })
        }
        
      } catch (error) {
        // Network error - don't update latency
      }
    }
  
    /**
     * Update network metrics from AI service
     */
    updateNetworkMetrics(aiMetrics) {
      this.metrics.network.requests = aiMetrics.totalRequests || 0
      this.metrics.network.errors = aiMetrics.failedRequests || 0
    }
  
    /**
     * Update application metrics
     */
    updateApplicationMetrics(appMetrics) {
      this.metrics.application.fps = appMetrics.fps || 0
      this.metrics.application.frameDrops = appMetrics.frameDrops || 0
    }
  
    /**
     * Record analysis metric
     */
    recordAnalysisMetric(analysisData) {
      // Track analysis performance
      if (analysisData.responseTime) {
        // Could track analysis response times, etc.
      }
    }
  
    /**
     * Record error
     */
    recordError(errorData) {
      this.metrics.network.errors++
    }
  
    /**
     * Process navigation entries
     */
    processNavigationEntries(entries) {
      entries.forEach(entry => {
        // Process navigation timing data
        console.log('📊 Navigation timing:', entry)
      })
    }
  
    /**
     * Process resource entries
     */
    processResourceEntries(entries) {
      entries.forEach(entry => {
        // Process resource loading times
        if (entry.name.includes('localhost:8000')) {
          // AI server request
          const responseTime = entry.responseEnd - entry.requestStart
          this.metrics.network.latency = responseTime
        }
      })
    }
  
    /**
     * Update display
     */
    updateDisplay() {
      // Update CPU display
      const cpuFill = document.querySelector('.perf-metric:nth-child(1) .perf-fill')
      const cpuValue = document.querySelector('.perf-metric:nth-child(1) span:last-child')
      
      if (cpuFill && cpuValue) {
        cpuFill.style.width = `${this.metrics.cpu.usage}%`
        cpuValue.textContent = `${this.metrics.cpu.usage}%`
      }
      
      // Update Memory display
      const memoryFill = document.querySelector('.perf-metric:nth-child(2) .perf-fill')
      const memoryValue = document.querySelector('.perf-metric:nth-child(2) span:last-child')
      
      if (memoryFill && memoryValue) {
        memoryFill.style.width = `${this.metrics.memory.percentage}%`
        memoryValue.textContent = `${this.metrics.memory.used}MB`
      }
      
      // Update Network display
      const networkFill = document.querySelector('.perf-metric:nth-child(3) .perf-fill')
      const networkValue = document.getElementById('networkLatency')
      
      if (networkFill && networkValue) {
        const latencyPercentage = Math.min(100, (this.metrics.network.latency / 1000) * 100)
        networkFill.style.width = `${latencyPercentage}%`
        networkValue.textContent = `${this.metrics.network.latency}ms`
      }
    }
  
    /**
     * Toggle performance monitor display
     */
    toggleDisplay() {
      const monitor = document.getElementById('performanceMonitor')
      const content = monitor?.querySelector('.monitor-content')
      const toggle = document.getElementById('toggleMonitor')
      
      if (!monitor || !content || !toggle) return
      
      const isHidden = content.style.display === 'none'
      
      content.style.display = isHidden ? 'block' : 'none'
      toggle.textContent = isHidden ? '−' : '+'
      
      console.log(`📊 Performance monitor ${isHidden ? 'shown' : 'hidden'}`)
    }
  
    /**
     * Trim history arrays to prevent memory leaks
     */
    trimHistory() {
      const maxHistory = this.config.historySize
      
      if (this.metrics.cpu.history.length > maxHistory) {
        this.metrics.cpu.history = this.metrics.cpu.history.slice(-maxHistory)
      }
      
      if (this.metrics.memory.history.length > maxHistory) {
        this.metrics.memory.history = this.metrics.memory.history.slice(-maxHistory)
      }
      
      if (this.metrics.network.history.length > maxHistory) {
        this.metrics.network.history = this.metrics.network.history.slice(-maxHistory)
      }
    }
  
    /**
     * Get current metrics
     */
    getMetrics() {
      return {
        ...this.metrics,
        timestamp: Date.now(),
        isMonitoring: this.isMonitoring
      }
    }
  
    /**
     * Get performance summary
     */
    getSummary() {
      return {
        cpu: {
          current: this.metrics.cpu.usage,
          average: this.calculateAverage(this.metrics.cpu.history),
          peak: this.calculatePeak(this.metrics.cpu.history)
        },
        memory: {
          current: this.metrics.memory.percentage,
          used: this.metrics.memory.used,
          total: this.metrics.memory.total
        },
        network: {
          latency: this.metrics.network.latency,
          requests: this.metrics.network.requests,
          errors: this.metrics.network.errors,
          errorRate: this.metrics.network.requests > 0 ? 
            (this.metrics.network.errors / this.metrics.network.requests * 100) : 0
        },
        application: { ...this.metrics.application }
      }
    }
  
    /**
     * Calculate average from history
     */
    calculateAverage(history) {
      if (history.length === 0) return 0
      const sum = history.reduce((acc, item) => acc + item.value, 0)
      return Math.round(sum / history.length)
    }
  
    /**
     * Calculate peak from history
     */
    calculatePeak(history) {
      if (history.length === 0) return 0
      return Math.max(...history.map(item => item.value))
    }
  
    /**
     * Export performance data
     */
    exportData() {
      return {
        timestamp: Date.now(),
        metrics: this.getMetrics(),
        summary: this.getSummary(),
        config: this.config
      }
    }
  
    /**
     * Reset all metrics
     */
    reset() {
      this.metrics = {
        cpu: { usage: 0, history: [], lastMeasure: 0 },
        memory: { used: 0, total: 0, percentage: 0, history: [] },
        network: { latency: 0, requests: 0, errors: 0, history: [] },
        application: { fps: 0, frameDrops: 0, activeRequests: 0, cacheHits: 0, cacheSize: 0 }
      }
      
      this.cpuMeasurements = []
      console.log('📊 Performance metrics reset')
    }
  
    /**
     * Shutdown performance monitor
     */
    async shutdown() {
      console.log('📊 Shutting down Performance Monitor...')
      
      this.stop()
      this.reset()
      
      this.isInitialized = false
      console.log('✅ Performance Monitor shut down')
    }
  }
  
  export default PerformanceMonitor
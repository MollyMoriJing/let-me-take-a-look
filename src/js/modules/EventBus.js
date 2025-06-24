/**
 * EventBus - Central event communication system
 * Implements the Observer pattern for loose coupling between components
 */
export class EventBus {
    constructor() {
      this.events = new Map()
      this.onceEvents = new Map()
      this.maxListeners = 100
      this.debugMode = false
    }
  
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Options (priority, once, context)
     */
    on(event, callback, options = {}) {
      if (typeof callback !== 'function') {
        throw new Error('Callback must be a function')
      }
  
      if (!this.events.has(event)) {
        this.events.set(event, [])
      }
  
      const listeners = this.events.get(event)
      
      // Check max listeners
      if (listeners.length >= this.maxListeners) {
        console.warn(`⚠️ Event '${event}' has ${listeners.length} listeners (max: ${this.maxListeners})`)
      }
  
      const listener = {
        callback,
        context: options.context || null,
        priority: options.priority || 0,
        once: options.once || false,
        id: this.generateId()
      }
  
      // Insert based on priority (higher priority first)
      const insertIndex = listeners.findIndex(l => l.priority < listener.priority)
      if (insertIndex === -1) {
        listeners.push(listener)
      } else {
        listeners.splice(insertIndex, 0, listener)
      }
  
      if (this.debugMode) {
        console.log(`📡 Subscribed to '${event}' (listeners: ${listeners.length})`)
      }
  
      // Return unsubscribe function
      return () => this.off(event, listener.id)
    }
  
    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Options
     */
    once(event, callback, options = {}) {
      return this.on(event, callback, { ...options, once: true })
    }
  
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {string|Function} callbackOrId - Callback function or listener ID
     */
    off(event, callbackOrId) {
      if (!this.events.has(event)) {
        return false
      }
  
      const listeners = this.events.get(event)
      const initialLength = listeners.length
  
      // Remove by ID or callback
      for (let i = listeners.length - 1; i >= 0; i--) {
        const listener = listeners[i]
        if (listener.id === callbackOrId || listener.callback === callbackOrId) {
          listeners.splice(i, 1)
        }
      }
  
      // Clean up empty event arrays
      if (listeners.length === 0) {
        this.events.delete(event)
      }
  
      const removed = initialLength - listeners.length
      if (this.debugMode && removed > 0) {
        console.log(`📡 Unsubscribed from '${event}' (removed: ${removed})`)
      }
  
      return removed > 0
    }
  
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Data to pass to listeners
     * @param {Object} options - Emit options
     */
    emit(event, data = null, options = {}) {
      const {
        async = false,
        stopPropagation = false,
        timeout = 5000
      } = options
  
      if (this.debugMode) {
        console.log(`📡 Emitting '${event}'${data ? ' with data' : ''}`)
      }
  
      // Get listeners
      const listeners = this.events.get(event) || []
      const results = []
  
      if (listeners.length === 0) {
        if (this.debugMode) {
          console.log(`📡 No listeners for '${event}'`)
        }
        return async ? Promise.resolve([]) : []
      }
  
      // Create event object
      const eventObj = {
        type: event,
        data,
        timestamp: Date.now(),
        preventDefault: false,
        stopPropagation: false,
        target: this
      }
  
      // Execute listeners
      for (let i = 0; i < listeners.length; i++) {
        const listener = listeners[i]
  
        try {
          // Execute callback
          const result = listener.context
            ? listener.callback.call(listener.context, eventObj)
            : listener.callback(eventObj)
  
          results.push(result)
  
          // Handle async execution
          if (async && result instanceof Promise) {
            results[i] = this.withTimeout(result, timeout)
          }
  
          // Remove once listeners
          if (listener.once) {
            listeners.splice(i, 1)
            i-- // Adjust index after removal
          }
  
          // Stop propagation if requested
          if (eventObj.stopPropagation || stopPropagation) {
            break
          }
  
        } catch (error) {
          console.error(`❌ Error in event listener for '${event}':`, error)
          results.push(error)
  
          // Emit error event
          this.emit('error', { event, error, listener }, { async: false })
        }
      }
  
      // Return results
      if (async) {
        return Promise.all(results)
      }
  
      return results
    }
  
    /**
     * Emit an event asynchronously
     * @param {string} event - Event name
     * @param {*} data - Data to pass to listeners
     * @param {Object} options - Emit options
     */
    async emitAsync(event, data = null, options = {}) {
      return this.emit(event, data, { ...options, async: true })
    }
  
    /**
     * Remove all listeners for an event or all events
     * @param {string} event - Event name (optional)
     */
    removeAllListeners(event = null) {
      if (event) {
        this.events.delete(event)
        if (this.debugMode) {
          console.log(`📡 Removed all listeners for '${event}'`)
        }
      } else {
        const eventCount = this.events.size
        this.events.clear()
        this.onceEvents.clear()
        if (this.debugMode) {
          console.log(`📡 Removed all listeners for ${eventCount} events`)
        }
      }
    }
  
    /**
     * Get listeners for an event
     * @param {string} event - Event name
     */
    getListeners(event) {
      return this.events.get(event) || []
    }
  
    /**
     * Get all events
     */
    getEvents() {
      return Array.from(this.events.keys())
    }
  
    /**
     * Check if event has listeners
     * @param {string} event - Event name
     */
    hasListeners(event) {
      return this.events.has(event) && this.events.get(event).length > 0
    }
  
    /**
     * Get listener count for an event
     * @param {string} event - Event name
     */
    getListenerCount(event) {
      return this.events.has(event) ? this.events.get(event).length : 0
    }
  
    /**
     * Set max listeners per event
     * @param {number} max - Maximum listeners
     */
    setMaxListeners(max) {
      this.maxListeners = max
    }
  
    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug mode enabled
     */
    setDebugMode(enabled) {
      this.debugMode = enabled
    }
  
    /**
     * Create a namespaced event bus
     * @param {string} namespace - Namespace prefix
     */
    namespace(namespace) {
      return new NamespacedEventBus(this, namespace)
    }
  
    /**
     * Pipe events from one event to another
     * @param {string} fromEvent - Source event
     * @param {string} toEvent - Target event
     * @param {Function} transform - Transform function (optional)
     */
    pipe(fromEvent, toEvent, transform = null) {
      return this.on(fromEvent, (eventObj) => {
        const data = transform ? transform(eventObj.data) : eventObj.data
        this.emit(toEvent, data)
      })
    }
  
    /**
     * Wait for an event to be emitted
     * @param {string} event - Event name
     * @param {number} timeout - Timeout in milliseconds
     */
    waitFor(event, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.off(event, handler)
          reject(new Error(`Event '${event}' timeout after ${timeout}ms`))
        }, timeout)
  
        const handler = (eventObj) => {
          clearTimeout(timeoutId)
          resolve(eventObj.data)
        }
  
        this.once(event, handler)
      })
    }
  
    /**
     * Create a promise that resolves with timeout
     * @param {Promise} promise - Promise to wrap
     * @param {number} timeout - Timeout in milliseconds
     */
    withTimeout(promise, timeout) {
      return Promise.race([
        promise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Promise timeout after ${timeout}ms`)), timeout)
        })
      ])
    }
  
    /**
     * Generate unique ID for listeners
     */
    generateId() {
      return Math.random().toString(36).substr(2, 9)
    }
  
    /**
     * Get debug information
     */
    getDebugInfo() {
      const events = {}
      for (const [event, listeners] of this.events) {
        events[event] = {
          count: listeners.length,
          listeners: listeners.map(l => ({
            priority: l.priority,
            once: l.once,
            hasContext: !!l.context
          }))
        }
      }
  
      return {
        totalEvents: this.events.size,
        totalListeners: Array.from(this.events.values()).reduce((sum, listeners) => sum + listeners.length, 0),
        maxListeners: this.maxListeners,
        debugMode: this.debugMode,
        events
      }
    }
  }
  
  /**
   * NamespacedEventBus - Provides event namespacing
   */
  class NamespacedEventBus {
    constructor(eventBus, namespace) {
      this.eventBus = eventBus
      this.namespace = namespace
    }
  
    on(event, callback, options) {
      return this.eventBus.on(`${this.namespace}:${event}`, callback, options)
    }
  
    once(event, callback, options) {
      return this.eventBus.once(`${this.namespace}:${event}`, callback, options)
    }
  
    off(event, callbackOrId) {
      return this.eventBus.off(`${this.namespace}:${event}`, callbackOrId)
    }
  
    emit(event, data, options) {
      return this.eventBus.emit(`${this.namespace}:${event}`, data, options)
    }
  
    emitAsync(event, data, options) {
      return this.eventBus.emitAsync(`${this.namespace}:${event}`, data, options)
    }
  }
  
  export default EventBus
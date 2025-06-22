const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class PluginService extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.hooks = new Map();
    this.pluginsPath = path.join(process.cwd(), 'plugins');
    this.enabled = process.env.NODE_ENV !== 'test'; // Disable in tests
  }

  /**
   * Initialize plugin system
   */
  async init() {
    if (!this.enabled) return;

    try {
      // Ensure plugins directory exists
      await fs.mkdir(this.pluginsPath, { recursive: true });
      
      // Load all plugins
      await this.loadPlugins();
    } catch (error) {
      console.error('Plugin system initialization error:', error);
    }
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadPlugins() {
    try {
      const entries = await fs.readdir(this.pluginsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(this.pluginsPath, entry.name);
          await this.loadPlugin(pluginPath);
        }
      }
    } catch (error) {
      console.error('Error loading plugins:', error);
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(pluginPath) {
    try {
      const pluginFile = path.join(pluginPath, 'index.js');
      const manifestFile = path.join(pluginPath, 'plugin.json');
      
      // Check if plugin files exist
      try {
        await fs.access(pluginFile);
        await fs.access(manifestFile);
      } catch {
        console.warn(`Invalid plugin at ${pluginPath}: Missing required files`);
        return;
      }
      
      // Load manifest
      const manifestContent = await fs.readFile(manifestFile, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      // Validate manifest
      if (!manifest.name || !manifest.version) {
        console.warn(`Invalid plugin manifest at ${pluginPath}`);
        return;
      }
      
      // Check if plugin is enabled
      if (manifest.enabled === false) {
        console.log(`Plugin ${manifest.name} is disabled`);
        return;
      }
      
      // Load plugin code
      const Plugin = require(pluginFile);
      const plugin = new Plugin(this);
      
      // Store plugin info
      this.plugins.set(manifest.name, {
        manifest,
        instance: plugin,
        path: pluginPath,
        hooks: new Set()
      });
      
      // Initialize plugin
      if (typeof plugin.init === 'function') {
        await plugin.init();
      }
      
      console.log(`Loaded plugin: ${manifest.name} v${manifest.version}`);
      this.emit('plugin:loaded', manifest);
    } catch (error) {
      console.error(`Error loading plugin from ${pluginPath}:`, error);
    }
  }

  /**
   * Register a hook
   */
  registerHook(hookName, callback, pluginName = null) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    const hook = {
      callback,
      pluginName,
      priority: 10 // Default priority
    };
    
    this.hooks.get(hookName).push(hook);
    
    // Track hook for plugin
    if (pluginName && this.plugins.has(pluginName)) {
      this.plugins.get(pluginName).hooks.add(hookName);
    }
    
    // Sort hooks by priority
    this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute hooks
   */
  async executeHook(hookName, data = {}, options = {}) {
    if (!this.enabled) return data;
    
    const hooks = this.hooks.get(hookName) || [];
    let result = data;
    
    for (const hook of hooks) {
      try {
        if (options.filter === 'filter') {
          // Filter hook - modify and return data
          result = await hook.callback(result);
        } else {
          // Action hook - just execute
          await hook.callback(result);
        }
      } catch (error) {
        console.error(`Error executing hook ${hookName}:`, error);
        if (options.stopOnError) {
          throw error;
        }
      }
    }
    
    return result;
  }

  /**
   * Common hook points for Stack Blog
   */
  
  // Content hooks
  async beforePageLoad(slug) {
    return await this.executeHook('content:before:load', { slug }, { filter: 'filter' });
  }
  
  async afterPageLoad(page) {
    return await this.executeHook('content:after:load', page, { filter: 'filter' });
  }
  
  async beforePageSave(data) {
    return await this.executeHook('content:before:save', data, { filter: 'filter' });
  }
  
  async afterPageSave(page) {
    await this.executeHook('content:after:save', page);
    return page;
  }
  
  async beforePageDelete(slug) {
    return await this.executeHook('content:before:delete', { slug }, { filter: 'filter' });
  }
  
  async afterPageDelete(slug) {
    await this.executeHook('content:after:delete', { slug });
  }
  
  // Markdown hooks
  async beforeMarkdownRender(markdown) {
    return await this.executeHook('markdown:before:render', { markdown }, { filter: 'filter' });
  }
  
  async afterMarkdownRender(html, markdown) {
    const result = await this.executeHook('markdown:after:render', { html, markdown }, { filter: 'filter' });
    return result.html;
  }
  
  // Media hooks
  async beforeFileUpload(file) {
    return await this.executeHook('media:before:upload', file, { filter: 'filter' });
  }
  
  async afterFileUpload(file) {
    await this.executeHook('media:after:upload', file);
    return file;
  }
  
  // Admin hooks
  async adminMenuItems() {
    const defaultItems = [];
    return await this.executeHook('admin:menu:items', defaultItems, { filter: 'filter' });
  }
  
  async adminDashboardWidgets() {
    const defaultWidgets = [];
    return await this.executeHook('admin:dashboard:widgets', defaultWidgets, { filter: 'filter' });
  }
  
  // Template hooks
  async templateData(data) {
    return await this.executeHook('template:data', data, { filter: 'filter' });
  }
  
  // Router hooks
  async beforeRoute(req, res, next) {
    await this.executeHook('router:before', { req, res, next });
  }
  
  async afterRoute(req, res) {
    await this.executeHook('router:after', { req, res });
  }

  /**
   * Get plugin info
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }

  /**
   * Get all plugins
   */
  getAllPlugins() {
    const plugins = [];
    for (const [name, plugin] of this.plugins) {
      plugins.push({
        name,
        ...plugin.manifest,
        hooks: Array.from(plugin.hooks),
        path: plugin.path
      });
    }
    return plugins;
  }

  /**
   * Check if plugin is loaded
   */
  isPluginLoaded(name) {
    return this.plugins.has(name);
  }

  /**
   * Get hooks info
   */
  getHooksInfo() {
    const hooksInfo = {};
    for (const [hookName, hooks] of this.hooks) {
      hooksInfo[hookName] = hooks.map(h => ({
        pluginName: h.pluginName || 'core',
        priority: h.priority
      }));
    }
    return hooksInfo;
  }

  /**
   * Reload all plugins
   */
  async reload() {
    // Clear current plugins
    for (const [name, plugin] of this.plugins) {
      if (plugin.instance && typeof plugin.instance.destroy === 'function') {
        await plugin.instance.destroy();
      }
    }
    
    this.plugins.clear();
    this.hooks.clear();
    
    // Reload
    await this.loadPlugins();
  }

  /**
   * Create a plugin scaffold
   */
  async createPlugin(name, options = {}) {
    const pluginPath = path.join(this.pluginsPath, name);
    
    // Create plugin directory
    await fs.mkdir(pluginPath, { recursive: true });
    
    // Create manifest
    const manifest = {
      name,
      version: '1.0.0',
      description: options.description || `${name} plugin for Stack Blog`,
      author: options.author || '',
      enabled: true,
      hooks: []
    };
    
    await fs.writeFile(
      path.join(pluginPath, 'plugin.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Create main plugin file
    const pluginCode = `class ${name.charAt(0).toUpperCase() + name.slice(1)}Plugin {
  constructor(pluginService) {
    this.pluginService = pluginService;
    this.name = '${name}';
  }

  async init() {
    // Register hooks
    this.pluginService.registerHook('content:after:load', this.onContentLoad.bind(this), this.name);
    
    console.log('${name} plugin initialized');
  }

  async onContentLoad(page) {
    // Modify page data here
    return page;
  }

  async destroy() {
    // Cleanup code here
  }
}

module.exports = ${name.charAt(0).toUpperCase() + name.slice(1)}Plugin;`;
    
    await fs.writeFile(path.join(pluginPath, 'index.js'), pluginCode);
    
    // Create README
    const readme = `# ${name} Plugin

${options.description || 'A plugin for Stack Blog'}

## Installation

Place this plugin in the \`plugins/${name}\` directory.

## Configuration

Edit \`plugin.json\` to configure this plugin.

## Hooks

This plugin uses the following hooks:
- content:after:load - Modifies page data after loading

## Development

Modify \`index.js\` to add your plugin functionality.
`;
    
    await fs.writeFile(path.join(pluginPath, 'README.md'), readme);
    
    return pluginPath;
  }
}

module.exports = PluginService;
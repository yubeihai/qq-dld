const fs = require('fs');
const path = require('path');

class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this._initialized = false;
  }

  register(moduleInstance) {
    if (!moduleInstance || !moduleInstance.id) {
      throw new Error('模块必须包含 id 属性');
    }
    this.modules.set(moduleInstance.id, moduleInstance);
  }

  get(id) {
    return this.modules.get(id);
  }

  has(id) {
    return this.modules.has(id);
  }

  getAll() {
    return Array.from(this.modules.values()).map(m => ({
      id: m.id,
      name: m.name,
      description: m.description || '',
      category: m.category || '其他',
    }));
  }

  getByCategory(category) {
    return this.getAll().filter(m => m.category === category);
  }

  getCategories() {
    const categories = new Set();
    this.getAll().forEach(m => categories.add(m.category));
    return [...categories].sort();
  }

  async execute(id, params = {}, source = 'manual') {
    const module = this.get(id);
    if (!module) {
      throw new Error(`模块 ${id} 不存在`);
    }
    return module.run(params);
  }

  async discover(directory) {
    if (this._initialized) return;

    if (!fs.existsSync(directory)) {
      return;
    }

    const entries = fs.readdirSync(directory);
    const jsFiles = entries.filter(f => f.endsWith('.js') && f !== 'index.js');

    for (const file of jsFiles) {
      try {
        const filePath = path.join(directory, file);
        const mod = require(filePath);

        if (mod.action) {
          this.register(mod.action);
        } else if (mod.module) {
          this.register(mod.module);
        }
      } catch (error) {
        console.warn(`[模块注册] 加载 ${file} 失败: ${error.message}`);
      }
    }

    this._initialized = true;
  }

  discoverSync(directory) {
    if (this._initialized) return;

    if (!fs.existsSync(directory)) {
      return;
    }

    const entries = fs.readdirSync(directory);
    const jsFiles = entries.filter(f => f.endsWith('.js') && f !== 'index.js');

    for (const file of jsFiles) {
      try {
        const filePath = path.join(directory, file);
        const mod = require(filePath);

        if (mod.action) {
          this.register(mod.action);
        } else if (mod.module) {
          this.register(mod.module);
        }
      } catch (error) {
        console.warn(`[模块注册] 加载 ${file} 失败: ${error.message}`);
      }
    }

    this._initialized = true;
  }

  reset() {
    this.modules.clear();
    this._initialized = false;
  }

  get size() {
    return this.modules.size;
  }
}

const registry = new ModuleRegistry();

module.exports = { ModuleRegistry, registry };

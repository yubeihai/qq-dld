const { getDb, toObjects, toObject } = require('../connection');

class Repository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  getDb() {
    return getDb();
  }

  findAll(filters = {}, orderBy = 'created_at DESC', limit = null) {
    const db = this.getDb();
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];
    const conditions = [];

    for (const [key, value] of Object.entries(filters)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;

    const result = db.exec(sql, params);
    return toObjects(result);
  }

  findOne(filters = {}) {
    const items = this.findAll(filters, 'created_at DESC', 1);
    return items.length > 0 ? items[0] : null;
  }

  findById(id) {
    const db = this.getDb();
    const result = db.exec(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    return toObject(result);
  }

  query(sql, params = []) {
    const db = this.getDb();
    const result = db.exec(sql, params);
    return toObjects(result);
  }

  queryOne(sql, params = []) {
    const items = this.query(sql, params);
    return items.length > 0 ? items[0] : null;
  }

  run(sql, params = []) {
    const db = this.getDb();
    db.run(sql, params);
  }
}

module.exports = { Repository };

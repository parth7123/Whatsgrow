const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/main.sqlite');
const db = new sqlite3.Database(dbPath);

async function createAdmin() {
  const hash = await bcrypt.hash('admin', 10);
  const userId = crypto.randomUUID();
  const date = new Date().toISOString();
  
  db.serialize(() => {
    // Check if user exists
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
      if (err) throw err;
      if (row) {
        console.log('Admin user already exists:', row.id);
        linkApiKey(row.id);
      } else {
        db.run(`INSERT INTO users (id, username, passwordHash, role, webhooksEnabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
          [userId, 'admin', hash, 'admin', 1, date, date], (err) => {
          if (err) throw err;
          console.log('Admin user created:', userId);
          linkApiKey(userId);
        });
      }
    });
  });
}

function linkApiKey(userId) {
  db.get('SELECT id FROM api_keys WHERE name = ?', ['Default Admin Key'], (err, row) => {
    if (err) throw err;
    if (row) {
      db.run('UPDATE api_keys SET userId = ? WHERE id = ?', [userId, row.id], (err) => {
        if (err) throw err;
        console.log('API key linked to admin user!');
        db.close();
      });
    } else {
      console.log('Default API key not found');
      db.close();
    }
  });
}

createAdmin();

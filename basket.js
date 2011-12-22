(function() {

  /*
  Basket module
  Part of BucketDB (c) 2011 by Trifork
  All rights Reserverd
  */

  var DOMStorage, DONE, IDBStorage, IEUStorage, LOADING, READ_ONLY, READ_WRITE, SQLStorage, VERSION_CHANGE, contains, fail, generate_uuid, onerror, onsuccess, parse, safe_getkey, storage, stringify_key, top;

  top = typeof exports !== "undefined" && exports !== null ? exports : window;

  if (!(top.Basket != null)) top.Basket = {};

  storage = window.localStorage;

  stringify_key = function(val) {
    var elm, res, _i, _len;
    if (typeof val === "string") return val;
    res = '';
    for (_i = 0, _len = val.length; _i < _len; _i++) {
      elm = val[_i];
      if (res !== '') res += ':';
      res += encodeURIComponent(elm);
    }
    return res;
  };

  parse = function(key, string) {
    var o;
    try {
      o = JSON.parse(string);
      o.key = key;
      return o;
    } catch (err) {
      console.error("cannot parse: " + key + "=" + string);
      return null;
    }
  };

  generate_uuid = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r, v, _ref;
      r = Math.random() * 16 | 0;
      v = (_ref = c === 'x') != null ? _ref : {
        r: r & 0x3 | 0x8
      };
      return v.toString(16);
    });
  };

  safe_getkey = function(storage, idx) {
    var key;
    try {
      key = storage.key(idx);
      console.log("key[" + idx + "]= " + key);
      return key;
    } catch (err) {
      return null;
    }
  };

  DOMStorage = (function() {

    function _Class(name, callback) {
      this.name = name;
      this.pfx = encodeURIComponent(this.name) + '/';
      this.pfx_regex = new RegExp('^' + this.pfx);
      if (typeof callback === "function") callback(this);
      return this;
    }

    _Class.prototype.eachKey = function(fn, acc, callback) {
      var i, key, pos;
      i = 0;
      pos = this.pfx.length;
      while ((key = safe_getkey(storage, i++)) != null) {
        if (this.pfx_regex.test(key)) acc = fn(key.substr(pos), acc);
      }
      callback(acc);
      return acc;
    };

    _Class.prototype.each = function(fn, acc) {
      var i, key, obj, pos;
      i = 0;
      pos = this.pfx.length;
      while ((key = safe_getkey(storage, i++)) !== null) {
        if (this.pfx_regex.test(key)) {
          obj = this.get(key.substr(pos));
          if (obj != null) acc = fn(obj, acc);
        }
      }
      return acc;
    };

    _Class.prototype.get = function(key, fn) {
      var result, value;
      value = storage.getItem(this.pfx + stringify_key(key));
      if (value === null) return null;
      result = parse(key, value);
      if (fn != null) fn(result);
      return result;
    };

    _Class.prototype.save = function(obj) {
      var key;
      if (obj.key != null) {
        key = obj.key;
      } else {
        key = generate_uuid();
      }
      try {
        delete obj.key;
        storage.setItem(this.pfx + stringify_key(key), JSON.stringify(obj));
        return obj;
      } finally {
        obj.key = key;
      }
    };

    _Class.prototype.nuke = function() {
      var all, key, _i, _len, _results;
      all = [];
      this.eachKey(function(key) {
        return all.push(key);
      });
      _results = [];
      for (_i = 0, _len = all.length; _i < _len; _i++) {
        key = all[_i];
        _results.push(storage.removeItem(this.pfx + key));
      }
      return _results;
    };

    _Class.prototype.addListener = function(fn) {
      var hook, pfx_len, pfx_regex;
      var _this = this;
      pfx_len = this.pfx.length;
      pfx_regex = this.pfx_regex;
      hook = function(evt) {
        var key, _ref, _ref2;
        if (!pfx_regex.test(evt.key)) return;
        key = evt.key.substr(pfx_len);
        return fn(key, (_ref = evt.oldValue) != null ? _ref : parse(key, evt.oldValue), (_ref2 = evt.newValue) != null ? _ref2 : parse(key, evt.newValue));
      };
      return window.addEventListener('storage', hook, false);
    };

    return _Class;

  })();

  fail = function(event, idx) {
    return console.log("error in IDBStorage", event, idx);
  };

  contains = function(list, elm) {
    var e, _i, _len;
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      e = list[_i];
      if (elm === e) return true;
    }
    return false;
  };

  window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.oIndexedDB || window.msIndexedDB;

  window.IDBCursor = window.IDBCursor || window.webkitIDBCursor;

  window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;

  window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;

  window.IDBDatabaseException = window.IDBDatabaseException || window.webkitIDBDatabaseException;

  READ_ONLY = 0;

  READ_WRITE = 1;

  VERSION_CHANGE = 2;

  LOADING = 1;

  DONE = 2;

  onsuccess = function(req, fn) {
    if (typeof fn !== 'function') return;
    if (req.readyState === DONE && req.errorCode === 0) {
      try {
        return fn({
          target: req
        });
      } catch (ex) {
        console.error('error: ', ex);
        throw ex;
      }
    } else {
      return req.onsuccess = function(e) {
        try {
          return fn(e);
        } catch (ex) {
          return console.error('error: ', ex);
        }
      };
    }
  };

  onerror = function(req, fn) {
    var run;
    if (typeof fn !== 'function') return;
    run = false;
    try {
      run = req.errorCode !== 0;
    } catch (err) {

    }
    if (run) {
      return fn({
        target: req
      });
    } else {
      return req.onerror = fn;
    }
  };

  IDBStorage = (function() {

    function _Class(name, callback) {
      var idb, req;
      var _this = this;
      this.name = name;
      idb = window.indexedDB;
      req = idb.open('bucketdb');
      this.pending = [];
      this.db = null;
      onsuccess(req, function(event) {
        var db, finish, req2;
        db = event.target.result;
        finish = function() {
          var fn, p, _results;
          _this.db = db;
          if (typeof callback === "function") callback(_this);
          _results = [];
          while (_this.pending.length !== 0) {
            p = _this.pending;
            _this.pending = [];
            _results.push((function() {
              var _i, _len, _results2;
              _results2 = [];
              for (_i = 0, _len = p.length; _i < _len; _i++) {
                fn = p[_i];
                _results2.push(fn());
              }
              return _results2;
            })());
          }
          return _results;
        };
        if (!contains(db.objectStoreNames, _this.name)) {
          req2 = db.setVersion(db.version + 1);
          onsuccess(req2, function() {
            db.createObjectStore(_this.name, {
              keyPath: 'key'
            });
            return window.setTimeout(finish, 1);
          });
          onerror(req2, fail);
        } else {
          window.setTimeout(finish, 1);
        }
        return null;
      });
      onerror(req, fail);
      return this;
    }

    _Class.prototype.withStore = function(mode, fn) {
      var action;
      var _this = this;
      action = function() {
        var store, txn;
        txn = _this.db.transaction([_this.name], mode);
        txn.onerror = fail;
        store = txn.objectStore(_this.name);
        return fn(store);
      };
      if (this.db === null) {
        this.pending.push(action);
      } else {
        window.setTimeout(action, 1);
      }
      return this;
    };

    _Class.prototype.save = function(obj, callback) {
      var _this = this;
      return this.withStore(READ_WRITE, function(store) {
        var req;
        if (!(obj.key != null)) obj.key = generate_uuid();
        req = store.put(obj);
        req.onsuccess = function(evt) {
          console.log("store of " + obj.key + " succeeded");
          if (typeof callback === 'function') return callback();
        };
        return req.onerror = fail;
      });
    };

    _Class.prototype.get = function(key, callback) {
      var _this = this;
      return this.withStore(READ_ONLY, function(store) {
        var req;
        req = store.get(key);
        onsuccess(req, function(e) {
          var value;
          value = typeof e.target.result === 'undefined' ? null : e.target.result;
          return window.setTimeout((function() {
            return typeof callback === "function" ? callback(value) : void 0;
          }), 1);
        });
        return onerror(req, fail);
      });
    };

    _Class.prototype.each = function(fn, acc, callback) {
      var _this = this;
      return this.withStore(READ_WRITE, function(store) {
        var req;
        req = store.openCursor(null, 0);
        onerror(req, fail);
        return onsuccess(req, function(e) {
          var cursor;
          cursor = e.target.result;
          if (cursor != null) {
            acc = fn(cursor.value, acc);
            return cursor['continue']();
          } else {
            return typeof callback === "function" ? callback(acc) : void 0;
          }
        });
      });
    };

    _Class.prototype.eachKey = function(fn, acc, callback) {
      return this.each((function(val, acc) {
        return fn(val.key, acc);
      }), acc, callback);
    };

    _Class.prototype.nuke = function(callback) {
      var _this = this;
      return this.withStore(READ_WRITE, function(store) {
        var req;
        req = store.clear();
        onerror(req, fail);
        return onsuccess(req, function(e) {
          return typeof callback === "function" ? callback(this) : void 0;
        });
      });
    };

    return _Class;

  })();

  SQLStorage = (function() {

    function _Class(name, callback) {
      var _this = this;
      this.name = name;
      this.db = openDatabase(this.name, "1.0", this.name, 5 * 1024 * 1025);
      this.db.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS bucket (id PRIMARY KEY ASC, text)');
        tx.executeSql('CREATE TABLE IF NOT EXISTS index (idx PRIMARY KEY ASC, key)');
        return typeof callback === "function" ? callback(_this) : void 0;
      });
    }

    _Class.prototype.update_index = function(key, was, to) {
      var add_rm;
      add_rm = index_change(key, was, to);
      if (!add_rm) return null;
      return this.db.transaction(function(tx) {
        var idx, _i, _j, _len, _len2, _ref, _ref2, _results;
        _ref = indexify(add_rm.remove);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          idx = _ref[_i];
          tx.executeSql('DELETE FROM index WHERE idx=? AND key=?', [idx, key]);
        }
        _ref2 = indexify(add_rm.add);
        _results = [];
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          idx = _ref2[_j];
          _results.push(tx.executeSql('INSERT INTO index (idx, key) VALUES (?, ?)', [idx, key]));
        }
        return _results;
      });
    };

    _Class.prototype.get_index = function(term, from, to, callback) {
      var fromKey, toKey;
      fromKey = encodeIndexKey(term, from);
      toKey = encodeIndexKey(term, to);
      return this.db.readTransaction(function(tx) {
        var result;
        result = function(tx, data) {
          var i, keys, _ref;
          keys = [];
          if (data.rows.length > 0) {
            for (i = 0, _ref = data.rows.length - 1; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
              keys.push(data.rows.item(i).key);
            }
          }
          return callback(keys);
        };
        return tx.executeSql('SELECT key FROM index WHERE ? >= idx AND idx <= ?', [fromKey, toKey], result);
      });
    };

    _Class.prototype.get = function(key, callback) {
      this.db.readTransaction(function(tx) {
        var transact;
        transact = function(tx, data) {
          var obj;
          if (data.rows.length === 0) {
            return typeof callback === "function" ? callback(null) : void 0;
          } else {
            obj = JSON.parse(data.rows.item(0).text);
            obj.key = key;
            return typeof callback === "function" ? callback(obj) : void 0;
          }
        };
        fail = function(tx, err) {
          console.error("database error: ", err);
          return typeof callback === "function" ? callback(null) : void 0;
        };
        return tx.executeSql('SELECT text FROM bucket WHERE id=?', [key], transact, fail);
      });
      return this;
    };

    _Class.prototype.save = function(obj, callback) {
      this.db.transaction(function(tx) {
        var key, step1, step2, text;
        fail = function(tx, err) {
          console.error("database error: ", err);
          return typeof callback === "function" ? callback(null) : void 0;
        };
        step2 = function(tx, data) {
          return typeof callback === "function" ? callback(null) : void 0;
        };
        step1 = function(tx, data) {
          if (data.rows.length === 0) {
            return tx.executeSql('INSERT INTO bucket (id, text) VALUES (?, ?)', [key, text], step2, fail);
          } else {
            return tx.executeSql('UPDATE bucket set text=? where id=?', [text, key], step2, fail);
          }
        };
        if (obj.key != null) {
          key = obj.key;
        } else {
          key = generate_uuid();
        }
        delete obj.key;
        try {
          text = JSON.stringify(obj);
        } finally {
          obj.key = key;
        }
        return tx.executeSql('SELECT id FROM bucket WHERE id=?', [key], step1, fail);
      });
      return this;
    };

    _Class.prototype.each = function(fn, acc, callback) {
      this.db.readTransaction(function(tx) {
        var transact;
        transact = function(tx, data) {
          var idx, key, obj, _ref;
          if (data.rows.length === 0) {
            return typeof callback === "function" ? callback(acc) : void 0;
          }
          for (idx = 0, _ref = data.rows.length - 1; 0 <= _ref ? idx <= _ref : idx >= _ref; 0 <= _ref ? idx++ : idx--) {
            key = data.rows.item(idx).id;
            obj = JSON.parse(data.rows.item(idx).text);
            obj.key = key;
            acc = fn(obj, acc);
          }
          return typeof callback === "function" ? callback(acc) : void 0;
        };
        fail = function(tx, err) {
          console.error("database error: ", err);
          return typeof callback === "function" ? callback(null) : void 0;
        };
        return tx.executeSql('SELECT id, text FROM bucket', [], transact, fail);
      });
      return this;
    };

    _Class.prototype.eachKey = function(fn, acc, callback) {
      this.db.readTransaction(function(tx) {
        var transact;
        transact = function(tx, data) {
          var idx, key, _ref;
          for (idx = 0, _ref = data.rows.length - 1; 0 <= _ref ? idx <= _ref : idx >= _ref; 0 <= _ref ? idx++ : idx--) {
            key = data.rows.item(idx).id;
            acc = fn(key, acc);
          }
          return typeof callback === "function" ? callback(acc) : void 0;
        };
        fail = function(tx, err) {
          console.error("database error: ", err);
          return typeof callback === "function" ? callback(null) : void 0;
        };
        return tx.executeSql('SELECT id FROM bucket', [], transact, fail);
      });
      return this;
    };

    _Class.prototype.nuke = function(callback) {
      return this.db.transaction(function(tx) {
        tx.executeSql('DELETE FROM bucket');
        return typeof callback === "function" ? callback(this) : void 0;
      });
    };

    return _Class;

  })();

  /*
    IE UserData Module
  */

  IEUStorage = (function() {

    function _Class(name, callback) {
      var s;
      this.name = name;
      s = document.createElement("span");
      s.style.behavior = "url('#default#userData')";
      s.style.position = "absolute";
      s.style.left = 10000;
      document.body.appendChild(s);
      this.storage = s;
      this.storage.load(this.name);
      if (typeof callback === "function") callback(this);
      return this;
    }

    _Class.prototype.eachKey = function(fn, acc, callback) {
      var ca, v, _i, _len;
      ca = this.storage.XMLDocument.firstChild.attributes;
      for (_i = 0, _len = ca.length; _i < _len; _i++) {
        v = ca[_i];
        acc = fn(v.nodeName, acc);
      }
      return typeof callback === "function" ? callback(acc) : void 0;
    };

    _Class.prototype.each = function(fn, acc, callback) {
      var ca, o, v, _i, _len;
      ca = this.storage.XMLDocument.firstChild.attributes;
      for (_i = 0, _len = ca.length; _i < _len; _i++) {
        v = ca[_i];
        o = JSON.parse(v.nodeValue || 'null');
        if (o) {
          o.key = v.nodeName;
          acc = fn(o, acc);
        }
      }
      return typeof callback === "function" ? callback(acc) : void 0;
    };

    _Class.prototype.get = function(key, fn) {
      var obj, text;
      if ((text = this.storage.getAttribute(key)) === null) {
        if (typeof fn === "function") fn(null);
      } else {
        obj = JSON.parse(text);
        if (obj) obj.key = key;
        if (typeof fn === "function") fn(obj);
      }
      return this;
    };

    _Class.prototype["delete"] = function(key, fn) {
      key = typeof key === 'string' ? key : key.key;
      this.storage.removeAttribute(key);
      this.storage.save(this.name);
      if (typeof fn === "function") fn(this);
      return this;
    };

    _Class.prototype.save = function(obj, fn) {
      var key;
      if (obj.key != null) {
        key = obj.key;
      } else {
        key = generate_uuid();
      }
      try {
        delete obj.key;
        this.storage.setAttribute(key, JSON.stringify(obj));
        this.storage.save(this.name);
      } finally {
        obj.key = key;
      }
      if (typeof fn === "function") fn(obj);
      return this;
    };

    _Class.prototype.nuke = function(fn) {
      var all;
      all = [];
      return this.eachKey((function(key) {
        return all.push(key);
      }), all, function() {
        var ca, v, _i, _len;
        ca = this.storage.XMLDocument.firstChild.attributes;
        for (_i = 0, _len = all.length; _i < _len; _i++) {
          v = all[_i];
          this.storage.removeAttribute(v.nodeName);
        }
        this.storage.save(this.name);
        return typeof fn === "function" ? fn() : void 0;
      });
    };

    return _Class;

  })();

  top.Basket.open = function(name, callback) {
    if (/Firefox/.test(navigator.userAgent) && !!indexedDB) {
      return new IDBStorage(name, callback);
    }
    if (typeof window.openDatabase === 'function') {
      return new SQLStorage(name, callback);
    }
    if (!!window.localStorage) return new DOMStorage(name, callback);
    if (typeof document.body.addBehavior !== 'undefined') {
      return new IEUStorage(name, callback);
    }
  };

}).call(this);

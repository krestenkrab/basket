###
Basket module
Part of BucketDB (c) 2011 by Trifork
All rights Reserverd
###




#
# DOMStorage module
#
# This module (basket) is a simple abstraction layer on top of
# dom storage, modeled after 'lawnchair'.
#
# Objects are stored by keys named thus:
#
#     encodedBucket = encodeURIComponent(bucketdb)
#     storageKey = encodedBucket + '/' + key
#
# This lets us match "our keys" using a simple regex:
#
#     Regex('^' + encodedBucket + '/')
#
# without fear of he "bucket name" containing special characters
#

top = exports ? window
if !top.Basket?
  top.Basket = {}

storage = window.localStorage

stringify_key = (val) ->
  return val if typeof(val) == "string"

  res = ''
  for elm in val
    res += ':' unless res == ''
    res += encodeURIComponent(elm)
  res

parse = (key,string) ->
  try
    o = JSON.parse(string)
    o.key = key
    o
  catch err
    console.error "cannot parse: "+key+"="+string
    return null

generate_uuid = () ->
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) ->
     r = Math.random()*16|0
     v = c == 'x' ? r : (r&0x3|0x8);
     v.toString(16);
   )

safe_getkey = (storage, idx) ->
  try
    key = storage.key(idx)
    console.log "key["+idx+"]= "+key
    return key;
  catch err
    return null


DOMStorage = class

  constructor:(@name, callback) ->
    @pfx = encodeURIComponent(@name) + '/'
    @pfx_regex = new RegExp('^' + @pfx)
    callback? this
    return this

  eachKey:(fn, acc, callback) ->
    i = 0
    pos = @pfx.length
    while (key = safe_getkey(storage, i++))?
      if @pfx_regex.test(key)
        acc = fn(key.substr(pos), acc)
    callback(acc)
    acc

  each:(fn, acc) ->
    i = 0
    pos = @pfx.length
    while (key = safe_getkey(storage, i++)) != null
      if @pfx_regex.test(key)
        obj = @get( key.substr(pos) )
        acc = fn(obj, acc) if obj?
    acc


  get:(key, fn) ->
    value = storage.getItem( @pfx + stringify_key(key) )
    return null if value==null
    result = parse(key, value)
    fn(result) if fn?
    result


  save:(obj) ->
    if obj.key?
      key = obj.key
    else
      key = generate_uuid()

    try
      delete obj.key
      storage.setItem( @pfx + stringify_key(key), JSON.stringify(obj) )
      obj
    finally
      obj.key = key

  nuke: () ->
    all = []
    @eachKey (key) -> all.push(key)
    for key in all
      storage.removeItem( @pfx + key )

  ##
  ## Add a listener(aKey, theOld, theNew)
  ##
  ## old/new is a {key:aKey, ... } structure
  ## and may be null on delete/create
  ##
  addListener:(fn) ->
    pfx_len = @pfx.length
    pfx_regex = @pfx_regex

    hook = (evt) =>
      return if !pfx_regex.test(evt.key)
      key = evt.key.substr(pfx_len)
      fn key,
         evt.oldValue ? parse(key, evt.oldValue),
         evt.newValue ? parse(key, evt.newValue)

    window.addEventListener 'storage', hook, false



fail = (event, idx) ->
     console.log("error in IDBStorage", event, idx)

contains = (list, elm) ->
  for e in list
    return true if elm==e
  return false

window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.oIndexedDB || window.msIndexedDB
window.IDBCursor = window.IDBCursor || window.webkitIDBCursor
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction
window.IDBDatabaseException = window.IDBDatabaseException || window.webkitIDBDatabaseException

READ_ONLY = 0
READ_WRITE = 1
VERSION_CHANGE = 2

LOADING=1
DONE=2

#
# It seems like some browsers don't actually invoke the
# callbacks if readyState is DONE.  So we wrap all
# settings of callbacks in these two functions ...
#

onsuccess = (req,fn) ->
  return unless typeof(fn) is 'function'
  if req.readyState == DONE && req.errorCode == 0
    try
      fn({target:req})
    catch ex
      console.error 'error: ', ex
      throw ex
  else
    req.onsuccess = (e) ->
      try
        fn(e)
      catch ex
        console.error 'error: ', ex

onerror = (req,fn) ->
  return unless typeof(fn) is 'function'
  run = false
  try
    run = (req.errorCode != 0)
  catch err
    # console.log(err)

  if run
    fn({target:req})
  else
    req.onerror = fn


IDBStorage = class

  constructor : (@name, callback) ->
    idb = window.indexedDB;
    req = idb.open('bucketdb')
    @pending = []
    @db = null

    onsuccess req, (event) =>
      db = event.target.result

      finish = () =>
        @db = db
        callback? this
        while @pending.length != 0
          p = @pending
          @pending = []
          fn() for fn in p

      if !contains(db.objectStoreNames, @name)
         req2 = db.setVersion (db.version + 1)
         onsuccess req2, () =>
             db.createObjectStore(@name, { keyPath: 'key' })
             window.setTimeout finish, 1

         onerror req2, fail
      else
         ## don't run the callback in this transaction context
         window.setTimeout finish, 1

      null

    onerror req, fail
    return this

  withStore : (mode, fn) ->
    action = () =>
      txn = @db.transaction([@name], mode)
      txn.onerror = fail
      store = txn.objectStore(@name)
      fn(store)

    if (@db == null)
      @pending.push action
    else
      window.setTimeout action,1

    return this


  save: (obj, callback) ->
    @withStore READ_WRITE, (store) =>
      if !obj.key?
        obj.key = generate_uuid()

      req = store.put obj
      req.onsuccess = (evt) ->
        console.log("store of "+obj.key+" succeeded")
        callback() if typeof(callback) is 'function'
      req.onerror = fail


  get: (key, callback) ->
    @withStore READ_ONLY, (store) =>
      req = store.get key
      onsuccess req, (e) ->
        value = if typeof(e.target.result) is 'undefined' then null else e.target.result
        window.setTimeout (()-> callback? value), 1
      onerror req, fail

  each: (fn, acc, callback) ->
    @withStore READ_WRITE, (store) =>
      req = store.openCursor(null, 0)
      onerror req,fail
      onsuccess req, (e) ->
        cursor = e.target.result
        if cursor?
           acc = fn(cursor.value, acc)
           cursor['continue']()
        else
           callback? acc

  eachKey: (fn, acc, callback) ->
    this.each ((val,acc) -> fn(val.key,acc)), acc, callback

  nuke: (callback) ->
    @withStore READ_WRITE, (store) =>
      req = store.clear()
      onerror req,fail
      onsuccess req, (e) ->
        callback? this


SQLStorage = class

   constructor : (@name, callback) ->
     @db = openDatabase(@name, "1.0", @name, 5 * 1024 * 1025)
     @db.transaction (tx) =>
       tx.executeSql('CREATE TABLE IF NOT EXISTS bucket (id PRIMARY KEY ASC, text)')
       tx.executeSql('CREATE TABLE IF NOT EXISTS index (idx PRIMARY KEY ASC, key)')
       callback? this

   update_index : (key, was, to) ->
     add_rm = index_change(key, was, to)

     return null if !add_rm

     @db.transaction (tx) ->
      for idx in indexify(add_rm.remove)
        tx.executeSql 'DELETE FROM index WHERE idx=? AND key=?', [ idx, key ]
      for idx in indexify(add_rm.add)
        tx.executeSql 'INSERT INTO index (idx, key) VALUES (?, ?)', [ idx, key ]

   get_index : (term, from, to, callback) ->
     fromKey = encodeIndexKey(term, from)
     toKey = encodeIndexKey(term, to)

     @db.readTransaction (tx) ->
       result = (tx, data) ->
         keys = []
         if data.rows.length > 0
           for i in [0..data.rows.length-1]
             keys.push data.rows.item(i).key

         callback keys

       tx.executeSql 'SELECT key FROM index WHERE ? >= idx AND idx <= ?', [fromKey, toKey], result



   get : (key, callback) ->
     @db.readTransaction (tx) ->

       transact = (tx, data) ->
         if data.rows.length == 0
           callback? null
         else
           obj = JSON.parse(data.rows.item(0).text)
           obj.key = key
           callback? obj

       fail = (tx, err) ->
         console.error "database error: ", err
         callback? null

       tx.executeSql 'SELECT text FROM bucket WHERE id=?', [key], transact, fail

     return this


   save : (obj, callback) ->
     @db.transaction (tx) ->

       fail = (tx, err) ->
         console.error "database error: ", err
         callback? null

       step2 = (tx, data) ->
         callback? null

       step1 = (tx, data) ->
         if data.rows.length == 0
           tx.executeSql 'INSERT INTO bucket (id, text) VALUES (?, ?)', [key, text], step2, fail
         else
           tx.executeSql 'UPDATE bucket set text=? where id=?', [text, key], step2, fail

       if obj.key?
         key = obj.key
       else
         key = generate_uuid()

       delete obj.key
       try
         text = JSON.stringify(obj)
       finally
         obj.key = key

       tx.executeSql 'SELECT id FROM bucket WHERE id=?', [key], step1, fail

     return this


   each : (fn, acc, callback) ->
     @db.readTransaction (tx) ->

       transact = (tx, data) ->
         if data.rows.length == 0
           return callback? acc

         for idx in [0..data.rows.length-1]
           key = data.rows.item(idx).id
           obj = JSON.parse(data.rows.item(idx).text)
           obj.key = key
           acc = fn(obj, acc)
         callback? acc

       fail = (tx, err) ->
         console.error "database error: ", err
         callback? null

       tx.executeSql 'SELECT id, text FROM bucket', [], transact, fail

     return this


   eachKey : (fn, acc, callback) ->
     @db.readTransaction (tx) ->

       transact = (tx, data) ->
         for idx in [0..data.rows.length-1]
           key = data.rows.item(idx).id
           acc = fn(key, acc)
         callback? acc

       fail = (tx, err) ->
         console.error "database error: ", err
         callback? null

       tx.executeSql 'SELECT id FROM bucket', [], transact, fail

     return this

   nuke: (callback) ->
     @db.transaction (tx) ->
       tx.executeSql 'DELETE FROM bucket'
       callback?(this)


###
  IE UserData Module
###

IEUStorage = class

  constructor:(@name, callback) ->
    s = document.createElement("span")
    s.style.behavior = "url('#default#userData')"
    s.style.position = "absolute"
    s.style.left = 10000
    document.body.appendChild s
    @storage = s
    @storage.load @name

    callback?(this)
    return this

  eachKey:(fn, acc, callback) ->
    ca = @storage.XMLDocument.firstChild.attributes
    for v in ca
      acc = fn(v.nodeName, acc)
    callback?(acc)

  each:(fn, acc, callback) ->
    ca = @storage.XMLDocument.firstChild.attributes
    for v in ca
      o = JSON.parse(v.nodeValue || 'null')
      if o
        o.key = v.nodeName
        acc = fn(o,acc)
    callback?(acc)


  get:(key, fn) ->
    if (text = @storage.getAttribute(key)) == null
      fn?(null)
    else
      obj = JSON.parse text
      obj.key = key if obj
      fn?(obj)

    return this

  delete:(key,fn) ->
    key = if typeof(key) == 'string' then key else key.key
    @storage.removeAttribute key
    @storage.save @name
    fn?(this)
    return this


  save:(obj, fn) ->
    if obj.key?
      key = obj.key
    else
      key = generate_uuid()

    try
      delete obj.key
      @storage.setAttribute key, JSON.stringify(obj)
      @storage.save @name
    finally
      obj.key = key

    fn?(obj)
    return this


  nuke:(fn) ->
    all = []
    @eachKey ((key) -> all.push(key)), all, () ->
      ca = @storage.XMLDocument.firstChild.attributes
      for v in all
        @storage.removeAttribute v.nodeName
      @storage.save @name
      fn?()



top.Basket.open = (name,callback) ->

#
#  Seems like IndexedDB only works on FireFox
#
  if /Firefox/.test(navigator.userAgent) && !!indexedDB
    return new IDBStorage(name, callback)

  if typeof(window.openDatabase) == 'function'
    return new SQLStorage(name, callback)

  if !!window.localStorage
    return new DOMStorage(name, callback)

  if typeof(document.body.addBehavior) != 'undefined'
    return new IEUStorage(name,callback)
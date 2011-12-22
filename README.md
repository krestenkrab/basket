
# Basket - Simple HTML5 Local Storage

Basket is a simple abstraction over the following "local storage" options for HTML5

Currently using (in order of priority)

- Indexed DB   [but not on Chrome right now]
- Web SQL
- Web Storage (localStorage)
- IE UserData

The usage model is quite simple:

    <script src="basket.js"></script>
    <script>
       var storage;
       Basket.open("name", function(s) { 
           storage = s;           
           
           // iterating keys
           var acc0 = []
           function onEachKey(key, acc) {  /* */ }
           function eachKeyDone() {  /* */ }
           storage.eachKey( onEachKey, acc0, eachKeyDone )
           
           // storing objects
           storage.save({key:'foobar', value:'peter!'})
           
           // getting objects
           storage.get('foobar', function(obj) { console.log("found: "+obj.value )});
           
           // delete one entry
           storage.delete('foobar', function() { .. delete done .. })
           
           // delete all!
           storage.nuke();
       });
       
    
    </script>
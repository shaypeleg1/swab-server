'use strict;'

// Some small time utility functions

module.exports = {
  cl: function cl(...params) {
	console.log.apply(console, params);
},
  sayHelloInSpanish: function() {
    return "Hola";
  },
};


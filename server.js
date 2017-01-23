"use strict";
var nodeMajor = +process.versions.node.split('.')[0];
if (nodeMajor < 4) {
	console.error('node < 4  is not supported!');
	process.exit(1);
} else {
	if (nodeMajor < 6) {
		console.info('Loading Babel transpiler for Oldish node!');
		require('babel-register')();
	}
}

require('./server-full');

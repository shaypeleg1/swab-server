// Minimal Simple REST API Handler (With MongoDB and Socket.io)
// Plus support for simple login and session
// Plus support for file upload
// Author: Yaron Biton misterBIT.co.il

"use strict";
const express = require('express'),
	bodyParser = require('body-parser'),
	cors = require('cors'),
	mongodb = require('mongodb')

const clientSessions = require("client-sessions");
const multer = require('multer')
const ObjectId = mongodb.ObjectID;

// Configure where uploaded files are going
const uploadFolder = '/uploads';
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, __dirname + uploadFolder);
	},
	filename: function (req, file, cb) {
		cl('file', file);
		const ext = file.originalname.substr(file.originalname.lastIndexOf('.'));
		cb(null, file.fieldname + '-' + Date.now() + ext)
	}
})
var upload = multer({
	storage: storage
})

const app = express();

var corsOptions = {
	origin: /http:\/\/localhost:\d+/,
	credentials: true
};

const serverRoot = 'http://localhost:3003/';
const baseUrl = serverRoot + 'data';


app.use(express.static('uploads'));
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(clientSessions({
	cookieName: 'session',
	secret: 'C0d1ng 1s fun 1f y0u kn0w h0w', // set this to a long random string!
	duration: 30 * 60 * 1000,
	activeDuration: 5 * 60 * 1000,
}));

const http = require('http').Server(app);
const io = require('socket.io')(http);


function dbConnect() {

	return new Promise((resolve, reject) => {
		// Connection URL
		var url = 'mongodb://localhost:27017/swab';
		// Use connect method to connect to the Server
		mongodb.MongoClient.connect(url, function (err, db) {
			if (err) {
				cl('Cannot connect to DB', err)
				reject(err);
			} else {
				//cl("Connected to DB");
				resolve(db);
			}
		});
	});
}

// GETs a list
app.get('/data/:objType', function (req, res) {
	const objType = req.params.objType;
	dbConnect().then((db) => {
		const collection = db.collection(objType);

		collection.find({}).toArray((err, objs) => {
			if (err) {
				cl('Cannot get you a list of ', err)
				res.json(404, {
					error: 'not found'
				})
			} else {
				cl("Returning list of " + objs.length + " " + objType + "s");
				res.json(objs);
			}
			db.close();
		});
	});
});

// GETs a single
app.get('/data/:objType/:id', function (req, res) {
	// const objType = req.params.objType;
	// const objId = req.params.id;
	cl(`Getting you an ${req.params.objType} with id: ${req.params.id}`);
	// let _id = new mongodb.ObjectID(req.params.id);

	// const collection = db.collection(req.params.objType);

	// finding for an obj 
	let searchRes = findSingleById(req.params.objType, req.params.id);

	if (searchRes === 'not found') {
		res.json(404, {
			error: 'not found'
		})
	} else {
		cl("Returning a single " + searchRes);
		res.json(searchRes)
	}
});



// DELETE
app.delete('/data/:objType/:id', function (req, res) {
	const objType = req.params.objType;
	const objId = req.params.id;
	cl(`Requested to DELETE the ${objType} with id: ${objId}`);
	dbConnect().then((db) => {
		const collection = db.collection(objType);
		collection.deleteOne({
			_id: new mongodb.ObjectID(objId)
		}, (err, result) => {
			if (err) {
				cl('Cannot Delete', err)
				res.json(500, {
					error: 'Delete failed'
				})
			} else {
				cl("Deleted", result);
				res.json({});
			}
			db.close();
		});

	});


});

// POST - adds 
app.post('/data/:objType', upload.single('file'), function (req, res) {
	const objType = req.params.objType;
	cl("POST for " + objType);
	const obj = req.body;
	cl('data in the post request:', req.body.newSiteData);
	if (req.body.sitesToGet) {
		// get many sites
		getManySites(req.body.sitesToGet, res);
		// res.json(objs);
	} else if (req.body.newSiteData) { // there is newSiteData => make new site
		cl(' making new site')
			//call function to make newsite
		makeNewSite(obj.newSiteData, objType, res);
	} else {
		delete obj._id;
		// If there is a file upload, add the url to the obj
		if (req.file) {
			obj.imgUrl = serverRoot + req.file.filename;
		}
		dbConnect().then((db) => {
			const collection = db.collection(objType);

			collection.insert(obj, (err, result) => {
				if (err) {
					cl(`Couldnt insert a new ${objType}`, err)
					res.json(500, {
						error: 'Failed to add'
					})
				} else {
					cl(objType + " added");
					res.json(obj);
					db.close();
				}
			});
		});
	}
});


function makeNewSite(newSiteData, objType, res) {
	cl('newSiteData inside makeNewSiteData:', newSiteData)
		// first get sitedata from the server based on the siteId,
	let templateSite = null
	let templateSiteID = ObjectId(newSiteData.siteId);
	dbConnect().then((db) => {
		const sitesCollection = db.collection('sites');
		const usersCollection = db.collection('users');
		sitesCollection.find({
			_id: templateSiteID
		}).toArray((err, objs) => {
			if (err) {
				cl('Cannot get you that ', err)
				res.json(404, {
					error: 'not found'
				})
			} else {
				templateSite = objs[0];
				delete templateSite._id;
				// cl('templateSite:', templateSite);
				sitesCollection.insert(templateSite, (err, result) => {
					if (err) {
						cl('there is an error')
					} else {
						// templateSite._id = 
						cl('here is the result', result.ops[0]._id);
						templateSite._id = result.ops[0]._id;
						usersCollection.update({
							_id: ObjectId(newSiteData.userId)
						}, {
							$push: {
								sites: templateSite._id
							}
						}, (er, result) => {
							if (err) {
								cl('cant find user')
							} else {
								// cl('result after push', result)
								res.json(templateSite);
								db.close();
							}
						})
					}
				})
			}

		})

	})
}


/*
	returns an obj from the data base.
 */
function findSingleById(collectionToSearch, idToSearch) {

	cl('getting data from collection:', collectionToSearch);
	dbConnect().then((db) => {
		let objIdToSearch = new mongodb.ObjectID(idToSearch);
		const collection = db.collection(collectionToSearch);
		collection.find({
			_id: objIdToSearch
		}).toArray((err, objs) => {
			if (err) { //not found
				return 'not found';
			} else { // found
				cl('objs[0]',objs[0])
				return objs[0];
			}
		})
	})
}


function queryBuilder(idsOfSites) {
	let queryObj = {
		$or: []
	}
	idsOfSites.forEach(siteId => {
		queryObj['$or'].push({
			_id: ObjectId(siteId)
		})
	})
	cl('this is the query', queryObj);
	return queryObj;
}
// get sites
function getManySites(sitesToGet, res) {
	cl('in getManySites', sitesToGet);
	const query = queryBuilder(sitesToGet);
	cl('this is th query', query)
	dbConnect().then((db) => {
		const collection = db.collection('sites');
		collection.find(query, {
			_id: 1,
			siteInfo: 1
		}).toArray((err, objs) => {
			if (err) {
				cl('cannot get you a list');
			} else {
				cl('this are the sites', objs);
				res.json(objs);
			}
			db.close();
		});
	});
}


app.put('/data/:objType/', function (req, res) {
	const objType = req.params.objType;
	const newObj = req.body;
	if (newObj._id && typeof newObj._id === 'string') newObj._id = new mongodb.ObjectID(newObj._id);
	cl(`Requested to UPDATE the ${objType} with id: ${newObj._id}`);
	dbConnect().then((db) => {
		const collection = db.collection(objType);
		collection.updateOne({
				_id: newObj._id
			}, newObj,
			(err, result) => {
				if (err) {
					cl('Cannot Update', err)
					res.json(500, {
						error: 'Update failed'
					})
				} else {
					res.json(newObj);

				}
				db.close();
			});
	});
});

// Basic Login/Logout/Protected assets
app.post('/login', function (req, res) {
	login(req, res)

});

function login(req, res) {
	cl('inside the login');
	dbConnect().then((db) => {
		db.collection('users').findOne({
			email: req.body.email,
			pass: req.body.pass
		}, function (err, user) {
			if (user) {
				cl('Login Succesful');
				delete user.pass;
				req.session.user = user; //refresh the session value
				res.json({
					token: 'Beareloginr: puk115th@b@5t',
					user
				});
			} else {
				cl('Login NOT Succesful');
				req.session.user = null;
				res.json(403, {
					error: 'Login failed'
				})
			}
		});
	});

}
app.post('/signup', function (req, res) {
	cl('inside server signup', req.body);
	const newUserObj = req.body;

	dbConnect().then((db) => {
		const collection = db.collection('users');
		cl('user', newUserObj)
		collection.insert(newUserObj, (err, result) => {
			if (err) {
				cl(`Couldnt insert a new user`)
				res.json(500, {
					error: 'Failed to add'
				})
			} else {
				cl(newUserObj + " added");
				// res.json(newUserObj);
				login(req, res);
				// db.close();
			}
		});
	});

});


app.get('/logout', function (req, res) {
	req.session.reset();
	res.end('Loggedout');
});

function requireLogin(req, res, next) {
	if (!req.session.user) {
		cl('Login Required');
		res.json(403, {
			error: 'Please Login'
		})
	} else {
		next();
	}
};
app.get('/protected', requireLogin, function (req, res) {
	res.end('User is loggedin, return some data');
});

// Kickup our server 
// Note: app.listen will not work with cors and the socket
// app.listen(3003, function () {
http.listen(3003, function () {
	console.log(`misterREST server is ready at ${baseUrl}`);
	console.log(`GET (list): \t\t ${baseUrl}/{entity}`);
	console.log(`GET (single): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`DELETE: \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`PUT (update): \t\t ${baseUrl}/{entity}/{id}`);
	console.log(`POST (add): \t\t ${baseUrl}/{entity}`);
});

io.on('connection', function (socket) {
	console.log('a user connected');
	socket.on('disconnect', function () {
		console.log('user disconnected');
	});
	socket.on('chat message', function (msg) {
		// console.log('message: ' + msg);
		io.emit('chat message', msg);
	});
});

cl('WebSocket is Ready');

// Some small time utility functions
function cl(...params) {
	console.log.apply(console, params);
}

// Just for basic testing the socket
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/test-socket.html');
});